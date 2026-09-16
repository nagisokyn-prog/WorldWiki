use arch_guard_domain::{compute_fingerprint, Category, Severity, Violation};
use std::path::Path;
use syn::{ItemUse, UsePath, UseTree};

pub struct ImportChecker<'a> {
    pub current_file: &'a Path,
    pub crate_name: &'a str,
}

impl<'a> ImportChecker<'a> {
    pub fn new(current_file: &'a Path, crate_name: &'a str) -> Self {
        Self { current_file, crate_name }
    }

    pub fn check_use(&self, item_use: &ItemUse) -> Vec<Violation> {
        let mut violations = Vec::new();
        self.inspect_use_tree(&item_use.tree, item_use, &mut violations);
        violations
    }

    fn inspect_use_tree(&self, tree: &UseTree, item_use: &ItemUse, violations: &mut Vec<Violation>) {
        match tree {
            UseTree::Path(UsePath { ident, tree, .. }) => {
                let root_segment = ident.to_string();

                // ARCH-001: Domain cannot import external frameworks
                if self.is_domain_crate() {
                    let forbidden_domain_pkgs = ["tauri", "tokio", "surrealdb", "reqwest", "hyper", "axum", "actix"];
                    if forbidden_domain_pkgs.contains(&root_segment.as_str()) {
                        violations.push(self.build_violation(
                            "ARCH-001",
                            item_use,
                            &format!("Domain crate '{}' cannot import external framework '{}'", self.crate_name, root_segment),
                            "Move infrastructure dependencies to ports traits in worldwiki-ports or adapters in worldwiki-infrastructure.",
                        ));
                    }
                }


                // ARCH-002: Application cannot import Tauri
                if self.is_application_crate() && root_segment == "tauri" {
                    violations.push(self.build_violation(
                        "ARCH-002",
                        item_use,
                        &format!("Application crate '{}' cannot import 'tauri'", self.crate_name),
                        "Pass UI parameters as clean DTOs into application use cases; isolate Tauri IPC in worldwiki-tauri.",
                    ));
                }

                // ARCH-005: Tauri SDK isolated strictly to adapters/tauri or worldwiki-tauri
                if !self.is_tauri_authorized_crate() && root_segment == "tauri" {
                    violations.push(self.build_violation(
                        "ARCH-005",
                        item_use,
                        &format!("Crate '{}' is not authorized to import 'tauri'", self.crate_name),
                        "Move Tauri IPC commands and dependencies to worldwiki-tauri (adapters/tauri).",
                    ));
                }

                self.inspect_use_tree(tree, item_use, violations);
            }
            UseTree::Group(group) => {
                for item in &group.items {
                    self.inspect_use_tree(item, item_use, violations);
                }
            }
            _ => {}
        }
    }

    fn is_domain_crate(&self) -> bool {
        self.crate_name == "worldwiki-domain" || self.crate_name.contains("domain")
    }

    fn is_application_crate(&self) -> bool {
        self.crate_name == "worldwiki-application" || self.crate_name.contains("application")
    }

    fn is_tauri_authorized_crate(&self) -> bool {
        self.crate_name == "worldwiki-tauri"
            || self.crate_name == "world-wiki"
            || self.crate_name.contains("tauri")
            || self.current_file.to_string_lossy().contains("adapters/tauri")
            || self.current_file.to_string_lossy().contains("crates/worldwiki-tauri")
    }

    fn build_violation(
        &self,
        rule_id: &str,
        item_use: &ItemUse,
        message: &str,
        remediation: &str,
    ) -> Violation {
        let snippet = quote::quote!(#item_use).to_string();
        let symbol = "use".to_string();
        let fingerprint = compute_fingerprint(rule_id, "1.0", &symbol, &snippet);

        Violation {
            rule_id: rule_id.to_string(),
            rule_version: "1.0".to_string(),
            category: Category::Architecture,
            severity: Severity::Deny,
            file: self.current_file.to_path_buf(),
            line: 1,
            column: 1,
            symbol,
            snippet,
            message: message.to_string(),
            remediation: remediation.to_string(),
            fingerprint,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_import_checker_domain_violations_arch001() {
        let code = "use tokio::sync::Mutex;";
        let item_use: ItemUse = syn::parse_str(code).unwrap();
        let checker = ImportChecker::new(Path::new("src/domain/entity.rs"), "worldwiki-domain");
        let violations = checker.check_use(&item_use);
        assert_eq!(violations.len(), 1);
        assert_eq!(violations[0].rule_id, "ARCH-001");
    }

    #[test]
    fn test_import_checker_app_violations_arch002() {
        let code = "use tauri::command;";
        let item_use: ItemUse = syn::parse_str(code).unwrap();
        let checker = ImportChecker::new(Path::new("src/application/use_case.rs"), "worldwiki-application");
        let violations = checker.check_use(&item_use);
        assert!(violations.iter().any(|v| v.rule_id == "ARCH-002"));
    }

    #[test]
    fn test_import_checker_unauthorized_tauri_arch005() {
        let code = "use tauri::AppHandle;";
        let item_use: ItemUse = syn::parse_str(code).unwrap();
        let checker = ImportChecker::new(Path::new("src/infra/repo.rs"), "worldwiki-infrastructure");
        let violations = checker.check_use(&item_use);
        assert!(violations.iter().any(|v| v.rule_id == "ARCH-005"));
    }

    #[test]
    fn test_import_checker_authorized_tauri_and_group_tree() {
        let code = "use tauri::{AppHandle, Manager};";
        let item_use: ItemUse = syn::parse_str(code).unwrap();
        let checker = ImportChecker::new(Path::new("src/adapters/tauri/commands.rs"), "worldwiki-tauri");
        let violations = checker.check_use(&item_use);
        assert!(violations.is_empty(), "Tauri adapter is authorized to import tauri");
    }
}


