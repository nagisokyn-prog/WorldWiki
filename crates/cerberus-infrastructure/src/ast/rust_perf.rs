use cerberus_domain::{compute_fingerprint, Category, RuleDefinition, Severity, Violation};
use std::path::PathBuf;
use syn::spanned::Spanned;
use syn::visit::Visit;
use syn::{ExprCall, ExprForLoop, ExprWhile, File, ItemImpl};

pub struct RustPerfChecker<'a> {
    file_path: &'a str,
    rules: &'a [RuleDefinition],
}

impl<'a> RustPerfChecker<'a> {
    pub fn new(file_path: &'a str, rules: &'a [RuleDefinition]) -> Self {
        Self { file_path, rules }
    }

    pub fn check_file(&self, syntax: &File) -> Vec<Violation> {
        let mut violations = Vec::new();
        let mut visitor = RustPerfVisitor {
            checker: self,
            violations: &mut violations,
            loop_depth: 0,
            in_drop_impl: false,
        };
        visitor.visit_file(syntax);
        violations
    }

    fn check_call(&self, item: &ExprCall, path_str: &str, in_loop: bool, in_drop: bool, violations: &mut Vec<Violation>) {
        // PERF-011: I/O in Loop
        if in_loop && self.is_rule_enabled("PERF-011") {
            let io_signatures = [
                "fs::read",
                "fs::write",
                "File::open",
                "File::create",
                "reqwest::get",
                "reqwest::post",
                "Command::new",
                "sqlx::query",
            ];

            for io_fn in &io_signatures {
                if path_str.contains(io_fn) {
                    let snippet = path_str.to_string();
                    let fp = compute_fingerprint("PERF-011", "1.0", "loop_io", &snippet);
                    let span = item.span();

                    violations.push(Violation {
                        rule_id: "PERF-011".into(),
                        rule_version: "1.0".into(),
                        category: Category::Performance,
                        severity: self.get_severity("PERF-011", Severity::Warn),
                        file: PathBuf::from(self.file_path),
                        line: span.start().line,
                        column: span.start().column + 1,
                        symbol: "loop_io".into(),
                        message: format!(
                            "Blocking I/O operation '{}' invoked inside iteration loop causing N+1 performance bottleneck.",
                            path_str
                        ),
                        snippet,
                        remediation: "Batch I/O queries or read data into memory before loop execution.".into(),
                        fingerprint: fp,
                    });
                    break;
                }
            }
        }

        // PERF-012: Unbounded channel
        if self.is_rule_enabled("PERF-012") && path_str.contains("unbounded_channel") {
            let snippet = path_str.to_string();
            let fp = compute_fingerprint("PERF-012", "1.0", "unbounded_channel", &snippet);
            let span = item.span();

            violations.push(Violation {
                rule_id: "PERF-012".into(),
                rule_version: "1.0".into(),
                category: Category::Performance,
                severity: self.get_severity("PERF-012", Severity::Warn),
                file: PathBuf::from(self.file_path),
                line: span.start().line,
                column: span.start().column + 1,
                symbol: "unbounded_channel".into(),
                message: "Unbounded channel 'mpsc::unbounded_channel()' risks uncontrolled memory exhaustion under high throughput.".into(),
                snippet,
                remediation: "Use bounded 'tokio::sync::mpsc::channel(capacity)' with explicit backpressure limit.".into(),
                fingerprint: fp,
            });
        }

        // PERF-006: Blocking I/O in Drop
        if in_drop
            && self.is_rule_enabled("PERF-006")
            && (path_str.contains("fs::") || path_str.contains("Command::new") || path_str.contains("thread::sleep"))
        {
            let snippet = path_str.to_string();
            let fp = compute_fingerprint("PERF-006", "1.0", "drop_blocking_io", &snippet);
            let span = item.span();

            violations.push(Violation {
                rule_id: "PERF-006".into(),
                rule_version: "1.0".into(),
                category: Category::Performance,
                severity: self.get_severity("PERF-006", Severity::Deny),
                file: PathBuf::from(self.file_path),
                line: span.start().line,
                column: span.start().column + 1,
                symbol: "drop_blocking_io".into(),
                message: format!(
                    "Blocking I/O call '{}' inside 'Drop' implementation stalls runtime worker threads.",
                    path_str
                ),
                snippet,
                remediation: "Perform resource release asynchronously before dropping or delegate to background thread.".into(),
                fingerprint: fp,
            });
        }
    }

