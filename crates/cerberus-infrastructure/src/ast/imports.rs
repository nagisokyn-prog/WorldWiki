use cerberus_domain::{
    compute_fingerprint, normalize_path, path_contains, Category, LayerTopologyMatrix, Severity,
    Violation,
};
use std::path::Path;
use syn::{ItemUse, UsePath, UseTree};

pub struct ImportChecker<'a> {
    pub current_file: &'a Path,
    pub crate_name: &'a str,
    pub matrix: Option<&'a LayerTopologyMatrix>,
}

impl<'a> ImportChecker<'a> {
    pub fn new(current_file: &'a Path, crate_name: &'a str) -> Self {
        Self {
            current_file,
            crate_name,
            matrix: None,
        }
    }

    pub fn with_matrix(mut self, matrix: &'a LayerTopologyMatrix) -> Self {
        self.matrix = Some(matrix);
        self
    }

    pub fn check_use(&self, item_use: &ItemUse) -> Vec<Violation> {
        let mut violations = Vec::new();
        let mut prefix = Vec::new();
        self.inspect_use_tree(&item_use.tree, item_use, &mut prefix, &mut violations);
        violations
    }

    fn inspect_use_tree(
        &self,
        tree: &UseTree,
        item_use: &ItemUse,
        prefix: &mut Vec<String>,
        violations: &mut Vec<Violation>,
    ) {
        match tree {
            UseTree::Path(UsePath { ident, tree, .. }) => {
                let segment = ident.to_string();
                prefix.push(segment);
                self.inspect_use_tree(tree, item_use, prefix, violations);
                prefix.pop();
            }
            UseTree::Name(name) => {
                prefix.push(name.ident.to_string());
                self.check_full_import_path(prefix, item_use, violations);
                prefix.pop();
            }
            UseTree::Rename(rename) => {
                prefix.push(rename.ident.to_string());
                self.check_full_import_path(prefix, item_use, violations);
                prefix.pop();
            }
            UseTree::Glob(_) => {
                prefix.push("*".to_string());
                self.check_full_import_path(prefix, item_use, violations);
                prefix.pop();
            }
            UseTree::Group(group) => {
                for item in &group.items {
                    self.inspect_use_tree(item, item_use, prefix, violations);
                }
            }
        }
    }

