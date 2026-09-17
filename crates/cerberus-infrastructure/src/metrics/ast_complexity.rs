use super::sloc::SlocCalculator;
use cerberus_domain::{
    compute_fingerprint, Category, FileMetrics, PressureWeights, Severity, Violation,
};
use std::collections::HashSet;
use std::path::Path;
use syn::visit::{self, Visit};
use syn::{Arm, BinOp, Expr, ExprBinary, ExprForLoop, ExprIf, ExprLoop, ExprTry, ExprWhile, File, ImplItemFn, ItemFn, ItemUse, TraitItemFn};

pub struct RustAstComplexityVisitor {
    pub function_count: usize,
    pub cyclomatic_complexity: usize,
    pub dependencies: HashSet<String>,
    pub max_ast_depth: usize,
    current_depth: usize,
}

impl Default for RustAstComplexityVisitor {
    fn default() -> Self {
        Self::new()
    }
}

impl RustAstComplexityVisitor {
    pub fn new() -> Self {
        Self {
            function_count: 0,
            cyclomatic_complexity: 1,
            dependencies: HashSet::new(),
            max_ast_depth: 0,
            current_depth: 0,
        }
    }

    fn enter_node(&mut self) {
        self.current_depth += 1;
        if self.current_depth > self.max_ast_depth {
            self.max_ast_depth = self.current_depth;
        }
    }

    fn leave_node(&mut self) {
        if self.current_depth > 0 {
            self.current_depth -= 1;
        }
    }
}

