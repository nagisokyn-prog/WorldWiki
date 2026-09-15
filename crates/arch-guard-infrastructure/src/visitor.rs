use crate::ast::async_rules::MutexGuardVisitor;
use crate::ast::capabilities::CapabilitiesVisitor;
use crate::ast::imports::ImportChecker;
use crate::ast::macros::MacroVisitor;
use crate::domain::rules::Violation;
use std::fs;
use std::path::Path;
use syn::visit::Visit;

#[derive(Debug, Default)]
pub struct ScanSummary {
    pub total_files: usize,
    pub parse_errors: usize,
    pub violations: Vec<Violation>,
}

pub struct FileAnalyzer;

impl FileAnalyzer {
    pub fn analyze_file(path: &Path, crate_name: &str) -> Result<Vec<Violation>, String> {
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
