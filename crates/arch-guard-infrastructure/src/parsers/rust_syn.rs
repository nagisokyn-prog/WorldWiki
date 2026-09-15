use crate::ast::async_rules::MutexGuardVisitor;
use crate::ast::capabilities::CapabilitiesVisitor;
use crate::ast::imports::ImportChecker;
use crate::ast::macros::MacroVisitor;
use arch_guard_domain::Violation;
use arch_guard_ports::AstParserPort;

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

        let syntax_tree = match syn::parse_file(&content) {
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

        // 2. ASYNC-001 MutexGuard across await
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
}