    fn check_full_import_path(
        &self,
        path_segments: &[String],
        item_use: &ItemUse,
        violations: &mut Vec<Violation>,
    ) {
        if path_segments.is_empty() {
            return;
        }

        let root_segment = &path_segments[0];
        let full_path_str = path_segments.join("::");
        let current_layer = self.detect_source_layer();

        // 1. Check std::* dangerous I/O blacklist in pure domain layers
        if root_segment == "std" {
            let is_pure_layer = self.is_domain_crate()
                || current_layer == "domain"
                || current_layer == "core"
                || current_layer == "entities"
                || current_layer == "entity"
                || current_layer == "domain_core";

            if is_pure_layer && path_segments.len() >= 2 {
                let sub_mod = path_segments[1].as_str();
                if matches!(sub_mod, "fs" | "net" | "process" | "os") {
                    violations.push(self.build_violation(
                        "ARCH-001",
                        item_use,
                        &format!(
                            "Domain crate '{}' cannot perform direct I/O via 'std::{}'",
                            self.crate_name, sub_mod
                        ),
                        "Move filesystem/network/process operations to ports traits or infrastructure adapters.",
                    ));
                    return;
                }
            }
            return;
        }

        // 2. Check Tauri framework imports (ARCH-002, ARCH-005, ARCH-001)
        if root_segment == "tauri" {
            if self.is_application_crate()
                || current_layer == "application"
                || current_layer == "usecases"
                || current_layer == "usecase"
                || current_layer == "app"
                || current_layer == "service"
                || current_layer == "services"
                || current_layer == "domain_services"
                || current_layer == "application_services"
            {
                violations.push(self.build_violation(
                    "ARCH-002",
                    item_use,
                    &format!("Application crate '{}' cannot import 'tauri'", self.crate_name),
                    "Pass UI parameters as clean DTOs into application use cases; isolate UI/IPC framework in adapter layer.",
                ));
            } else if !self.is_tauri_authorized_crate() {
                if self.is_domain_crate()
                    || current_layer == "domain"
                    || current_layer == "core"
                    || current_layer == "entities"
                    || current_layer == "entity"
                    || current_layer == "domain_core"
                {
                    violations.push(self.build_violation(
                        "ARCH-001",
                        item_use,
                        &format!("Domain crate '{}' cannot import external framework 'tauri'", self.crate_name),
                        "Move infrastructure dependencies to ports traits or infrastructure adapters.",
                    ));
                } else {
                    violations.push(self.build_violation(
                        "ARCH-005",
                        item_use,
                        &format!("Crate '{}' is not authorized to import 'tauri'", self.crate_name),
                        "Move UI/IPC framework commands and dependencies to authorized adapter layer (e.g. adapters/tauri).",
                    ));
                }
            }
        } else {
            // 3. Pure Whitelist check (fast-path allow)
            const PURE_WHITELIST: &[&str] = &[
                "serde",
                "thiserror",
                "derive_more",
                "bitflags",
                "smallvec",
                "tinyvec",
                "rust_decimal",
                "itertools",
                "unicode_segmentation",
                "unicode_width",
                "strum",
                "strum_macros",
            ];
            let is_in_pure_whitelist = PURE_WHITELIST.contains(&root_segment.as_str());

            // 4. Check matrix-defined forbidden external dependencies (ARCH-001)
            let mut matrix_matched = false;
            if let Some(matrix) = self.matrix {
                if matrix.is_external_dep_forbidden(&current_layer, root_segment) {
                    matrix_matched = true;
                    violations.push(self.build_violation(
                        "ARCH-001",
                        item_use,
                        &format!(
                            "Layer '{}' in crate '{}' forbids external dependency '{}'",
                            current_layer, self.crate_name, root_segment
                        ),
                        "Remove external framework dependency and use abstract ports traits.",
                    ));
                }
            }

            // 5. Capability Fallback for pure domain layers when not matched by matrix
            if !matrix_matched
                && !is_in_pure_whitelist
                && (self.is_domain_crate()
                    || current_layer == "domain"
                    || current_layer == "core"
                    || current_layer == "entities"
                    || current_layer == "entity"
                    || current_layer == "domain_core")
            {
                let default_forbidden_domain = [
                    "tokio",
                    "surrealdb",
                    "reqwest",
                    "hyper",
                    "axum",
                    "actix",
                    "sqlx",
                    "diesel",
                    "sea_orm",
                    "mongodb",
                    "redis",
                    "warp",
                    "tonic",
                    "ureq",
                    "rusqlite",
                    "postgres",
                    "deadpool",
                    "r2d2",
                    "async_std",
                    "smol",
                ];
                let root_lower = root_segment.to_lowercase();
                let is_forbidden_sdk = default_forbidden_domain.contains(&root_lower.as_str());
                let has_io_capability_token = root_lower.contains("http")
                    || root_lower.contains("client")
                    || root_lower.contains("grpc")
                    || root_lower.contains("sql")
                    || root_lower.contains("database")
                    || root_lower.ends_with("_db")
                    || root_lower.contains("orm")
                    || root_lower.contains("runtime");

                if is_forbidden_sdk || has_io_capability_token {
                    violations.push(self.build_violation(
                        "ARCH-001",
                        item_use,
                        &format!(
                            "Domain crate '{}' cannot import external framework or I/O dependency '{}'",
                            self.crate_name, root_segment
                        ),
                        "Move infrastructure dependencies to ports traits or infrastructure adapters.",
                    ));
                }
            }
        }

        // 4. MOD-001: Boundary Capsule / Module Encapsulation violation
        // E.g. importing crate::modules::<other_mod>::internal::*
        let should_check_boundaries = self.matrix.is_none_or(|m| m.enforce_boundaries)
            || path_contains(self.current_file, "modules")
            || self.crate_name.contains("monolith");

        if should_check_boundaries {
            if let Some(mod_violation) =
                self.check_module_boundary_violation(path_segments, item_use)
            {
                violations.push(mod_violation);
            }
        }

        // 5. CQRS-001: Command/Write layer importing Read model or Read DB
        if (current_layer == "commands"
            || current_layer == "command"
            || current_layer == "command_handler"
            || current_layer == "write_service"
            || current_layer == "domain_write"
            || path_contains(self.current_file, "/command/")
            || path_contains(self.current_file, "/write/"))
            && (full_path_str.contains("read_db")
                || full_path_str.contains("query_handler")
                || full_path_str.contains("read_repo")
                || full_path_str.contains("projection")
                || full_path_str.contains("read_model")
                || full_path_str.contains("read_service"))
        {
            violations.push(self.build_violation(
                "CQRS-001",
                item_use,
                &format!(
                    "CQRS boundary violation: Write pipeline at '{}' cannot import Read model '{}'",
                    self.current_file.display(),
                    full_path_str
                ),
                "Isolate Write commands from Read models. Query through dedicated Read repository or event projection.",
            ));
        }

        // 6. EVT-001: Event Producer synchronous call / direct import to Consumer
        if (current_layer == "producer"
            || current_layer == "event_producer"
            || self.crate_name.contains("producer")
            || path_contains(self.current_file, "/producer/"))
            && (full_path_str.contains("consumer") || full_path_str.contains("subscriber"))
        {
            violations.push(self.build_violation(
                "EVT-001",
                item_use,
                &format!(
                    "Event-driven decoupling violation: Producer at '{}' directly imports Consumer '{}'",
                    self.current_file.display(),
                    full_path_str
                ),
                "Producers must only publish events to the EventBus/Broker without knowing consumer implementations.",
            ));
        }

        // 7. ARCH-007: Layer Topology Inversion (when internal intra-crate layer imports are forbidden)
        if violations.is_empty() {
            if let Some(matrix) = self.matrix {
                let target_layer = self.detect_target_layer(path_segments);
                if let Some(target) = target_layer {
                    if target != current_layer
                        && !matrix.is_dependency_allowed(&current_layer, &target)
                    {
                        violations.push(self.build_violation(
                            "ARCH-007",
                            item_use,
                            &format!(
                                "Layer topology violation: layer '{}' is not allowed to depend on layer '{}' (import: '{}')",
                                current_layer, target, full_path_str
                            ),
                            "Refactor code to respect the layer hierarchy defined in the workspace architecture matrix.",
                        ));
                    }
                }
            }
        }
    }

