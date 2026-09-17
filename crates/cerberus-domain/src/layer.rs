use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
pub struct LayerRule {
    #[serde(default)]
    pub allowed_dependencies: Vec<String>,
    #[serde(default)]
    pub forbidden_external_dependencies: Vec<String>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct WorkspaceArchMetadata {
    #[serde(default)]
    pub preset: Option<String>,
    #[serde(default)]
    pub layers: HashMap<String, LayerRule>,
    #[serde(default)]
    pub enforce_module_boundaries: bool,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct PackageArchMetadata {
    #[serde(default)]
    pub layer: Option<String>,
    #[serde(default)]
    pub ignore: Vec<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ArchLayer {
    Domain,
    Ports,
    Application,
    Infrastructure,
    Adapter,
    Cli,
    Unknown,
}

impl ArchLayer {
    pub fn parse(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "domain" => Self::Domain,
            "ports" | "port" => Self::Ports,
            "application" | "app" | "usecase" | "usecases" => Self::Application,
            "infrastructure" | "infra" => Self::Infrastructure,
            "adapter" | "adapters" | "tauri" => Self::Adapter,
            "cli" | "entrypoint" | "bin" => Self::Cli,
            _ => Self::Unknown,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Domain => "domain",
            Self::Ports => "ports",
            Self::Application => "application",
            Self::Infrastructure => "infrastructure",
            Self::Adapter => "adapter",
            Self::Cli => "cli",
            Self::Unknown => "unknown",
        }
    }

    pub fn can_depend_on(&self, target: ArchLayer) -> bool {
        match self {
            Self::Domain => matches!(target, Self::Domain),
            Self::Ports => matches!(target, Self::Domain | Self::Ports),
            Self::Application => matches!(target, Self::Domain | Self::Ports | Self::Application),
            Self::Infrastructure => matches!(target, Self::Domain | Self::Ports | Self::Infrastructure),
            Self::Adapter | Self::Cli => true,
            Self::Unknown => true,
        }
    }
}

/// Динамическая топологическая матрица слоев архитектуры (Architecture-as-Config)
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LayerTopologyMatrix {
    pub preset_name: String,
    pub allowed_deps: HashMap<String, HashSet<String>>,
    pub forbidden_external: HashMap<String, HashSet<String>>,
    pub enforce_boundaries: bool,
}

impl Default for LayerTopologyMatrix {
    fn default() -> Self {
        Self::preset_matrix("hexagonal")
    }
}

impl LayerTopologyMatrix {
    #[must_use]
    pub fn is_dependency_allowed(&self, source_layer: &str, target_layer: &str) -> bool {
        let src = source_layer.to_lowercase();
        let tgt = target_layer.to_lowercase();

        if src == tgt || src == "unknown" || tgt == "unknown" {
            return true;
        }

        if let Some(allowed) = self.allowed_deps.get(&src) {
            allowed.contains(&tgt) || allowed.contains("*")
        } else {
            // Если слой не задан в конфиге, по умолчанию разрешаем (opt-in restrictions)
            true
        }
    }

    #[must_use]
    pub fn is_external_dep_forbidden(&self, layer: &str, dep_name: &str) -> bool {
        let l = layer.to_lowercase();
        let dep = dep_name.to_lowercase();

        if let Some(forbidden) = self.forbidden_external.get(&l) {
            forbidden.contains(&dep) || forbidden.contains("*")
        } else {
            false
        }
    }

    #[must_use]
    pub fn from_workspace_metadata(meta: &WorkspaceArchMetadata) -> Self {
        let preset_str = meta.preset.as_deref().unwrap_or("hexagonal");
        let mut matrix = Self::preset_matrix(preset_str);

        if meta.enforce_module_boundaries {
            matrix.enforce_boundaries = true;
        }

        for (layer_name, rule) in &meta.layers {
            let l_key = layer_name.to_lowercase();
            let mut set = HashSet::new();
            for dep in &rule.allowed_dependencies {
                set.insert(dep.to_lowercase());
            }
            matrix.allowed_deps.insert(l_key.clone(), set);

            let mut ext_set = HashSet::new();
            for ext in &rule.forbidden_external_dependencies {
                ext_set.insert(ext.to_lowercase());
            }
            matrix.forbidden_external.insert(l_key, ext_set);
        }

        matrix
    }

    #[must_use]
    pub fn preset_matrix(preset: &str) -> Self {
        let p = preset.to_lowercase();
        let mut allowed_deps = HashMap::new();
        let mut forbidden_external = HashMap::new();
        let mut enforce_boundaries = false;

        match p.as_str() {
            // 1. Hexagonal (Default)
            "hexagonal" | "ports_and_adapters" => {
                let dom: HashSet<String> = ["domain"].into_iter().map(String::from).collect();
                let ports: HashSet<String> = ["domain", "ports"].into_iter().map(String::from).collect();
                let app: HashSet<String> = ["domain", "ports", "application"].into_iter().map(String::from).collect();
                let infra: HashSet<String> = ["domain", "ports", "infrastructure"].into_iter().map(String::from).collect();
                let adapter: HashSet<String> = ["domain", "ports", "application", "infrastructure", "adapter"].into_iter().map(String::from).collect();
                let cli: HashSet<String> = ["*"].into_iter().map(String::from).collect();

                allowed_deps.insert("domain".into(), dom);
                allowed_deps.insert("ports".into(), ports);
                allowed_deps.insert("application".into(), app);
                allowed_deps.insert("infrastructure".into(), infra);
                allowed_deps.insert("adapter".into(), adapter);
                allowed_deps.insert("cli".into(), cli);

                let mut dom_forbid = HashSet::new();
                for f in ["tauri", "tokio", "surrealdb", "reqwest", "hyper", "axum", "actix", "sqlx"] {
                    dom_forbid.insert(f.into());
                }
                forbidden_external.insert("domain".into(), dom_forbid);
            }

            // 2. Layered N-Tier (Controller -> Service -> Repository -> Entity)
            "layered" | "n-tier" | "n_tier" => {
                allowed_deps.insert("controller".into(), ["service", "entity", "dto"].into_iter().map(String::from).collect());
                allowed_deps.insert("service".into(), ["repository", "entity", "dto"].into_iter().map(String::from).collect());
                allowed_deps.insert("repository".into(), ["entity", "db"].into_iter().map(String::from).collect());
                allowed_deps.insert("entity".into(), ["entity"].into_iter().map(String::from).collect());
            }

            // 3. Clean Architecture (Entities <- UseCases <- Controllers/Gateways)
            "clean" | "clean_architecture" => {
                let ent_deps: HashSet<String> = ["entities", "entity"].into_iter().map(String::from).collect();
                let uc_deps: HashSet<String> = ["entities", "entity", "usecases", "usecase"].into_iter().map(String::from).collect();
                let ctrl_deps: HashSet<String> = ["usecases", "usecase", "entities", "entity", "controllers", "controller"].into_iter().map(String::from).collect();
                let gtw_deps: HashSet<String> = ["usecases", "usecase", "entities", "entity", "gateways", "gateway"].into_iter().map(String::from).collect();

                allowed_deps.insert("entities".into(), ent_deps.clone());
                allowed_deps.insert("entity".into(), ent_deps);
                allowed_deps.insert("usecases".into(), uc_deps.clone());
                allowed_deps.insert("usecase".into(), uc_deps);
                allowed_deps.insert("controllers".into(), ctrl_deps.clone());
                allowed_deps.insert("controller".into(), ctrl_deps);
                allowed_deps.insert("gateways".into(), gtw_deps.clone());
                allowed_deps.insert("gateway".into(), gtw_deps);
            }

            // 4. Modular Monolith
            "modular_monolith" | "modular-monolith" => {
                enforce_boundaries = true;
                allowed_deps.insert("module".into(), ["module_api", "shared"].into_iter().map(String::from).collect());
            }

            // 5. CQRS & Event Sourcing
            "cqrs" | "cqrs_es" => {
                let cmd_deps: HashSet<String> = ["commands", "command", "command_handler", "domain_write", "domain", "events", "event"].into_iter().map(String::from).collect();
                let qry_deps: HashSet<String> = ["queries", "query", "query_handler", "projections", "projection", "events", "event"].into_iter().map(String::from).collect();
                let evt_deps: HashSet<String> = ["events", "event"].into_iter().map(String::from).collect();

                allowed_deps.insert("commands".into(), cmd_deps.clone());
                allowed_deps.insert("command".into(), cmd_deps.clone());
                allowed_deps.insert("command_handler".into(), cmd_deps.clone());
                allowed_deps.insert("domain_write".into(), cmd_deps);

                allowed_deps.insert("queries".into(), qry_deps.clone());
                allowed_deps.insert("query".into(), qry_deps.clone());
                allowed_deps.insert("query_handler".into(), qry_deps);

                allowed_deps.insert("events".into(), evt_deps.clone());
                allowed_deps.insert("event".into(), evt_deps);
            }

            // 6. Onion Architecture (Core Zero-Dep)
            "onion" => {
                let core_deps: HashSet<String> = ["domain", "domain_core"].into_iter().map(String::from).collect();
                let svc_deps: HashSet<String> = ["domain", "domain_core", "domain_service", "domain_services"].into_iter().map(String::from).collect();
                let app_deps: HashSet<String> = ["domain", "domain_core", "domain_service", "domain_services", "app_core", "application_services", "application"].into_iter().map(String::from).collect();
                let infra_deps: HashSet<String> = ["domain", "domain_core", "domain_service", "domain_services", "app_core", "application_services", "application", "infra", "infrastructure"].into_iter().map(String::from).collect();

                allowed_deps.insert("domain".into(), core_deps.clone());
                allowed_deps.insert("domain_core".into(), core_deps);
                allowed_deps.insert("domain_service".into(), svc_deps.clone());
                allowed_deps.insert("domain_services".into(), svc_deps);
                allowed_deps.insert("app_core".into(), app_deps.clone());
                allowed_deps.insert("application_services".into(), app_deps.clone());
                allowed_deps.insert("application".into(), app_deps);
                allowed_deps.insert("infra".into(), infra_deps.clone());
                allowed_deps.insert("infrastructure".into(), infra_deps);

                let mut core_forbid = HashSet::new();
                for f in ["tokio", "serde_json", "chrono", "reqwest", "sqlx"] {
                    core_forbid.insert(f.into());
                }
                forbidden_external.insert("domain".into(), core_forbid.clone());
                forbidden_external.insert("domain_core".into(), core_forbid);
            }

            // 7. Microkernel / Plugins
            "microkernel" | "plugin" => {
                enforce_boundaries = true;
                let core_deps: HashSet<String> = ["core", "plugin_api", "core_api"].into_iter().map(String::from).collect();
                let api_deps: HashSet<String> = ["plugin_api", "core_api"].into_iter().map(String::from).collect();
                let plugin_deps: HashSet<String> = ["plugin_api", "core_api"].into_iter().map(String::from).collect();

                allowed_deps.insert("core".into(), core_deps);
                allowed_deps.insert("plugin_api".into(), api_deps.clone());
                allowed_deps.insert("core_api".into(), api_deps);
                allowed_deps.insert("plugin".into(), plugin_deps);
            }

            // 8. Actor System
            "actor" | "actor_system" => {
                let act_deps: HashSet<String> = ["messages", "protocols"].into_iter().map(String::from).collect();
                allowed_deps.insert("actor".into(), act_deps.clone());
                allowed_deps.insert("worker_actor".into(), act_deps);
                allowed_deps.insert("messages".into(), ["messages"].into_iter().map(String::from).collect());
            }

            // 9. Serverless / FaaS
            "serverless" | "faas" => {
                let fn_deps: HashSet<String> = ["shared_types", "shared", "client"].into_iter().map(String::from).collect();
                allowed_deps.insert("function".into(), fn_deps.clone());
                allowed_deps.insert("handler".into(), fn_deps);
                allowed_deps.insert("shared_types".into(), ["shared_types", "shared"].into_iter().map(String::from).collect());
                allowed_deps.insert("shared".into(), ["shared_types", "shared"].into_iter().map(String::from).collect());
            }

            // 10. Vue Feature-Sliced Design
            "vue_fsd" | "fsd" => {
                enforce_boundaries = true;
                allowed_deps.insert("app".into(), ["pages", "widgets", "features", "entities", "shared"].into_iter().map(String::from).collect());
                allowed_deps.insert("pages".into(), ["widgets", "features", "entities", "shared"].into_iter().map(String::from).collect());
                allowed_deps.insert("widgets".into(), ["features", "entities", "shared"].into_iter().map(String::from).collect());
                allowed_deps.insert("features".into(), ["entities", "shared"].into_iter().map(String::from).collect());
                allowed_deps.insert("entities".into(), ["shared"].into_iter().map(String::from).collect());
                allowed_deps.insert("shared".into(), ["shared"].into_iter().map(String::from).collect());
            }

            // 11. Backend-for-Frontend (BFF)
            "bff" => {
                let bff_deps: HashSet<String> = ["api_client", "domain_client", "shared_dto"].into_iter().map(String::from).collect();
                allowed_deps.insert("bff".into(), bff_deps.clone());
                allowed_deps.insert("bff_gateway".into(), bff_deps);

                let mut bff_forbid = HashSet::new();
                for f in ["sqlx", "diesel", "sea_orm", "surrealdb", "mongodb"] {
                    bff_forbid.insert(f.into());
                }
                forbidden_external.insert("bff".into(), bff_forbid.clone());
                forbidden_external.insert("bff_gateway".into(), bff_forbid);
            }

            // 12. Event-Driven
            "event_driven" | "event-driven" => {
                let prod_deps: HashSet<String> = ["events", "event", "broker_client"].into_iter().map(String::from).collect();
                let cons_deps: HashSet<String> = ["events", "event", "domain_service"].into_iter().map(String::from).collect();
                let evt_deps: HashSet<String> = ["events", "event"].into_iter().map(String::from).collect();

                allowed_deps.insert("producer".into(), prod_deps);
                allowed_deps.insert("consumer".into(), cons_deps);
                allowed_deps.insert("events".into(), evt_deps.clone());
                allowed_deps.insert("event".into(), evt_deps);
            }

            // 13. Final Boss (Composite Mega Monorepo)
            "final_boss" | "final-boss" => {
                enforce_boundaries = true;
                allowed_deps.insert("domain".into(), ["domain", "events"].into_iter().map(String::from).collect());
                allowed_deps.insert("commands".into(), ["domain", "events", "ports"].into_iter().map(String::from).collect());
                allowed_deps.insert("queries".into(), ["events", "projections", "ports"].into_iter().map(String::from).collect());
                allowed_deps.insert("infrastructure".into(), ["ports", "domain", "events", "projections"].into_iter().map(String::from).collect());
                allowed_deps.insert("service_auth".into(), ["shared_proto", "shared_types"].into_iter().map(String::from).collect());
                allowed_deps.insert("service_billing".into(), ["shared_proto", "shared_types"].into_iter().map(String::from).collect());
                allowed_deps.insert("service_catalog".into(), ["shared_proto", "shared_types"].into_iter().map(String::from).collect());
                allowed_deps.insert("spa".into(), ["packages_components", "shared_types"].into_iter().map(String::from).collect());
                allowed_deps.insert("packages_components".into(), ["packages_components", "shared_types"].into_iter().map(String::from).collect());
            }

            _ => {
                allowed_deps.insert("*".into(), ["*"].into_iter().map(String::from).collect());
            }
        }

        Self {
            preset_name: p,
            allowed_deps,
            forbidden_external,
            enforce_boundaries,
        }
    }
}