    fn is_rule_enabled(&self, rule_id: &str) -> bool {
        for r in self.rules {
            if r.id == rule_id {
                return r.severity != Severity::Off;
            }
        }
        true
    }

    fn get_severity(&self, rule_id: &str, default: Severity) -> Severity {
        for r in self.rules {
            if r.id == rule_id {
                return r.severity;
            }
        }
        default
    }
}

struct RustPerfVisitor<'a, 'b> {
    checker: &'a RustPerfChecker<'a>,
    violations: &'b mut Vec<Violation>,
    loop_depth: usize,
    in_drop_impl: bool,
}

impl<'a, 'b> Visit<'_> for RustPerfVisitor<'a, 'b> {
    fn visit_item_impl(&mut self, item: &ItemImpl) {
        let prev_in_drop = self.in_drop_impl;
        if let Some((trait_path, _)) = &item.trait_ {
            let trait_name = quote::quote!(#trait_path).to_string();
            if trait_name.ends_with("Drop") {
                self.in_drop_impl = true;
            }
        }
        syn::visit::visit_item_impl(self, item);
        self.in_drop_impl = prev_in_drop;
    }

    fn visit_expr_for_loop(&mut self, item: &ExprForLoop) {
        self.loop_depth += 1;
        syn::visit::visit_expr_for_loop(self, item);
        self.loop_depth -= 1;
    }

    fn visit_expr_while(&mut self, item: &ExprWhile) {
        self.loop_depth += 1;
        syn::visit::visit_expr_while(self, item);
        self.loop_depth -= 1;
    }

    fn visit_expr_call(&mut self, item: &ExprCall) {
        if let syn::Expr::Path(expr_path) = &*item.func {
            let mut parts = Vec::new();
            for s in &expr_path.path.segments {
                parts.push(s.ident.to_string());
            }
            let path_str = parts.join("::");
            self.checker.check_call(
                item,
                &path_str,
                self.loop_depth > 0,
                self.in_drop_impl,
                self.violations,
            );
        }
        syn::visit::visit_expr_call(self, item);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn has_rule(violations: &[Violation], rule_id: &str) -> bool {
        for v in violations {
            if v.rule_id == rule_id {
                return true;
            }
        }
        false
    }

    #[test]
    fn test_rust_perf_checker() {
        let code = r#"
            struct MyResource;
            impl Drop for MyResource {
                fn drop(&mut self) {
                    fs::write("test.txt", "data");
                }
            }

            fn run() {
                while true {
                    fs::read("file.txt");
                }
                for i in 0..10 {
                    let (tx, rx) = mpsc::unbounded_channel();
                }
            }
        "#;
        let syntax: syn::File = syn::parse_str(code).unwrap();
        let checker = RustPerfChecker::new("src/perf.rs", &[]);
        let violations = checker.check_file(&syntax);

        assert!(has_rule(&violations, "PERF-006"));
        assert!(has_rule(&violations, "PERF-011"));
        assert!(has_rule(&violations, "PERF-012"));
    }

    #[test]
    fn test_rust_perf_disabled_rules() {
        let code = r#"
            fn run() {
                for i in 0..10 {
                    let (tx, rx) = mpsc::unbounded_channel();
                }
            }
        "#;
        let syntax: syn::File = syn::parse_str(code).unwrap();
        let rules = vec![RuleDefinition {
            id: "PERF-012".into(),
            title: "unbounded".into(),
            version: "1.0".into(),
            category: Category::Performance,
            severity: Severity::Off,
            description: "off".into(),
            remediation: "none".into(),
        }];
        let checker = RustPerfChecker::new("src/perf.rs", &rules);
        let violations = checker.check_file(&syntax);
        assert!(violations.is_empty());
    }
}