impl<'ast> Visit<'ast> for RustAstComplexityVisitor {
    fn visit_item_mod(&mut self, node: &'ast syn::ItemMod) {
        let is_test = node.ident == "tests"
            || node.ident == "test"
            || node.attrs.iter().any(|attr| {
                let s = quote::quote!(#attr).to_string();
                s.contains("cfg (test)") || s.contains("cfg(test)") || s.contains("test")
            });

        if !is_test {
            visit::visit_item_mod(self, node);
        }
    }

    fn visit_item_fn(&mut self, node: &'ast ItemFn) {
        if node.attrs.iter().any(|attr| quote::quote!(#attr).to_string().contains("test")) {
            return;
        }
        self.function_count += 1;
        self.enter_node();
        visit::visit_item_fn(self, node);
        self.leave_node();
    }

    fn visit_impl_item_fn(&mut self, node: &'ast ImplItemFn) {
        if node.attrs.iter().any(|attr| quote::quote!(#attr).to_string().contains("test")) {
            return;
        }
        self.function_count += 1;
        self.enter_node();
        visit::visit_impl_item_fn(self, node);
        self.leave_node();
    }

    fn visit_trait_item_fn(&mut self, node: &'ast TraitItemFn) {
        self.function_count += 1;
        self.enter_node();
        visit::visit_trait_item_fn(self, node);
        self.leave_node();
    }

    fn visit_item_use(&mut self, node: &'ast ItemUse) {
        let use_str = quote::quote!(#node).to_string();
        self.dependencies.insert(use_str);
        visit::visit_item_use(self, node);
    }

    fn visit_expr_if(&mut self, node: &'ast ExprIf) {
        self.cyclomatic_complexity += 1;
        self.enter_node();
        visit::visit_expr_if(self, node);
        self.leave_node();
    }

    fn visit_expr_while(&mut self, node: &'ast ExprWhile) {
        self.cyclomatic_complexity += 1;
        self.enter_node();
        visit::visit_expr_while(self, node);
        self.leave_node();
    }

    fn visit_expr_for_loop(&mut self, node: &'ast ExprForLoop) {
        self.cyclomatic_complexity += 1;
        self.enter_node();
        visit::visit_expr_for_loop(self, node);
        self.leave_node();
    }

    fn visit_expr_loop(&mut self, node: &'ast ExprLoop) {
        self.cyclomatic_complexity += 1;
        self.enter_node();
        visit::visit_expr_loop(self, node);
        self.leave_node();
    }

    fn visit_arm(&mut self, node: &'ast Arm) {
        self.cyclomatic_complexity += 1;
        self.enter_node();
        visit::visit_arm(self, node);
        self.leave_node();
    }

    fn visit_expr_try(&mut self, node: &'ast ExprTry) {
        self.cyclomatic_complexity += 1;
        self.enter_node();
        visit::visit_expr_try(self, node);
        self.leave_node();
    }

    fn visit_expr_binary(&mut self, node: &'ast ExprBinary) {
        if matches!(node.op, BinOp::And(_) | BinOp::Or(_)) {
            self.cyclomatic_complexity += 1;
        }
        self.enter_node();
        visit::visit_expr_binary(self, node);
        self.leave_node();
    }

    fn visit_expr(&mut self, node: &'ast Expr) {
        self.enter_node();
        visit::visit_expr(self, node);
        self.leave_node();
    }
}

pub struct AstComplexityAnalyzer;

impl AstComplexityAnalyzer {
    pub fn analyze_rust_file(
        content: &str,
        file_path: &Path,
        distance_d: f64,
        weights: &PressureWeights,
    ) -> Result<FileMetrics, String> {
        let sloc = SlocCalculator::count_sloc(content, file_path);

        let parsed: File = syn::parse_str(content)
            .map_err(|e| format!("Failed to parse Rust AST for {}: {}", file_path.display(), e))?;

        let mut visitor = RustAstComplexityVisitor::new();
        visitor.visit_file(&parsed);

        let metrics = FileMetrics::compute(
            file_path.to_path_buf(),
            sloc,
            visitor.function_count,
            visitor.cyclomatic_complexity,
            visitor.dependencies.len(),
            visitor.max_ast_depth,
            distance_d,
            weights,
        );

        Ok(metrics)
    }

    pub fn check_thresholds(
        metrics: &FileMetrics,
        warn_sloc: usize,
        deny_sloc: usize,
        warn_pressure: f64,
        deny_pressure: f64,
    ) -> Vec<Violation> {
        let mut violations = Vec::new();

        if metrics.sloc > deny_sloc {
            let snippet = format!("SLOC: {} (deny limit: {})", metrics.sloc, deny_sloc);
            let fingerprint = compute_fingerprint("ARCH-031", "1.0", "file", &snippet);
            violations.push(Violation {
                rule_id: "ARCH-031".into(),
                rule_version: "1.0".into(),
                category: Category::Architecture,
                severity: Severity::Deny,
                file: metrics.file_path.clone(),
                line: 1,
                column: 1,
                symbol: "file".into(),
                snippet,
                message: format!("File SLOC ({}) exceeds strict limit ({})", metrics.sloc, deny_sloc),
                remediation: "Decompose this file into cohesive submodules and separate single-responsibility units.".into(),
                fingerprint,
            });
        } else if metrics.sloc > warn_sloc {
            let snippet = format!("SLOC: {} (warn limit: {})", metrics.sloc, warn_sloc);
            let fingerprint = compute_fingerprint("ARCH-031", "1.0", "file", &snippet);
            violations.push(Violation {
                rule_id: "ARCH-031".into(),
                rule_version: "1.0".into(),
                category: Category::Architecture,
                severity: Severity::Warn,
                file: metrics.file_path.clone(),
                line: 1,
                column: 1,
                symbol: "file".into(),
                snippet,
                message: format!("File SLOC ({}) exceeds recommended limit ({})", metrics.sloc, warn_sloc),
                remediation: "Consider decomposing large modules before they become unmaintainable.".into(),
                fingerprint,
            });
        }

        if metrics.pressure_score > deny_pressure {
            let snippet = format!(
                "S_arch: {:.1} (Functions: {}, Cyclomatic: {}, Depth: {})",
                metrics.pressure_score, metrics.functions, metrics.cyclomatic, metrics.ast_depth
            );
            let fingerprint = compute_fingerprint("ARCH-030", "1.0", "file", &snippet);
            violations.push(Violation {
                rule_id: "ARCH-030".into(),
                rule_version: "1.0".into(),
                category: Category::Architecture,
                severity: Severity::Deny,
                file: metrics.file_path.clone(),
                line: 1,
                column: 1,
                symbol: "file".into(),
                snippet,
                message: format!("Architectural Pressure S_arch ({:.1}) exceeds critical limit ({:.1})", metrics.pressure_score, deny_pressure),
                remediation: "Reduce cyclomatic complexity, split functions, and simplify AST branching.".into(),
                fingerprint,
            });
        } else if metrics.pressure_score > warn_pressure {
            let snippet = format!(
                "S_arch: {:.1} (Functions: {}, Cyclomatic: {}, Depth: {})",
                metrics.pressure_score, metrics.functions, metrics.cyclomatic, metrics.ast_depth
            );
            let fingerprint = compute_fingerprint("ARCH-030", "1.0", "file", &snippet);
            violations.push(Violation {
                rule_id: "ARCH-030".into(),
                rule_version: "1.0".into(),
                category: Category::Architecture,
                severity: Severity::Warn,
                file: metrics.file_path.clone(),
                line: 1,
                column: 1,
                symbol: "file".into(),
                snippet,
                message: format!("High Architectural Pressure S_arch ({:.1}) exceeds warning limit ({:.1})", metrics.pressure_score, warn_pressure),
                remediation: "Refactor complex branching logic into smaller helper functions.".into(),
                fingerprint,
            });
        }

        violations
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ast_complexity_visitor_and_analyzer() {
        let mut visitor = RustAstComplexityVisitor::default();
        assert_eq!(visitor.function_count, 0);
        assert_eq!(visitor.cyclomatic_complexity, 1);
        visitor.leave_node(); // test underflow branch current_depth == 0

        let code = r#"
            #[cfg(test)]
            mod my_custom_suite {
                pub fn ignored() {}
            }
            mod inner {
                use std::collections::HashMap;
                pub trait Foo {
                    fn bar(&self);
                }
                struct Baz;
                impl Foo for Baz {
                    fn bar(&self) {}
                }
                pub fn calculate(a: bool, b: bool) -> Result<i32, String> {
                    if a && b {
                        for i in 0..10 {
                            while false {
                                loop {
                                    break;
                                }
                            }
                        }
                    }
                    match 1 {
                        1 => Ok(10),
                        _ => Err("err".into()),
                    }
                }
                pub fn with_try() -> Result<(), ()> {
                    let _ = Ok::<(), ()>(())?;
                    Ok(())
                }
            }
        "#;
        let weights = PressureWeights::default();
        let path = Path::new("src/test.rs");
        let metrics = AstComplexityAnalyzer::analyze_rust_file(code, path, 0.5, &weights).unwrap();
        assert!(metrics.functions >= 3);
        assert!(metrics.cyclomatic > 5);

        // Deny pressure
        let v1 = AstComplexityAnalyzer::check_thresholds(&metrics, 1000, 2000, 0.1, 0.2);
        assert!(!v1.is_empty());
        assert_eq!(v1[0].rule_id, "ARCH-030");
        assert_eq!(v1[0].severity, Severity::Deny);

        // Warn pressure
        let v2 = AstComplexityAnalyzer::check_thresholds(&metrics, 1000, 2000, 0.001, 1000.0);
        assert!(!v2.is_empty());
        assert_eq!(v2[0].severity, Severity::Warn);

        // SLOC deny & warn
        let mut heavy_metrics = metrics.clone();
        heavy_metrics.sloc = 3000;
        let v3 = AstComplexityAnalyzer::check_thresholds(&heavy_metrics, 1000, 2000, 1000.0, 2000.0);
        assert_eq!(v3[0].rule_id, "ARCH-031");
        assert_eq!(v3[0].severity, Severity::Deny);

        heavy_metrics.sloc = 1500;
        let v4 = AstComplexityAnalyzer::check_thresholds(&heavy_metrics, 1000, 2000, 1000.0, 2000.0);
        assert_eq!(v4[0].rule_id, "ARCH-031");
        assert_eq!(v4[0].severity, Severity::Warn);

        // Parse error
        assert!(AstComplexityAnalyzer::analyze_rust_file("invalid syntax {{{{", path, 0.0, &weights).is_err());
    }
}