    fn check_module_boundary_violation(
        &self,
        path_segments: &[String],
        item_use: &ItemUse,
    ) -> Option<Violation> {
        let file_path = self.current_file.to_string_lossy().replace('\\', "/");
        let current_module = self.extract_module_name_from_path(&file_path);

        // Check if path accesses `internal` or private submodule of another module
        let mut target_module = None;
        let mut accesses_internal = false;

        for (i, seg) in path_segments.iter().enumerate() {
            if seg == "modules" || seg == "module" {
                if let Some(next_seg) = path_segments.get(i + 1) {
                    target_module = Some(next_seg.clone());
                }
            }
            if seg == "internal" || seg == "private" {
                accesses_internal = true;
            }
        }

        if let Some(target) = target_module {
            if let Some(current) = current_module {
                if current != target && accesses_internal {
                    return Some(self.build_violation(
                        "MOD-001",
                        item_use,
                        &format!(
                            "Module boundary violation: Module '{}' illegally accesses private internal scope of module '{}'",
                            current, target
                        ),
                        &format!(
                            "Access module '{}' exclusively through its public API ('{}/api.rs' or '{}/lib.rs')",
                            target, target, target
                        ),
                    ));
                }
            } else if accesses_internal {
                return Some(self.build_violation(
                    "MOD-001",
                    item_use,
                    &format!(
                        "Module boundary violation: Illegal direct access to internal scope of module '{}'",
                        target
                    ),
                    &format!(
                        "Access module '{}' exclusively through its public API.",
                        target
                    ),
                ));
            }
        }

        None
    }

    fn extract_module_name_from_path(&self, path: &str) -> Option<String> {
        let parts: Vec<&str> = path.split('/').collect();
        for (i, part) in parts.iter().enumerate() {
            if *part == "modules" || *part == "module" {
                if let Some(mod_name) = parts.get(i + 1) {
                    return Some(mod_name.to_string());
                }
            }
        }
        None
    }

