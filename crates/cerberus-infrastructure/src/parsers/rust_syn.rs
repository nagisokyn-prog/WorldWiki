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

#[derive(Default, Clone)]
pub struct RustSynParserAdapter {
    pub matrix: Option<cerberus_domain::LayerTopologyMatrix>,
    pub config: Option<cerberus_domain::CerberusConfig>,
    pub bevy_context: Option<crate::ast::bevy::BevyScanContext>,
}

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
    pub fn new() -> Self {
        Self {
            matrix: None,
            config: None,
            bevy_context: None,
        }
    }

    pub fn with_matrix(matrix: cerberus_domain::LayerTopologyMatrix) -> Self {
        Self {
            matrix: Some(matrix),
            config: None,
            bevy_context: None,
        }
    }

    pub fn with_matrix_and_config(
        matrix: cerberus_domain::LayerTopologyMatrix,
        config: Option<cerberus_domain::CerberusConfig>,
    ) -> Self {
        Self {
            matrix: Some(matrix),
            config,
            bevy_context: None,
        }
    }

    pub fn with_bevy_context(mut self, ctx: crate::ast::bevy::BevyScanContext) -> Self {
        self.bevy_context = Some(ctx);
        self
    }

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

        // 1. Imports check (ARCH-001..ARCH-008, MOD-001, CQRS-001, EVT-001)
        let mut import_checker = ImportChecker::new(path, crate_name);
        if let Some(matrix) = &self.matrix {
            import_checker = import_checker.with_matrix(matrix);
        }
        let mut import_visitor = ImportVisitor {
            checker: import_checker,
            violations: Vec::new(),
        };
        import_visitor.visit_file(&syntax_tree);
        violations.extend(import_visitor.violations);

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

        let path_str = path.to_string_lossy();

        // 7. AI-Agent Defense (AI-003, AI-008, AI-009, AI-013)
        let ai_checker = crate::ast::AiDefenseChecker::new(&path_str, crate_name, &[], content);
        violations.extend(ai_checker.check_file(&syntax_tree));

        // 8. Testability & Pure Domain (TEST-002, TEST-003, TEST-005)
        let test_checker = crate::ast::TestabilityChecker::new(&path_str, crate_name, &[]);
        violations.extend(test_checker.check_file(&syntax_tree));

        // 9. Error Handling & Hygiene (ERR-001, ERR-002, ERR-003, ERR-005)
        let err_checker = crate::ast::ErrorRulesChecker::new(&path_str, crate_name, &[]);
        violations.extend(err_checker.check_file(&syntax_tree));

        // 10. Concurrency & Correctness (CONC-002, CONC-008)
        let conc_checker = crate::ast::ConcurrencyRulesChecker::new(&path_str, &[]);
        violations.extend(conc_checker.check_file(&syntax_tree));

        // 11. Rust Performance & Loops (PERF-006, PERF-011, PERF-012)
        let perf_checker = crate::ast::RustPerfChecker::new(&path_str, &[]);
        violations.extend(perf_checker.check_file(&syntax_tree));

        // 12. Bevy Rules (BEVY-*)
        if let Some(ctx) = &self.bevy_context {
            violations.extend(crate::ast::bevy::run_all_bevy_checks(
                &syntax_tree,
                &path_str,
                &[],
                ctx,
            ));
        }

        // 13. SurrealDB Bridge & Inline Query Rules (SURQL-008, SURQL-011, SURQL-026)
        let surql_violations =
            cerberus_surql::bridge::scan_rust_source_for_surreal_queries(content, path);
        violations.extend(surql_violations);

        let weights = PressureWeights::default();
        if let Ok(metrics) = AstComplexityAnalyzer::analyze_rust_file(content, path, 0.0, &weights)
        {
            let path_str = path.to_string_lossy().to_lowercase();
            let is_test_file = path_str.contains("/tests/")
                || path_str.contains("\\tests\\")
                || path_str.contains("/benches/")
                || path_str.contains("\\benches\\")
                || path_str.ends_with("_test.rs")
                || path_str.ends_with("_spec.rs");

            let default_warn_fns = self
                .config
                .as_ref()
                .map(|c| c.limits.max_functions_warn)
                .unwrap_or(20);
            let default_deny_fns = self
                .config
                .as_ref()
                .map(|c| c.limits.max_functions_deny)
                .unwrap_or(35);

            let (
                warn_sloc,
                deny_sloc,
                warn_pressure,
                deny_pressure,
                warn_functions,
                deny_functions,
            ) = if is_test_file {
                (1500, 3000, 800.0, 1500.0, 100, 200)
            } else if path_str.contains("domain") {
                (
                    300,
                    500,
                    150.0,
                    300.0,
                    default_warn_fns.min(15),
                    default_deny_fns.min(25),
                )
            } else if path_str.contains("application") {
                (400, 600, 200.0, 400.0, default_warn_fns, default_deny_fns)
            } else if path_str.contains("infrastructure") {
                (
                    500,
                    800,
                    250.0,
                    500.0,
                    default_warn_fns + 5,
                    default_deny_fns + 10,
                )
            } else {
                (500, 800, 200.0, 400.0, default_warn_fns, default_deny_fns)
            };

            let complexity_violations = AstComplexityAnalyzer::check_thresholds(
                &metrics,
                warn_sloc,
                deny_sloc,
                warn_pressure,
                deny_pressure,
                warn_functions,
                deny_functions,
            );
            violations.extend(complexity_violations);
        }

        Ok(violations)
    }
}

