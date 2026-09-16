use crate::ast::ai_slop::AiSlopVisitor;
use crate::ast::async_rules::MutexGuardVisitor;
use crate::ast::capabilities::CapabilitiesVisitor;
use crate::ast::imports::ImportChecker;
use crate::ast::macros::MacroVisitor;
use crate::ast::panic_vector::PanicVectorVisitor;
use crate::metrics::AstComplexityAnalyzer;
use cerberus_domain::{PressureWeights, Violation};
use cerberus_ports::AstParserPort;

use std::fs;
use std::path::Path;
use syn::visit::Visit;

pub struct RustSynParserAdapter;

impl AstParserPort for RustSynParserAdapter {
    fn can_parse(&self, path: &Path) -> bool {
        path.extension().is_some_and(|ext| ext == "rs")
    }

    fn parse_file(&self, path: &Path, crate_name: &str) -> Result<Vec<Violation>, String> {
        let content = fs::read_to_string(path)
            .map_err(|e| format!("Could not read file {}: {}", path.display(), e))?;
        self.parse_source(&content, path, crate_name)
    }
}

impl RustSynParserAdapter {
    pub fn parse_source(
        &self,
        content: &str,
        path: &Path,
        crate_name: &str,
    ) -> Result<Vec<Violation>, String> {
        let syntax_tree = match syn::parse_file(content) {
            Ok(tree) => tree,
            Err(e) => {
                return Err(format!("[PARSE-ERROR] {}: {}", path.display(), e));
            }
        };

        let mut violations = Vec::new();

        // 1. Imports check (ARCH-001..ARCH-008)
        let import_checker = ImportChecker::new(path, crate_name);
        for item in &syntax_tree.items {
            if let syn::Item::Use(item_use) = item {
                violations.extend(import_checker.check_use(item_use));
            }
        }

        // 2. ASYNC-001 / ASYNC-002 (MutexGuard across await, blocking sleep in async)
        let mut async_visitor = MutexGuardVisitor::new(path);
        async_visitor.visit_file(&syntax_tree);
        violations.extend(async_visitor.violations);

        // 3. Capabilities / Sandbox
        let mut cap_visitor = CapabilitiesVisitor::new(path, crate_name);
        cap_visitor.visit_file(&syntax_tree);
        violations.extend(cap_visitor.violations);

        // 4. Macro visitor
        let mut macro_visitor = MacroVisitor::new(path, crate_name);
        macro_visitor.visit_file(&syntax_tree);
        violations.extend(macro_visitor.violations);

        // 5. Panic Vector (ROB-001)
        let mut panic_visitor = PanicVectorVisitor::new(path);
        panic_visitor.visit_file(&syntax_tree);
        violations.extend(panic_visitor.violations);

        // 6. AI-Slop & Indirection Tax (SLOP-001)
        let mut slop_visitor = AiSlopVisitor::new(path, crate_name);
        slop_visitor.visit_file(&syntax_tree);
        violations.extend(slop_visitor.violations);

        let weights = PressureWeights::default();
        if let Ok(metrics) = AstComplexityAnalyzer::analyze_rust_file(content, path, 0.0, &weights) {
            let path_str = path.to_string_lossy().to_lowercase();
            let is_test_file = path_str.contains("/tests/")
                || path_str.contains("\\tests\\")
                || path_str.contains("/benches/")
                || path_str.contains("\\benches\\")
                || path_str.ends_with("_test.rs")
                || path_str.ends_with("_spec.rs");

            let (warn_sloc, deny_sloc, warn_pressure, deny_pressure) = if is_test_file {
                (1000, 2000, 500.0, 1000.0)
            } else if path_str.contains("domain") {
                (200, 350, 100.0, 200.0)
            } else if path_str.contains("application") {
                (150, 300, 80.0, 180.0)
            } else if path_str.contains("infrastructure") {
                (400, 700, 200.0, 400.0)
            } else {
                (300, 500, 150.0, 300.0)
            };


            let complexity_violations = AstComplexityAnalyzer::check_thresholds(
                &metrics,
                warn_sloc,
                deny_sloc,
                warn_pressure,
                deny_pressure,
            );
            violations.extend(complexity_violations);
        }

        Ok(violations)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_rust_syn_parser_adapter() {
        let adapter = RustSynParserAdapter;
        assert!(adapter.can_parse(Path::new("src/lib.rs")));
        assert!(!adapter.can_parse(Path::new("src/lib.vue")));

        let temp = tempdir().unwrap();
        let valid_file = temp.path().join("valid.rs");
        fs::write(&valid_file, "pub fn foo() {}").unwrap();
        assert!(adapter.parse_file(&valid_file, "domain").is_ok());

        let invalid_file = temp.path().join("invalid.rs");
        fs::write(&invalid_file, "fn foo( { broken syntax").unwrap();
        let err = adapter.parse_file(&invalid_file, "domain").unwrap_err();
        assert!(err.contains("[PARSE-ERROR]"));

        let missing = temp.path().join("missing.rs");
        assert!(adapter.parse_file(&missing, "domain").is_err());
    }

    #[test]
    fn test_rust_syn_parser_complexity_threshold() {
        let adapter = RustSynParserAdapter;
        let mut big_code = String::new();
        for i in 0..400 {
            big_code.push_str(&format!("pub fn fn_{}() {{ if true {{}} }}\n", i));
        }
        let violations = adapter
            .parse_source(&big_code, Path::new("crates/domain/src/god.rs"), "domain")
            .unwrap();
        assert!(violations.iter().any(|v| v.rule_id == "ARCH-031"));
    }
}