    fn detect_source_layer(&self) -> String {
        let file_path = normalize_path(self.current_file);

        if let Some(matrix) = self.matrix {
            let detected = matrix.detect_layer(&file_path, Some(self.crate_name));
            if detected != "unknown" {
                return detected;
            }
        }

        for layer in [
            "domain_write",
            "command_handler",
            "write_service",
            "query_handler",
            "read_service",
            "domain_core",
            "domain_services",
            "application_services",
            "controller",
            "service",
            "repository",
            "entity",
            "usecase",
            "producer",
            "consumer",
            "plugin",
            "core",
            "pages",
            "widgets",
            "features",
            "entities",
            "shared",
            "domain",
            "ports",
            "application",
            "infrastructure",
            "adapter",
            "cli",
            "bff",
        ] {
            if file_path.contains(&format!("/{}/", layer))
                || file_path.contains(&format!("{}/", layer))
                || file_path.contains(&format!("{}-", layer))
                || file_path.contains(&format!("-{}", layer))
                || self.crate_name.contains(layer)
            {
                return layer.to_string();
            }
        }

        "unknown".to_string()
    }

    fn detect_target_layer(&self, path_segments: &[String]) -> Option<String> {
        if path_segments.is_empty() {
            return None;
        }

        // 1. If the last segment is PascalCase (Struct/Trait/Enum/Type), drop it from layer candidates
        let candidates: &[String] = if path_segments.len() > 1
            && path_segments
                .last()
                .is_some_and(|s| s.chars().next().is_some_and(|c| c.is_uppercase()))
        {
            &path_segments[..path_segments.len() - 1]
        } else {
            path_segments
        };

        // 2. Query dynamic LayerTopologyMatrix if present
        if let Some(matrix) = self.matrix {
            for seg in candidates {
                let seg_clean = seg
                    .trim_start_matches("crate::")
                    .trim_start_matches("super::");
                let detected = matrix.detect_layer(seg_clean, Some(seg_clean));
                if detected != "unknown" {
                    return Some(detected);
                }
            }
        }

        // 3. Fallback: well-known architectural layer names
        let full = candidates.join("::").to_lowercase();
        for layer in [
            "command_handler",
            "write_service",
            "query_handler",
            "read_service",
            "domain_core",
            "domain_services",
            "application_services",
            "controller",
            "service",
            "repository",
            "entity",
            "usecase",
            "producer",
            "consumer",
            "plugin_api",
            "plugin",
            "core",
            "pages",
            "widgets",
            "features",
            "entities",
            "shared",
            "domain",
            "ports",
            "application",
            "infrastructure",
            "adapter",
            "cli",
            "bff",
        ] {
            if full.starts_with(&format!("crate::{}::", layer))
                || full.starts_with(&format!("super::{}::", layer))
                || candidates.iter().any(|s| s.to_lowercase() == layer)
            {
                return Some(layer.to_string());
            }
        }
        None
    }

    fn is_domain_crate(&self) -> bool {
        self.crate_name.contains("domain")
            || self.crate_name.contains("core")
            || self.crate_name.contains("entity")
            || self.crate_name.contains("entities")
    }

    fn is_application_crate(&self) -> bool {
        self.crate_name.contains("application")
            || self.crate_name.contains("usecase")
            || self.crate_name.contains("usecases")
            || self.crate_name.contains("service")
            || self.crate_name.contains("services")
    }

    fn is_tauri_authorized_crate(&self) -> bool {
        self.crate_name.contains("adapter")
            || self.crate_name.contains("tauri")
            || path_contains(self.current_file, "adapters/tauri")
            || path_contains(self.current_file, "adapters\\tauri")
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
        let checker = ImportChecker::new(
            Path::new("src/application/use_case.rs"),
            "worldwiki-application",
        );
        let violations = checker.check_use(&item_use);
        assert!(violations.iter().any(|v| v.rule_id == "ARCH-002"));
    }

    #[test]
    fn test_import_checker_unauthorized_tauri_arch005() {
        let code = "use tauri::AppHandle;";
        let item_use: ItemUse = syn::parse_str(code).unwrap();
        let checker =
            ImportChecker::new(Path::new("src/infra/repo.rs"), "worldwiki-infrastructure");
        let violations = checker.check_use(&item_use);
        assert!(violations.iter().any(|v| v.rule_id == "ARCH-005"));
    }

    #[test]
    fn test_import_checker_authorized_tauri_and_group_tree() {
        let code = "use tauri::{AppHandle, Manager};";
        let item_use: ItemUse = syn::parse_str(code).unwrap();
        let checker = ImportChecker::new(
            Path::new("src/adapters/tauri/commands.rs"),
            "worldwiki-tauri",
        );
        let violations = checker.check_use(&item_use);
        assert!(
            violations.is_empty(),
            "Tauri adapter is authorized to import tauri"
        );
    }