pub struct ImportVisitor<'a> {
    pub checker: ImportChecker<'a>,
    pub violations: Vec<Violation>,
}

impl<'ast, 'a> syn::visit::Visit<'ast> for ImportVisitor<'a> {
    fn visit_item_use(&mut self, node: &'ast syn::ItemUse) {
        self.violations.extend(self.checker.check_use(node));
        syn::visit::visit_item_use(self, node);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    fn has_rule(violations: &[Violation], rule_id: &str) -> bool {
        for v in violations {
            if v.rule_id == rule_id {
                return true;
            }
        }
        false
    }

    #[test]
    fn test_rust_syn_parser_adapter() {
        let adapter = RustSynParserAdapter::new();
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

        // Test with_matrix
        let matrix = cerberus_domain::LayerTopologyMatrix::preset_matrix("layered");
        let matrix_adapter = RustSynParserAdapter::with_matrix(matrix.clone());
        let violations = matrix_adapter
            .parse_source(
                "use crate::repository::Repo;",
                Path::new("src/controller/c.rs"),
                "app",
            )
            .unwrap();
        assert!(has_rule(&violations, "ARCH-007"));

        // Test with_matrix_and_config
        let config_adapter = RustSynParserAdapter::with_matrix_and_config(
            matrix,
            Some(cerberus_domain::CerberusConfig::default()),
        );
        let violations2 = config_adapter
            .parse_source(
                "use crate::repository::Repo;",
                Path::new("src/controller/c.rs"),
                "app",
            )
            .unwrap();
        assert!(has_rule(&violations2, "ARCH-007"));
    }

    #[test]
    fn test_rust_syn_parser_complexity_threshold() {
        let adapter = RustSynParserAdapter::default();
        let mut big_code = String::new();
        for i in 0..400 {
            big_code.push_str(&format!("pub fn fn_{}() {{ if true {{}} }}\n", i));
        }
        let violations = adapter
            .parse_source(&big_code, Path::new("crates/domain/src/god.rs"), "domain")
            .unwrap();
        assert!(has_rule(&violations, "ARCH-031"));

        // Test file path branch
        let test_violations = adapter
            .parse_source("pub fn small() {}", Path::new("tests/my_test.rs"), "domain")
            .unwrap();
        assert!(test_violations.is_empty());
    }

    #[test]
    fn test_rust_syn_parser_with_bevy_context() {
        let ctx =
            crate::ast::bevy::BevyScanContext::new(true, Some(semver::Version::new(0, 19, 1)));
        let adapter = RustSynParserAdapter::new().with_bevy_context(ctx);
        let violations = adapter
            .parse_source(
                "fn bad_sys() { std::thread::sleep(std::time::Duration::from_millis(10)); }",
                Path::new("src/main.rs"),
                "game",
            )
            .unwrap();
        assert!(has_rule(&violations, "BEVY-SCHED-001"));
    }
}
