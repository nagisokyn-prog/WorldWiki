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
            cyclomatic_complexity: 1, // base complexity for file
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
    fn visit_item_fn(&mut self, node: &'ast ItemFn) {
        self.function_count += 1;
        self.enter_node();
        visit::visit_item_fn(self, node);
        self.leave_node();
    }

    fn visit_impl_item_fn(&mut self, node: &'ast ImplItemFn) {
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

        // 1. Check SLOC limits
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
                message: format!(
                    "File SLOC ({}) exceeds strict limit ({})",
                    metrics.sloc, deny_sloc
                ),
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
                message: format!(
                    "File SLOC ({}) exceeds recommended limit ({})",
                    metrics.sloc, warn_sloc
                ),
                remediation: "Consider decomposing large modules before they become unmaintainable.".into(),
                fingerprint,
            });
        }

        // 2. Check Pressure S_arch limits
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
                message: format!(
                    "Architectural Pressure S_arch ({:.1}) exceeds critical limit ({:.1})",
                    metrics.pressure_score, deny_pressure
                ),
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
                message: format!(
                    "High Architectural Pressure S_arch ({:.1}) exceeds warning limit ({:.1})",
                    metrics.pressure_score, warn_pressure
                ),
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
    use std::path::PathBuf;

    #[test]
    fn test_rust_ast_complexity_analysis() {
        let code = r#"
use std::path::Path;
use std::collections::HashMap;

pub fn complex_function(val: i32) -> Result<String, ()> {
    if val > 10 && val < 20 {
        for i in 0..val {
            if i % 2 == 0 {
                println!("Even");
            }
        }
    } else {
        match val {
            1 => println!("One"),
            2 => println!("Two"),
            _ => return Err(()),
        }
    }
    Ok("done".to_string())
}
"#;
        let path = PathBuf::from("src/test.rs");
        let weights = PressureWeights::default();
        let metrics = AstComplexityAnalyzer::analyze_rust_file(code, &path, 0.05, &weights)
            .expect("Should analyze");

        assert_eq!(metrics.functions, 1);
        assert!(metrics.cyclomatic >= 6); // if, &&, for, if, match arms
        assert_eq!(metrics.dependencies, 2);
        assert!(metrics.ast_depth >= 4);
        assert!(metrics.pressure_score > 0.0);
    }

    #[test]
    fn test_threshold_violations() {
        let file_metrics = FileMetrics {
            file_path: PathBuf::from("src/god.rs"),
            sloc: 500,
            functions: 30,
            cyclomatic: 40,
            dependencies: 20,
            ast_depth: 10,
            distance_d: 0.9,
            pressure_score: 350.0,
        };

        let violations = AstComplexityAnalyzer::check_thresholds(
            &file_metrics,
            200, // warn sloc
            350, // deny sloc
            150.0, // warn pressure
            300.0, // deny pressure
        );

        assert_eq!(violations.len(), 2);
        assert_eq!(violations[0].rule_id, "ARCH-031");
        assert_eq!(violations[0].severity, Severity::Deny);
        assert_eq!(violations[1].rule_id, "ARCH-030");
        assert_eq!(violations[1].severity, Severity::Deny);

        // Test warning branch
        let warn_file_metrics = FileMetrics {
            file_path: PathBuf::from("src/warn.rs"),
            sloc: 250,
            functions: 10,
            cyclomatic: 15,
            dependencies: 5,
            ast_depth: 4,
            distance_d: 0.2,
            pressure_score: 200.0,
        };

        let warn_violations = AstComplexityAnalyzer::check_thresholds(
            &warn_file_metrics,
            200, // warn sloc
            350, // deny sloc
            150.0, // warn pressure
            300.0, // deny pressure
        );

        assert_eq!(warn_violations.len(), 2);
        assert_eq!(warn_violations[0].rule_id, "ARCH-031");
        assert_eq!(warn_violations[0].severity, Severity::Warn);
        assert_eq!(warn_violations[1].rule_id, "ARCH-030");
        assert_eq!(warn_violations[1].severity, Severity::Warn);
    }

    #[test]
    fn test_ast_complexity_all_constructs_and_errors() {
        let code = r#"
pub trait MyTrait {
    fn trait_fn(&self);
}

pub struct MyStruct;

impl MyStruct {
    pub fn loop_and_try(&self) -> Result<(), ()> {
        let mut x = 0;
        while x < 5 {
            x += 1;
        }
        loop {
            if x == 10 || x == 20 {
                break;
            }
        }
        let _ = Some(1).ok_or(())?;
        Ok(())
    }
}
"#;
        let path = PathBuf::from("src/all.rs");
        let weights = PressureWeights::default();
        let metrics = AstComplexityAnalyzer::analyze_rust_file(code, &path, 0.0, &weights)
            .expect("Should analyze");

        assert_eq!(metrics.functions, 2); // 1 trait fn + 1 impl fn
        assert!(metrics.cyclomatic >= 4); // while, loop, ||, ?

        // Parse error test
        let broken_code = "fn broken( { ";
        assert!(AstComplexityAnalyzer::analyze_rust_file(broken_code, &path, 0.0, &weights).is_err());

        // Default visitor test
        let default_visitor = RustAstComplexityVisitor::default();
        assert_eq!(default_visitor.function_count, 0);
    }
}