    #[test]
    fn test_import_checker_modular_monolith_capsule_mod001() {
        let code = "use crate::modules::billing::internal::SecretVault;";
        let item_use: ItemUse = syn::parse_str(code).unwrap();
        let checker = ImportChecker::new(
            Path::new("src/modules/orders/service.rs"),
            "modular_monolith",
        );
        let violations = checker.check_use(&item_use);
        assert_eq!(violations.len(), 1);
        assert_eq!(violations[0].rule_id, "MOD-001");
    }

    #[test]
    fn test_import_checker_cqrs_and_event_driven() {
        // CQRS Write importing Read model
        let code_cqrs = "use crate::read_db::UserQueryRepository;";
        let item_use_cqrs: ItemUse = syn::parse_str(code_cqrs).unwrap();
        let checker_cqrs = ImportChecker::new(Path::new("src/command/create_user.rs"), "cqrs_app");
        let violations_cqrs = checker_cqrs.check_use(&item_use_cqrs);
        assert!(violations_cqrs.iter().any(|v| v.rule_id == "CQRS-001"));

        // Event-driven Producer importing Consumer
        let code_evt = "use crate::consumer::send_email_handler;";
        let item_use_evt: ItemUse = syn::parse_str(code_evt).unwrap();
        let checker_evt =
            ImportChecker::new(Path::new("src/producer/order_created.rs"), "event_app");
        let violations_evt = checker_evt.check_use(&item_use_evt);
        assert!(violations_evt.iter().any(|v| v.rule_id == "EVT-001"));
    }

    #[test]
    fn test_import_checker_layered_topology_violation_arch007() {
        let matrix = LayerTopologyMatrix::preset_matrix("layered");
        let code = "use crate::repository::UserRepository;";
        let item_use: ItemUse = syn::parse_str(code).unwrap();
        let checker = ImportChecker::new(
            Path::new("src/controller/user_controller.rs"),
            "layered_app",
        )
        .with_matrix(&matrix);

        let violations = checker.check_use(&item_use);
        assert!(violations.iter().any(|v| v.rule_id == "ARCH-007"));
    }

    #[test]
    fn test_import_checker_microkernel_leaf_type_pascal_case_disambiguation() {
        let matrix = LayerTopologyMatrix::preset_matrix("microkernel");
        let code = "use kernel_api::Plugin;";
        let item_use: ItemUse = syn::parse_str(code).unwrap();
        let checker = ImportChecker::new(Path::new("kernel-core/src/lib.rs"), "kernel-core")
            .with_matrix(&matrix);

        let violations = checker.check_use(&item_use);
        assert!(violations.is_empty(), "kernel-core importing trait Plugin from kernel_api must NOT trigger false positive ARCH-007");
    }

    #[test]
    fn test_import_checker_glob_and_rename_and_std_fs() {
        let code_glob = "use std::fs::*;";
        let item_use_glob: ItemUse = syn::parse_str(code_glob).unwrap();
        let checker_domain =
            ImportChecker::new(Path::new("src/domain/model.rs"), "worldwiki-domain");
        let violations = checker_domain.check_use(&item_use_glob);
        assert!(violations.iter().any(|v| v.rule_id == "ARCH-001"));

        let code_rename = "use reqwest::Client as HttpClient;";
        let item_use_rename: ItemUse = syn::parse_str(code_rename).unwrap();
        let violations_rename = checker_domain.check_use(&item_use_rename);
        assert!(violations_rename.iter().any(|v| v.rule_id == "ARCH-001"));

        // Boundary violation when current file is not in a named module (e.g. root lib.rs)
        let code_root = "use crate::modules::billing::internal::SecretKey;";
        let item_use_root: ItemUse = syn::parse_str(code_root).unwrap();
        let checker_root = ImportChecker::new(Path::new("src/lib.rs"), "modular_monolith");
        let violations_root = checker_root.check_use(&item_use_root);
        assert!(violations_root.iter().any(|v| v.rule_id == "MOD-001"));

        // Test unknown layer fallback and super import
        let checker_unknown = ImportChecker::new(Path::new("unknown/path.rs"), "custom_pkg");
        let code_safe = "use serde::Serialize;";
        let item_use_safe: ItemUse = syn::parse_str(code_safe).unwrap();
        let violations_unknown = checker_unknown.check_use(&item_use_safe);
        assert!(violations_unknown.is_empty());

        let code_super = "use super::repository::UserRepository;";
        let item_use_super: ItemUse = syn::parse_str(code_super).unwrap();
        let checker_service =
            ImportChecker::new(Path::new("src/controller/user.rs"), "layered_app");
        let _ = checker_service.check_use(&item_use_super);
    }

