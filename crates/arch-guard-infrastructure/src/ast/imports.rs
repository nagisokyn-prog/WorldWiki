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
                        violations.push(self.create_violation(
                            "ARCH-001",
                            "1.0",
                            Category::Architecture,
                            Severity::Deny,
                            item_use,
                            &format!("Domain crate '{}' cannot import external framework '{}'", self.crate_name, root_segment),
                            "Move infrastructure dependencies to ports traits in worldwiki-ports or adapters in worldwiki-infrastructure.",
                        ));
                    }
                }

                // ARCH-002: Application cannot import Tauri
                if self.is_application_crate() {
                    if root_segment == "tauri" {
                        violations.push(self.create_violation(
                            "ARCH-002",
                            "1.0",
                            Category::Architecture,
                            Severity::Deny,
                            item_use,
                            &format!("Application crate '{}' cannot import 'tauri'", self.crate_name),
                            "Pass UI parameters as clean DTOs into application use cases; isolate Tauri IPC in worldwiki-tauri.",
                        ));
                    }
                }

                // ARCH-005: Tauri SDK isolated strictly to adapters/tauri or worldwiki-tauri
                if !self.is_tauri_authorized_crate() {
                    if root_segment == "tauri" {
                        violations.push(self.create_violation(
                            "ARCH-005",
                            "1.0",
                            Category::Architecture,
                            Severity::Deny,
                            item_use,
                            &format!("Crate '{}' is not authorized to import 'tauri'", self.crate_name),
                            "Move Tauri IPC commands and dependencies to worldwiki-tauri (adapters/tauri).",
                        ));
                    }
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

    fn create_violation(
        &self,
        rule_id: &str,
        rule_version: &str,
        category: Category,
        severity: Severity,
        item_use: &ItemUse,
        message: &str,
        remediation: &str,
    ) -> Violation {
        let snippet = quote::quote!(#item_use).to_string();
        let symbol = "use".to_string();
        let fingerprint = compute_fingerprint(rule_id, rule_version, &symbol, &snippet);

        Violation {
            rule_id: rule_id.to_string(),
            rule_version: rule_version.to_string(),
            category,
            severity,
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
