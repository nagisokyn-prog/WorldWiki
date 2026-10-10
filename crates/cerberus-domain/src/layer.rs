use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
pub struct LayerRule {
    #[serde(default, alias = "allowed_deps")]
    pub allowed_dependencies: Vec<String>,
    #[serde(default, alias = "forbidden_external")]
    pub forbidden_external_dependencies: Vec<String>,
    #[serde(default)]
    pub allowed_external: Vec<String>,
    #[serde(default)]
    pub aliases: Vec<String>,
    #[serde(default)]
    pub patterns: Vec<String>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct FrontendArchMetadata {
    #[serde(default)]
    pub aliases: HashMap<String, String>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct WorkspaceArchMetadata {
    #[serde(default)]
    pub preset: Option<String>,
    #[serde(default)]
    pub layers: HashMap<String, LayerRule>,
    #[serde(default)]
    pub frontend: FrontendArchMetadata,
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

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ArchLayer {
    Domain,
    Ports,
    Application,
    Infrastructure,
    Adapter,
    Cli,
    Custom(String),
    Unknown,
}

impl ArchLayer {
    pub fn parse(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "domain" | "core" | "domain_core" => Self::Domain,
            "ports" | "port" => Self::Ports,
            "application" | "app" | "usecase" | "usecases" => Self::Application,
            "infrastructure" | "infra" => Self::Infrastructure,
            "adapter" | "adapters" | "tauri" => Self::Adapter,
            "cli" | "entrypoint" | "bin" => Self::Cli,
            "" | "unknown" => Self::Unknown,
            other => Self::Custom(other.to_string()),
        }
    }

    pub fn as_str(&self) -> &str {
        match self {
            Self::Domain => "domain",
            Self::Ports => "ports",
            Self::Application => "application",
            Self::Infrastructure => "infrastructure",
            Self::Adapter => "adapter",
            Self::Cli => "cli",
            Self::Custom(s) => s.as_str(),
            Self::Unknown => "unknown",
        }
    }

    pub fn can_depend_on(&self, target: ArchLayer) -> bool {
        match self {
            Self::Domain => matches!(target, Self::Domain),
            Self::Ports => matches!(target, Self::Domain | Self::Ports),
            Self::Application => matches!(target, Self::Domain | Self::Ports | Self::Application),
            Self::Infrastructure => matches!(target, Self::Domain | Self::Ports | Self::Infrastructure),
            Self::Adapter | Self::Cli | Self::Custom(_) | Self::Unknown => true,
        }
    }
}

/// Динамическая топологическая матрица слоев архитектуры (Architecture-as-Config)
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LayerTopologyMatrix {
    pub preset_name: String,
    pub allowed_deps: HashMap<String, HashSet<String>>,
    pub forbidden_external: HashMap<String, HashSet<String>>,
    pub allowed_external: HashMap<String, HashSet<String>>,
    pub layer_aliases: HashMap<String, HashSet<String>>,
    pub layer_patterns: HashMap<String, Vec<String>>,
    pub frontend_aliases: HashMap<String, String>,
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

        let mut canonical_layer = l.as_str();
        for (k, aliases) in &self.layer_aliases {
            if aliases.contains(&l) {
                canonical_layer = k.as_str();
                break;
            }
        }

        if let Some(forbidden) = self
            .forbidden_external
            .get(canonical_layer)
            .or_else(|| self.forbidden_external.get(&l))
        {
            if forbidden.contains(&dep) || forbidden.contains("*") {
                return true;
            }
        }

        false
    }

    #[must_use]
    pub fn is_external_dep_allowed(&self, layer: &str, dep_name: &str) -> bool {
        let l = layer.to_lowercase();
        let dep = dep_name.to_lowercase();

        let mut canonical_layer = l.as_str();
        for (k, aliases) in &self.layer_aliases {
            if aliases.contains(&l) {
                canonical_layer = k.as_str();
                break;
            }
        }

        if let Some(forbidden) = self
            .forbidden_external
            .get(canonical_layer)
            .or_else(|| self.forbidden_external.get(&l))
        {
            if forbidden.contains(&dep) || forbidden.contains("*") {
                return false;
            }
        }

        if let Some(allowed) = self
            .allowed_external
            .get(canonical_layer)
            .or_else(|| self.allowed_external.get(&l))
        {
            allowed.contains(&dep) || allowed.contains("*")
        } else {
            true
        }
    }

    #[must_use]
    pub fn detect_layer(&self, file_path: &str, package_name: Option<&str>) -> String {
        let normalized = crate::path_utils::normalize_path_str(file_path);

        // 1. Проверяем точное совпадение имени пакета со слоем или его алиасами
        if let Some(pkg) = package_name {
            let pkg_lower = pkg.to_lowercase();
            for (layer, aliases) in &self.layer_aliases {
                if layer == &pkg_lower || aliases.contains(&pkg_lower) {
                    return layer.clone();
                }
            }
            if self.allowed_deps.contains_key(&pkg_lower) {
                return pkg_lower;
            }
        }

        // 2. Проверяем шаблоны путей (patterns)
        for (layer, patterns) in &self.layer_patterns {
            for pattern in patterns {
                let clean_pattern = pattern.trim_matches('*').trim_matches('/').to_lowercase();
                if !clean_pattern.is_empty() {
                    let seg_marker = format!("/{}/", clean_pattern);
                    let end_marker = format!("/{}", clean_pattern);
                    let start_marker = format!("{}/", clean_pattern);
                    if normalized.contains(&seg_marker)
                        || normalized.ends_with(&end_marker)
                        || normalized.starts_with(&start_marker)
                    {
                        return layer.clone();
                    }
                }
            }
        }

        // 3. Проверяем алиасы по сегментам пути
        for (layer, aliases) in &self.layer_aliases {
            for alias in aliases {
                let marker = format!("/{}/", alias);
                let start_marker = format!("{}/", alias);
                let end_marker = format!("/{}", alias);
                let dash_marker = format!("/{}-", alias);
                let end_dash_marker = format!("-{}/", alias);
                if normalized.contains(&marker)
                    || normalized.starts_with(&start_marker)
                    || normalized.ends_with(&end_marker)
                    || normalized.contains(&end_dash_marker)
                    || normalized.contains(&dash_marker)
                {
                    return layer.clone();
                }
            }
            let marker = format!("/{}/", layer);
            let start_marker = format!("{}/", layer);
            let end_marker = format!("/{}", layer);
            if normalized.contains(&marker)
                || normalized.starts_with(&start_marker)
                || normalized.ends_with(&end_marker)
            {
                return layer.clone();
            }
        }

        // 4. Проверяем известные слои из allowed_deps
        for layer in self.allowed_deps.keys() {
            let marker = format!("/{}/", layer);
            let start_marker = format!("{}/", layer);
            let end_marker = format!("/{}", layer);
            if normalized.contains(&marker)
                || normalized.starts_with(&start_marker)
                || normalized.ends_with(&end_marker)
            {
                return layer.clone();
            }
        }

        "unknown".to_string()
    }

    #[must_use]
    pub fn from_workspace_metadata(meta: &WorkspaceArchMetadata) -> Self {
        let preset_str = meta.preset.as_deref().unwrap_or("hexagonal");
        let mut matrix = Self::preset_matrix(preset_str);

        if meta.enforce_module_boundaries {
            matrix.enforce_boundaries = true;
        }

        for (k, v) in &meta.frontend.aliases {
            matrix.frontend_aliases.insert(k.clone(), v.clone());
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
            matrix.forbidden_external.insert(l_key.clone(), ext_set);

            let mut allow_ext_set = HashSet::new();
            for ext in &rule.allowed_external {
                allow_ext_set.insert(ext.to_lowercase());
            }
            matrix.allowed_external.insert(l_key.clone(), allow_ext_set);

            let mut alias_set = HashSet::new();
            for alias in &rule.aliases {
                alias_set.insert(alias.to_lowercase());
            }
            matrix.layer_aliases.insert(l_key.clone(), alias_set);

            matrix.layer_patterns.insert(l_key, rule.patterns.clone());
        }

        matrix
    }

    #[must_use]
    pub fn preset_matrix(preset: &str) -> Self {
        let p = preset.to_lowercase();
        let mut allowed_deps = HashMap::new();
        let mut forbidden_external = HashMap::new();
        let mut allowed_external = HashMap::new();
        let mut layer_aliases = HashMap::new();
        let mut layer_patterns = HashMap::new();
        let mut frontend_aliases = HashMap::new();
        let mut enforce_boundaries = false;

        // Default frontend aliases
        frontend_aliases.insert("@".into(), "src".into());
        frontend_aliases.insert("~".into(), "src".into());
        frontend_aliases.insert("@components".into(), "packages/components".into());

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

                allowed_external.insert("adapter".into(), ["tauri", "tokio", "reqwest", "sqlx", "*"].into_iter().map(String::from).collect());
                allowed_external.insert("infrastructure".into(), ["*"].into_iter().map(String::from).collect());
                allowed_external.insert("cli".into(), ["*"].into_iter().map(String::from).collect());

                layer_aliases.insert("domain".into(), ["domain", "domain-crate", "core"].into_iter().map(String::from).collect());
                layer_aliases.insert("ports".into(), ["ports", "ports-crate", "port"].into_iter().map(String::from).collect());
                layer_aliases.insert("application".into(), ["application", "app", "application-crate", "usecase", "usecases"].into_iter().map(String::from).collect());
                layer_aliases.insert("infrastructure".into(), ["infrastructure", "infra", "infrastructure-crate"].into_iter().map(String::from).collect());
                layer_aliases.insert("adapter".into(), ["adapter", "adapters", "adapter-tauri", "tauri"].into_iter().map(String::from).collect());
                layer_aliases.insert("cli".into(), ["cli", "bin", "main"].into_iter().map(String::from).collect());

                layer_patterns.insert("domain".into(), vec!["**/domain/**".into(), "**/core/**".into()]);
                layer_patterns.insert("ports".into(), vec!["**/ports/**".into()]);
                layer_patterns.insert("application".into(), vec!["**/application/**".into(), "**/app/**".into()]);
                layer_patterns.insert("infrastructure".into(), vec!["**/infrastructure/**".into(), "**/infra/**".into()]);
                layer_patterns.insert("adapter".into(), vec!["**/adapter/**".into(), "**/adapters/**".into()]);
            }

            // 2. Layered N-Tier (Controller -> Service -> Repository -> Entity)
            "layered" | "n-tier" | "n_tier" => {
                allowed_deps.insert("controller".into(), ["service", "entity", "dto"].into_iter().map(String::from).collect());
                allowed_deps.insert("service".into(), ["repository", "entity", "dto"].into_iter().map(String::from).collect());
                allowed_deps.insert("repository".into(), ["entity", "db"].into_iter().map(String::from).collect());
                allowed_deps.insert("entity".into(), ["entity"].into_iter().map(String::from).collect());

                layer_aliases.insert("controller".into(), ["controller", "controller-crate", "controllers", "web", "api"].into_iter().map(String::from).collect());
                layer_aliases.insert("service".into(), ["service", "service-crate", "services"].into_iter().map(String::from).collect());
                layer_aliases.insert("repository".into(), ["repository", "repository-crate", "repositories", "repo"].into_iter().map(String::from).collect());
                layer_aliases.insert("entity".into(), ["entity", "entity-crate", "entities", "model", "models"].into_iter().map(String::from).collect());

                layer_patterns.insert("controller".into(), vec!["**/controller/**".into(), "**/controllers/**".into()]);
                layer_patterns.insert("service".into(), vec!["**/service/**".into(), "**/services/**".into()]);
                layer_patterns.insert("repository".into(), vec!["**/repository/**".into(), "**/repo/**".into()]);
                layer_patterns.insert("entity".into(), vec!["**/entity/**".into(), "**/entities/**".into()]);

                let mut entity_forbid = HashSet::new();
                for f in ["tauri", "tokio", "surrealdb", "reqwest", "hyper", "axum", "actix", "sqlx"] {
                    entity_forbid.insert(f.into());
                }
                forbidden_external.insert("entity".into(), entity_forbid.clone());
                forbidden_external.insert("entities".into(), entity_forbid);
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

                let mut ent_forbid = HashSet::new();
                for f in ["tauri", "tokio", "surrealdb", "reqwest", "hyper", "axum", "actix", "sqlx"] {
                    ent_forbid.insert(f.into());
                }
                forbidden_external.insert("entities".into(), ent_forbid.clone());
                forbidden_external.insert("entity".into(), ent_forbid);

                let mut uc_forbid = HashSet::new();
                uc_forbid.insert("tauri".into());
                forbidden_external.insert("usecases".into(), uc_forbid.clone());
                forbidden_external.insert("usecase".into(), uc_forbid);

                allowed_external.insert("controllers".into(), ["*"].into_iter().map(String::from).collect());
                allowed_external.insert("gateways".into(), ["*"].into_iter().map(String::from).collect());

                layer_aliases.insert("entities".into(), ["entities", "entity", "entities-crate", "entity-crate", "domain"].into_iter().map(String::from).collect());
                layer_aliases.insert("usecases".into(), ["usecases", "usecase", "usecases-crate", "usecase-crate", "interactor", "application"].into_iter().map(String::from).collect());
                layer_aliases.insert("controllers".into(), ["controllers", "controller", "controllers-crate", "controller-crate", "presenter"].into_iter().map(String::from).collect());
                layer_aliases.insert("gateways".into(), ["gateways", "gateway", "gateway-crate", "database"].into_iter().map(String::from).collect());

                layer_patterns.insert("entities".into(), vec!["**/entities/**".into(), "**/entity/**".into()]);
                layer_patterns.insert("usecases".into(), vec!["**/usecases/**".into(), "**/usecase/**".into()]);
                layer_patterns.insert("controllers".into(), vec!["**/controllers/**".into(), "**/controller/**".into()]);
                layer_patterns.insert("gateways".into(), vec!["**/gateways/**".into(), "**/gateway/**".into()]);
            }

            // 4. Modular Monolith
            "modular_monolith" | "modular-monolith" => {
                enforce_boundaries = true;
                allowed_deps.insert("module".into(), ["module", "module_api", "shared"].into_iter().map(String::from).collect());
                layer_aliases.insert("module".into(), ["monolith-app", "module", "modules"].into_iter().map(String::from).collect());
                layer_patterns.insert("module".into(), vec!["**/modules/**".into()]);
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

                layer_aliases.insert("commands".into(), ["commands", "command", "cqrs-app", "command_handler", "domain_write"].into_iter().map(String::from).collect());
                layer_aliases.insert("queries".into(), ["queries", "query", "query_handler", "projections", "projection"].into_iter().map(String::from).collect());
                layer_aliases.insert("events".into(), ["events", "event"].into_iter().map(String::from).collect());

                layer_patterns.insert("commands".into(), vec!["**/command/**".into(), "**/commands/**".into(), "**/write/**".into()]);
                layer_patterns.insert("queries".into(), vec!["**/query/**".into(), "**/queries/**".into(), "**/projections/**".into()]);
                layer_patterns.insert("events".into(), vec!["**/events/**".into(), "**/event/**".into()]);
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

                layer_aliases.insert("domain_core".into(), ["onion-core", "domain-core", "core", "domain_core", "domain"].into_iter().map(String::from).collect());
                layer_aliases.insert("domain_services".into(), ["onion-services", "onion-service", "domain_service", "domain_services"].into_iter().map(String::from).collect());
                layer_aliases.insert("application_services".into(), ["onion-app", "app_core", "application_services", "application"].into_iter().map(String::from).collect());
                layer_aliases.insert("infrastructure".into(), ["onion-infra", "infra", "infrastructure", "onion_infra"].into_iter().map(String::from).collect());

                layer_patterns.insert("domain_core".into(), vec!["**/domain/**".into(), "**/core/**".into(), "**/domain_core/**".into()]);
                layer_patterns.insert("domain_services".into(), vec!["**/domain_service/**".into(), "**/services/**".into()]);
                layer_patterns.insert("application_services".into(), vec!["**/application/**".into(), "**/app/**".into()]);
                layer_patterns.insert("infrastructure".into(), vec!["**/infra/**".into(), "**/infrastructure/**".into()]);
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

                allowed_external.insert("core".into(), ["*"].into_iter().map(String::from).collect());
                allowed_external.insert("plugin_api".into(), ["*"].into_iter().map(String::from).collect());
                allowed_external.insert("plugin".into(), ["*"].into_iter().map(String::from).collect());

                layer_aliases.insert("core".into(), ["kernel-core", "core", "microkernel"].into_iter().map(String::from).collect());
                layer_aliases.insert("plugin_api".into(), ["kernel-api", "plugin-api", "plugin_api", "core_api", "kernel_api", "kernel-api"].into_iter().map(String::from).collect());
                layer_aliases.insert("plugin".into(), ["kernel-plugin-pdf", "kernel-plugin", "plugin-auth", "plugin-logger", "plugin", "plugins"].into_iter().map(String::from).collect());

                layer_patterns.insert("core".into(), vec!["**/core/**".into()]);
                layer_patterns.insert("plugin_api".into(), vec!["**/plugin_api/**".into(), "**/api/**".into()]);
                layer_patterns.insert("plugin".into(), vec!["**/plugin/**".into(), "**/plugins/**".into()]);
            }

            // 8. Actor System
            "actor" | "actor_system" => {
                let act_deps: HashSet<String> = ["actor", "messages", "protocols"].into_iter().map(String::from).collect();
                allowed_deps.insert("actor".into(), act_deps.clone());
                allowed_deps.insert("worker_actor".into(), act_deps);
                allowed_deps.insert("messages".into(), ["messages"].into_iter().map(String::from).collect());

                allowed_external.insert("actor".into(), ["*"].into_iter().map(String::from).collect());
                allowed_external.insert("messages".into(), ["*"].into_iter().map(String::from).collect());

                layer_aliases.insert("actor".into(), ["actor-app", "actor-system", "actor", "worker_actor"].into_iter().map(String::from).collect());
                layer_aliases.insert("messages".into(), ["messages", "protocols"].into_iter().map(String::from).collect());
            }

            // 9. Serverless / FaaS
            "serverless" | "faas" => {
                let fn_deps: HashSet<String> = ["function", "shared_types", "shared", "client"].into_iter().map(String::from).collect();
                allowed_deps.insert("function".into(), fn_deps.clone());
                allowed_deps.insert("handler".into(), fn_deps);
                allowed_deps.insert("shared_types".into(), ["shared_types", "shared"].into_iter().map(String::from).collect());
                allowed_deps.insert("shared".into(), ["shared_types", "shared"].into_iter().map(String::from).collect());

                allowed_external.insert("function".into(), ["*"].into_iter().map(String::from).collect());
                allowed_external.insert("shared_types".into(), ["*"].into_iter().map(String::from).collect());

                layer_aliases.insert("function".into(), ["faas-app", "function-auth", "function-payment", "function", "handler"].into_iter().map(String::from).collect());
                layer_aliases.insert("shared_types".into(), ["shared-types", "shared_types", "shared"].into_iter().map(String::from).collect());
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

                layer_patterns.insert("app".into(), vec!["**/app/**".into()]);
                layer_patterns.insert("pages".into(), vec!["**/pages/**".into()]);
                layer_patterns.insert("widgets".into(), vec!["**/widgets/**".into()]);
                layer_patterns.insert("features".into(), vec!["**/features/**".into()]);
                layer_patterns.insert("entities".into(), vec!["**/entities/**".into()]);
                layer_patterns.insert("shared".into(), vec!["**/shared/**".into()]);
            }

            // 11. Backend-for-Frontend (BFF)
            "bff" => {
                let bff_deps: HashSet<String> = ["bff", "api_client", "domain_client", "shared_dto"].into_iter().map(String::from).collect();
                allowed_deps.insert("bff".into(), bff_deps.clone());
                allowed_deps.insert("bff_gateway".into(), bff_deps);

                let mut bff_forbid = HashSet::new();
                for f in ["sqlx", "diesel", "sea_orm", "surrealdb", "mongodb"] {
                    bff_forbid.insert(f.into());
                }
                forbidden_external.insert("bff".into(), bff_forbid.clone());
                forbidden_external.insert("bff_gateway".into(), bff_forbid);

                allowed_external.insert("bff".into(), ["*"].into_iter().map(String::from).collect());
                allowed_external.insert("bff_gateway".into(), ["*"].into_iter().map(String::from).collect());

                layer_aliases.insert("bff".into(), ["bff-gateway", "bff", "gateway", "bff_gateway"].into_iter().map(String::from).collect());
                layer_patterns.insert("bff".into(), vec!["**/bff/**".into(), "**/gateway/**".into()]);
            }

            // 12. Event-Driven
            "event_driven" | "event-driven" => {
                let prod_deps: HashSet<String> = ["producer", "events", "event", "broker_client"].into_iter().map(String::from).collect();
                let cons_deps: HashSet<String> = ["consumer", "events", "event", "domain_service"].into_iter().map(String::from).collect();
                let evt_deps: HashSet<String> = ["events", "event"].into_iter().map(String::from).collect();

                allowed_deps.insert("producer".into(), prod_deps);
                allowed_deps.insert("consumer".into(), cons_deps);
                allowed_deps.insert("events".into(), evt_deps.clone());
                allowed_deps.insert("event".into(), evt_deps);

                allowed_external.insert("producer".into(), ["*"].into_iter().map(String::from).collect());
                allowed_external.insert("consumer".into(), ["*"].into_iter().map(String::from).collect());
                allowed_external.insert("events".into(), ["*"].into_iter().map(String::from).collect());

                layer_aliases.insert("producer".into(), ["event-app", "event-producer", "producer"].into_iter().map(String::from).collect());
                layer_aliases.insert("consumer".into(), ["event-consumer", "consumer"].into_iter().map(String::from).collect());
                layer_aliases.insert("events".into(), ["event-contracts", "events", "event"].into_iter().map(String::from).collect());

                layer_patterns.insert("producer".into(), vec!["**/producer/**".into()]);
                layer_patterns.insert("consumer".into(), vec!["**/consumer/**".into()]);
                layer_patterns.insert("events".into(), vec!["**/event/**".into(), "**/events/**".into()]);
            }

            // 13. Final Boss (Composite Mega Monorepo)
            "final_boss" | "final-boss" => {
                enforce_boundaries = true;
                allowed_deps.insert("domain".into(), ["domain", "events"].into_iter().map(String::from).collect());
                allowed_deps.insert("application".into(), ["domain", "events", "ports", "application"].into_iter().map(String::from).collect());
                allowed_deps.insert("ports".into(), ["domain", "events", "ports"].into_iter().map(String::from).collect());
                allowed_deps.insert("commands".into(), ["domain", "events", "ports"].into_iter().map(String::from).collect());
                allowed_deps.insert("queries".into(), ["domain", "events", "projections", "ports"].into_iter().map(String::from).collect());
                allowed_deps.insert("infrastructure".into(), ["ports", "domain", "events", "projections", "commands", "queries", "application", "infrastructure"].into_iter().map(String::from).collect());
                allowed_deps.insert("adapter".into(), ["*"].into_iter().map(String::from).collect());
                allowed_deps.insert("service_auth".into(), ["shared_proto", "shared_types"].into_iter().map(String::from).collect());
                allowed_deps.insert("service_billing".into(), ["shared_proto", "shared_types"].into_iter().map(String::from).collect());
                allowed_deps.insert("service_catalog".into(), ["shared_proto", "shared_types"].into_iter().map(String::from).collect());
                allowed_deps.insert("spa".into(), ["packages_components", "shared_types"].into_iter().map(String::from).collect());
                allowed_deps.insert("packages_components".into(), ["packages_components", "shared_types"].into_iter().map(String::from).collect());

                let mut dom_forbid = HashSet::new();
                for f in ["reqwest", "tokio", "sqlx", "tauri", "surrealdb"] {
                    dom_forbid.insert(f.into());
                }
                forbidden_external.insert("domain".into(), dom_forbid);

                let mut app_forbid = HashSet::new();
                for f in ["tauri", "surrealdb"] {
                    app_forbid.insert(f.into());
                }
                forbidden_external.insert("application".into(), app_forbid);

                let mut infra_forbid = HashSet::new();
                infra_forbid.insert("tauri".into());
                forbidden_external.insert("infrastructure".into(), infra_forbid);

                allowed_external.insert("application".into(), ["*"].into_iter().map(String::from).collect());
                allowed_external.insert("ports".into(), ["*"].into_iter().map(String::from).collect());
                allowed_external.insert("infrastructure".into(), ["*"].into_iter().map(String::from).collect());
                allowed_external.insert("adapter".into(), ["*"].into_iter().map(String::from).collect());
                allowed_external.insert("commands".into(), ["*"].into_iter().map(String::from).collect());
                allowed_external.insert("queries".into(), ["*"].into_iter().map(String::from).collect());

                layer_aliases.insert("service_auth".into(), ["service-auth", "service_auth"].into_iter().map(String::from).collect());
                layer_aliases.insert("service_billing".into(), ["service-billing", "service_billing"].into_iter().map(String::from).collect());
                layer_aliases.insert("service_catalog".into(), ["service-catalog", "service_catalog"].into_iter().map(String::from).collect());
                layer_aliases.insert("domain".into(), ["domain", "core", "domain_service", "domain-service"].into_iter().map(String::from).collect());
                layer_aliases.insert("application".into(), ["application", "app", "application_service", "app_service", "app-service"].into_iter().map(String::from).collect());
                layer_aliases.insert("ports".into(), ["ports", "port", "ports_service", "ports-service"].into_iter().map(String::from).collect());
                layer_aliases.insert("commands".into(), ["commands", "command"].into_iter().map(String::from).collect());
                layer_aliases.insert("queries".into(), ["queries", "query"].into_iter().map(String::from).collect());
                layer_aliases.insert("infrastructure".into(), ["infrastructure", "infra", "infra_service", "infra-service"].into_iter().map(String::from).collect());
                layer_aliases.insert("adapter".into(), ["adapter", "adapters", "adapter_service", "adapter-service"].into_iter().map(String::from).collect());
            }

            _ => {
                allowed_deps.insert("*".into(), ["*"].into_iter().map(String::from).collect());
            }
        }

        Self {
            preset_name: p,
            allowed_deps,
            forbidden_external,
            allowed_external,
            layer_aliases,
            layer_patterns,
            frontend_aliases,
            enforce_boundaries,
        }
    }
}