    #[test]
    fn test_import_checker_target_layer_detection_and_fallback_closures() {
        let checker = ImportChecker::new(Path::new("src/infra/repo.rs"), "my_crate");

        // Empty segments
        assert_eq!(checker.detect_target_layer(&[]), None);

        // Single lowercase candidate (not PascalCase)
        let single = vec!["domain".to_string()];
        assert_eq!(
            checker.detect_target_layer(&single),
            Some("domain".to_string())
        );

        // crate::domain::MyStruct (fallback matching crate::* prefix and candidates.iter().any)
        let segs = vec![
            "crate".to_string(),
            "domain".to_string(),
            "User".to_string(),
        ];
        assert_eq!(
            checker.detect_target_layer(&segs),
            Some("domain".to_string())
        );

        // super::service::Auth (fallback matching super::* prefix)
        let segs_super = vec![
            "super".to_string(),
            "service".to_string(),
            "Auth".to_string(),
        ];
        assert_eq!(
            checker.detect_target_layer(&segs_super),
            Some("service".to_string())
        );

        // candidates.iter().any matching
        let segs_any = vec!["nested".to_string(), "controller".to_string()];
        assert_eq!(
            checker.detect_target_layer(&segs_any),
            Some("controller".to_string())
        );

        // Unrecognized layer
        let segs_none = vec!["foo".to_string(), "bar".to_string()];
        assert_eq!(checker.detect_target_layer(&segs_none), None);
    }

    #[test]
    fn test_import_checker_source_layer_crate_fallbacks() {
        // Detected layer from crate name
        let checker_dom = ImportChecker::new(Path::new("src/foo.rs"), "domain_core_crate");
        assert_eq!(checker_dom.detect_source_layer(), "domain_core");

        // Detected layer from path
        let checker_app = ImportChecker::new(Path::new("src/application/usecases.rs"), "my_pkg");
        assert_eq!(checker_app.detect_source_layer(), "application");

        // Unknown layer when neither path nor crate contains keywords
        let checker_unk = ImportChecker::new(Path::new("src/unknown.rs"), "custom_pkg");
        assert_eq!(checker_unk.detect_source_layer(), "unknown");
    }

    #[test]
    fn test_import_checker_additional_io_and_cqrs_and_evt_branches() {
        // std::net, std::process, std::os
        for sub in &["net", "process", "os"] {
            let code = format!("use std::{}::TcpStream;", sub);
            let item_use: ItemUse = syn::parse_str(&code).unwrap();
            let checker = ImportChecker::new(Path::new("src/domain/entity.rs"), "worldwiki-domain");
            let violations = checker.check_use(&item_use);
            assert!(violations.iter().any(|v| v.rule_id == "ARCH-001"));
        }

        // CQRS with query_handler, read_repo, projection, read_model, read_service
        for keyword in &[
            "query_handler",
            "read_repo",
            "projection",
            "read_model",
            "read_service",
        ] {
            let code = format!("use crate::infra::{};", keyword);
            let item_use: ItemUse = syn::parse_str(&code).unwrap();
            let checker = ImportChecker::new(Path::new("src/command/handler.rs"), "app");
            let violations = checker.check_use(&item_use);
            assert!(violations.iter().any(|v| v.rule_id == "CQRS-001"));
        }

        // EVT with subscriber
        let code_sub = "use crate::subscriber::order_event;";
        let item_use_sub: ItemUse = syn::parse_str(code_sub).unwrap();
        let checker_evt = ImportChecker::new(Path::new("src/producer/emit.rs"), "producer_crate");
        let violations = checker_evt.check_use(&item_use_sub);
        assert!(violations.iter().any(|v| v.rule_id == "EVT-001"));

        // Boundary with module / private
        let code_priv = "use crate::module::auth::private::Key;";
        let item_use_priv: ItemUse = syn::parse_str(code_priv).unwrap();
        let checker_mod =
            ImportChecker::new(Path::new("src/module/billing/handler.rs"), "monolith");
        let violations_mod = checker_mod.check_use(&item_use_priv);
        assert!(violations_mod.iter().any(|v| v.rule_id == "MOD-001"));
    }
}
