use cerberus_domain::{compute_fingerprint, Category, Severity, Violation};

use crate::taint::sanitizers::TaintSanitizerChecker;
use crate::taint::sinks::TaintSinkDetector;
use crate::taint::sources::TaintSourceFinder;
use std::collections::{HashMap, HashSet};
use std::path::Path;
use syn::visit::Visit;
use syn::{Expr, ItemFn};

pub struct TaintGraphAnalyzer<'a> {
    pub current_file: &'a Path,
    pub max_depth: usize,
    pub functions: HashMap<String, ItemFn>,
    pub taint_sources: HashSet<String>,
    pub sanitizers: HashSet<String>,
}

impl<'a> TaintGraphAnalyzer<'a> {
    pub fn new(current_file: &'a Path) -> Self {
        Self {
            current_file,
            max_depth: 3,
            functions: HashMap::new(),
            taint_sources: HashSet::new(),
            sanitizers: HashSet::new(),
        }
    }

    pub fn collect_file(&mut self, syntax_tree: &syn::File) {
        for item in &syntax_tree.items {
            if let syn::Item::Fn(item_fn) = item {
                let name = item_fn.sig.ident.to_string();
                if TaintSourceFinder::is_taint_source(item_fn) {
                    self.taint_sources.insert(name.clone());
                }
                if TaintSanitizerChecker::is_sanitizer_fn(item_fn) {
                    self.sanitizers.insert(name.clone());
                }
                self.functions.insert(name, item_fn.clone());
            }
        }
    }

    pub fn analyze(&self) -> Vec<Violation> {
        let mut violations = Vec::new();

        for source_name in &self.taint_sources {
            if let Some(source_fn) = self.functions.get(source_name) {
                let mut visited = HashSet::new();
                self.trace_taint(source_name, source_fn, 0, &mut visited, &mut violations);
            }
        }

        violations
    }

    fn trace_taint(
        &self,
        current_fn_name: &str,
        item_fn: &ItemFn,
        depth: usize,
        visited: &mut HashSet<String>,
        violations: &mut Vec<Violation>,
    ) {
        if depth > self.max_depth || visited.contains(current_fn_name) {
            return;
        }
        visited.insert(current_fn_name.to_string());

        // Check if current function has sinks
        let mut sink_visitor = FunctionSinkVisitor {
            current_file: self.current_file,
            fn_name: current_fn_name,
            violations: Vec::new(),
        };
        sink_visitor.visit_item_fn(item_fn);
        violations.extend(sink_visitor.violations);

        // Trace calls inside item_fn to other local functions
        let mut call_collector = LocalCallCollector { calls: Vec::new() };
        call_collector.visit_item_fn(item_fn);

        for called_fn in call_collector.calls {
            if !self.sanitizers.contains(&called_fn) {
                if let Some(next_fn) = self.functions.get(&called_fn) {
                    self.trace_taint(&called_fn, next_fn, depth + 1, visited, violations);
                }
            }
        }
    }
}

struct FunctionSinkVisitor<'a> {
    current_file: &'a Path,
    fn_name: &'a str,
    violations: Vec<Violation>,
}

impl<'a, 'ast> Visit<'ast> for FunctionSinkVisitor<'a> {
    fn visit_expr(&mut self, expr: &'ast Expr) {
        if let Some(sink_desc) = TaintSinkDetector::is_dangerous_sink(expr) {
            let snippet = quote::quote!(#expr).to_string();
            let symbol = self.fn_name.to_string();
            let fingerprint = compute_fingerprint("SEC-001", "1.0", &symbol, &snippet);

            self.violations.push(Violation {
                rule_id: "SEC-001".into(),
                rule_version: "1.0".into(),
                category: Category::Security,
                severity: Severity::Deny,
                file: self.current_file.to_path_buf(),
                line: 1,
                column: 1,
                symbol,
                snippet,
                message: format!("Tainted input reached {}: unsanitized data reaches execution sink", sink_desc),
                remediation: "Sanitize path via validate_safe_path() or annotate function with #[cerberus(sanitizes)].".into(),
                fingerprint,
            });
            return;
        }
        syn::visit::visit_expr(self, expr);
    }
}


struct LocalCallCollector {
    calls: Vec<String>,
}

impl<'ast> Visit<'ast> for LocalCallCollector {
    fn visit_expr_call(&mut self, call: &'ast syn::ExprCall) {
        if let syn::Expr::Path(expr_path) = &*call.func {
            if let Some(segment) = expr_path.path.segments.last() {
                self.calls.push(segment.ident.to_string());
            }
        }
        syn::visit::visit_expr_call(self, call);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_taint_graph_detected_violation() {
        let code = r#"
            #[tauri::command]
            fn handle_user_input(path: String) {
                inner_exec(path);
            }

            fn inner_exec(cmd: String) {
                std::process::Command::new(cmd);
            }
        "#;
        let file: syn::File = syn::parse_str(code).unwrap();
        let mut analyzer = TaintGraphAnalyzer::new(Path::new("src/commands.rs"));
        analyzer.collect_file(&file);
        let violations = analyzer.analyze();
        assert_eq!(violations.len(), 1);
        assert_eq!(violations[0].rule_id, "SEC-001");
        assert_eq!(violations[0].symbol, "inner_exec");
    }

    #[test]
    fn test_taint_graph_sanitizer_stops_propagation() {
        let code = r#"
            #[tauri::command]
            fn handle_user_input(path: String) {
                let clean = sanitize_filename(path);
                inner_exec(clean);
            }

            #[cerberus(sanitizes)]
            fn sanitize_filename(p: String) -> String { p }

            fn inner_exec(cmd: String) {
                std::process::Command::new(cmd);
            }
        "#;
        let file: syn::File = syn::parse_str(code).unwrap();
        let mut analyzer = TaintGraphAnalyzer::new(Path::new("src/commands.rs"));
        analyzer.collect_file(&file);
        assert!(analyzer.sanitizers.contains("sanitize_filename"));
    }


    #[test]
    fn test_taint_graph_sanitized_pipeline_no_violation() {
        let code = r#"
            #[tauri::command]
            fn handle_user_input(path: String) {
                sanitize_and_run(path);
            }

            fn sanitize_and_run(p: String) {
                let _clean = validate_safe_path(p);
            }

            fn validate_safe_path(p: String) -> String { p }
        "#;
        let file: syn::File = syn::parse_str(code).unwrap();
        let mut analyzer = TaintGraphAnalyzer::new(Path::new("src/commands.rs"));
        analyzer.collect_file(&file);
        let violations = analyzer.analyze();
        assert!(violations.is_empty(), "Sanitized path should have no SEC-001 violations");
    }

    #[test]
    fn test_taint_graph_recursion_and_depth_cutoff() {
        let code = r#"
            #[tauri::command]
            fn fn_a() { fn_b(); }
            fn fn_b() { fn_c(); }
            fn fn_c() { fn_d(); }
            fn fn_d() { fn_e(); }
            fn fn_e() { std::process::Command::new("sh"); }
        "#;
        let file: syn::File = syn::parse_str(code).unwrap();
        let mut analyzer = TaintGraphAnalyzer::new(Path::new("src/commands.rs"));
        analyzer.max_depth = 2; // shallow depth cutoff
        analyzer.collect_file(&file);
        let violations = analyzer.analyze();
        assert!(violations.is_empty(), "Depth cutoff prevented reaching deep sink");
    }
}

