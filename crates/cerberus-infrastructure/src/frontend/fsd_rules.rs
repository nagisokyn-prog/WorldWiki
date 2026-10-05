use cerberus_domain::{compute_fingerprint, Category, CerberusConfig, Severity, Violation};
use std::path::Path;

pub struct FsdRulesChecker;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ResolvedLayer {
    pub name: String,
    pub order: u32,
    pub aliases: Vec<String>,
    pub allowed_deps: Vec<String>,
    pub is_orchestrator: bool,
    pub allow_cross_slice: bool,
}

impl ResolvedLayer {
    pub fn matches_segment(&self, segment: &str) -> bool {
        let seg = segment.trim_start_matches('@').trim_start_matches('~').to_lowercase();
        if self.name.to_lowercase() == seg {
            return true;
        }
        for a in &self.aliases {
            if a.to_lowercase() == seg {
                return true;
            }
        }
        false
    }

    pub fn can_import(&self, target: &ResolvedLayer) -> bool {
        if self.name == "unknown" || target.name == "unknown" || self.name == target.name {
            return true;
        }
        if !self.allowed_deps.is_empty() {
            for d in &self.allowed_deps {
                if d == &target.name || d == "*" {
                    return true;
                }
            }
            return false;
        }
        self.order >= target.order
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum FsdLayer {
    Shared = 1,
    Entities = 2,
    Features = 3,
    Widgets = 4,
    Pages = 5,
    App = 6,
    Unknown = 99,
}

impl FsdLayer {
    pub fn parse(path_str: &str) -> Self {
        let layers = build_default_layers();
        if let Some(l) = parse_layer_with_matrix(path_str, &layers) {
            match l.name.as_str() {
                "shared" => Self::Shared,
                "entities" => Self::Entities,
                "features" => Self::Features,
                "widgets" => Self::Widgets,
                "pages" => Self::Pages,
                "app" | "shell" => Self::App,
                _ => Self::Unknown,
            }
        } else {
            Self::Unknown
        }
    }

    pub fn can_import(&self, target: FsdLayer) -> bool {
        if *self == FsdLayer::Unknown || target == FsdLayer::Unknown {
            return true;
        }
        *self >= target
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Shared => "shared",
            Self::Entities => "entities",
            Self::Features => "features",
            Self::Widgets => "widgets",
            Self::Pages => "pages",
            Self::App => "app",
            Self::Unknown => "unknown",
        }
    }
}

pub fn build_default_layers() -> Vec<ResolvedLayer> {
    vec![
        ResolvedLayer {
            name: "shell".into(),
            order: 6,
            aliases: vec![],
            allowed_deps: vec![
                "pages".into(),
                "widgets".into(),
                "features".into(),
                "entities".into(),
                "shared".into(),
                "app".into(),
            ],
            is_orchestrator: true,
            allow_cross_slice: true,
        },
        ResolvedLayer {
            name: "app".into(),
            order: 6,
            aliases: vec!["application".into()],
            allowed_deps: vec![
                "pages".into(),
                "widgets".into(),
                "features".into(),
                "entities".into(),
                "shared".into(),
            ],
            is_orchestrator: true,
            allow_cross_slice: true,
        },
        ResolvedLayer {
            name: "pages".into(),
            order: 5,
            aliases: vec!["page".into(), "views".into(), "view".into(), "screens".into(), "screen".into()],
            allowed_deps: vec![
                "widgets".into(),
                "features".into(),
                "entities".into(),
                "shared".into(),
            ],
            is_orchestrator: false,
            allow_cross_slice: true,
        },
        ResolvedLayer {
            name: "widgets".into(),
            order: 4,
            aliases: vec!["widget".into()],
            allowed_deps: vec!["features".into(), "entities".into(), "shared".into()],
            is_orchestrator: false,
            allow_cross_slice: false,
        },
        ResolvedLayer {
            name: "features".into(),
            order: 3,
            aliases: vec!["feature".into()],
            allowed_deps: vec!["entities".into(), "shared".into()],
            is_orchestrator: false,
            allow_cross_slice: false,
        },
        ResolvedLayer {
            name: "entities".into(),
            order: 2,
            aliases: vec!["entity".into()],
            allowed_deps: vec!["shared".into()],
            is_orchestrator: false,
            allow_cross_slice: false,
        },
        ResolvedLayer {
            name: "shared".into(),
            order: 1,
            aliases: vec![],
            allowed_deps: vec![],
            is_orchestrator: false,
            allow_cross_slice: true,
        },
    ]
}

pub fn resolve_layers_from_config(config: Option<&CerberusConfig>) -> Vec<ResolvedLayer> {
    if let Some(cfg) = config {
        if !cfg.frontend_layers.is_empty() {
            let mut list = Vec::new();
            for (name, layer_cfg) in &cfg.frontend_layers {
                list.push(ResolvedLayer {
                    name: name.clone(),
                    order: layer_cfg.order.unwrap_or(3),
                    aliases: layer_cfg.aliases.clone(),
                    allowed_deps: layer_cfg.allowed_deps.clone(),
                    is_orchestrator: layer_cfg.is_orchestrator,
                    allow_cross_slice: layer_cfg.allow_cross_slice || layer_cfg.is_orchestrator,
                });
            }
            return list;
        }
    }
    build_default_layers()
}

pub fn parse_layer_with_matrix(path_str: &str, matrix: &[ResolvedLayer]) -> Option<ResolvedLayer> {
    let normalized = path_str.replace('\\', "/").to_lowercase();

    let mut is_internal = normalized.starts_with('.')
        || normalized.starts_with('/')
        || normalized.starts_with("@/")
        || normalized.starts_with("~/")
        || normalized.starts_with("src/")
        || normalized.contains("/src/")
        || normalized.contains("apps/")
        || normalized.contains("packages/")
        || normalized.ends_with(".ts")
        || normalized.ends_with(".js")
        || normalized.ends_with(".vue")
        || normalized.ends_with(".css");

    if !is_internal {
        for l in matrix {
            if normalized.starts_with(&format!("{}/", l.name.to_lowercase())) {
                is_internal = true;
                break;
            }
            for a in &l.aliases {
                if normalized.starts_with(&format!("{}/", a.to_lowercase())) {
                    is_internal = true;
                    break;
                }
            }
            if is_internal {
                break;
            }
        }
    }

    if !is_internal {
        return None;
    }

    // First check high-priority orchestrator layers (like shell) if present in path
    for layer in matrix {
        if !layer.is_orchestrator {
            continue;
        }
        let mut matched = normalized.contains(&format!("/{}/", layer.name.to_lowercase()));
        if !matched {
            for a in &layer.aliases {
                if normalized.contains(&format!("/{}/", a.to_lowercase())) {
                    matched = true;
                    break;
                }
            }
        }
        if matched {
            return Some(layer.clone());
        }
    }

    // Then match left-to-right path segments against standard layers
    for segment in normalized.split('/') {
        for layer in matrix {
            if layer.matches_segment(segment) {
                return Some(layer.clone());
            }
        }
    }

    None
}

pub struct ImportSite<'a> {
    pub file: &'a Path,
    pub line: usize,
    pub snippet: &'a str,
    pub target: &'a str,
}

impl FsdRulesChecker {
    pub fn check_source(source: &str, file_path: &Path) -> Vec<Violation> {
        Self::check_source_with_config(source, file_path, None)
    }

    pub fn check_source_with_config(
        source: &str,
        file_path: &Path,
        config: Option<&CerberusConfig>,
    ) -> Vec<Violation> {
        let mut violations = Vec::new();
        let current_path_str = file_path.to_string_lossy();
        let matrix = resolve_layers_from_config(config);
        let current_layer = parse_layer_with_matrix(&current_path_str, &matrix);

        let is_uikit = current_path_str.contains("packages/components")
            || current_path_str.contains("packages\\components")
            || current_path_str.contains("packages/ui")
            || current_path_str.contains("packages\\ui")
            || current_path_str.contains("/ui-kit/")
            || current_path_str.contains("\\ui-kit\\");

        for (line_idx, line) in source.lines().enumerate() {
            let trimmed = line.trim();
            if !trimmed.starts_with("import ") && !trimmed.starts_with("from ") {
                continue;
            }

            let import_target = extract_import_target(trimmed);
            if import_target.is_empty() {
                continue;
            }

            let site = ImportSite {
                file: file_path,
                line: line_idx + 1,
                snippet: trimmed,
                target: &import_target,
            };

            if is_uikit {
                check_uikit_purity(&site, &mut violations);
            }

            let target_layer = parse_layer_with_matrix(&import_target, &matrix);
            if let (Some(cur), Some(tgt)) = (&current_layer, &target_layer) {
                check_resolved_layer_hierarchy(cur, tgt, &site, &mut violations);
                check_resolved_cross_slice(
                    cur,
                    tgt,
                    &current_path_str,
                    &site,
                    &mut violations,
                );
                check_public_api(&site, &mut violations);
            }
        }

        violations
    }
}

fn check_uikit_purity(site: &ImportSite, out: &mut Vec<Violation>) {
    if site.target.contains("stores")
        || site.target.contains("pinia")
        || site.target.contains("@/app")
        || site.target.contains("@/features")
        || site.target.contains("@/entities")
    {
        out.push(Violation {
            rule_id: "FSD-003".into(),
            rule_version: "1.0".into(),
            category: Category::Architecture,
            severity: Severity::Deny,
            file: site.file.to_path_buf(),
            line: site.line,
            column: 1,
            symbol: site.target.to_string(),
            snippet: site.snippet.to_string(),
            message: format!(
                "UI-Kit package cannot import business stores or application layer: '{}'",
                site.target
            ),
            remediation: "Pass data via props and callbacks into pure UI components.".into(),
            fingerprint: compute_fingerprint("FSD-003", "1.0", site.target, site.snippet),
        });
    }
}

fn check_resolved_layer_hierarchy(
    cur: &ResolvedLayer,
    tgt: &ResolvedLayer,
    site: &ImportSite,
    out: &mut Vec<Violation>,
) {
    if !cur.can_import(tgt) {
        out.push(Violation {
            rule_id: "FSD-001".into(),
            rule_version: "1.0".into(),
            category: Category::Architecture,
            severity: Severity::Deny,
            file: site.file.to_path_buf(),
            line: site.line,
            column: 1,
            symbol: site.target.to_string(),
            snippet: site.snippet.to_string(),
            message: format!(
                "FSD Layer Violation: layer '{}' is forbidden from importing from upper layer '{}' ('{}')",
                cur.name,
                tgt.name,
                site.target
            ),
            remediation: "Invert dependency direction: lower layers cannot import from upper layers.".into(),
            fingerprint: compute_fingerprint("FSD-001", "1.0", site.target, site.snippet),
        });
    }
}

fn check_resolved_cross_slice(
    cur_layer: &ResolvedLayer,
    tgt_layer: &ResolvedLayer,
    cur_path: &str,
    site: &ImportSite,
    out: &mut Vec<Violation>,
) {
    if cur_layer.name == tgt_layer.name && !cur_layer.allow_cross_slice && !cur_layer.is_orchestrator {
        let current_slice = extract_slice_name(cur_path, cur_layer);
        let target_slice = extract_slice_name(site.target, tgt_layer);
        if let (Some(cur), Some(tgt)) = (current_slice, target_slice) {
            if cur != tgt {
                out.push(Violation {
                    rule_id: "FSD-004".into(),
                    rule_version: "1.0".into(),
                    category: Category::Architecture,
                    severity: Severity::Deny,
                    file: site.file.to_path_buf(),
                    line: site.line,
                    column: 1,
                    symbol: site.target.to_string(),
                    snippet: site.snippet.to_string(),
                    message: format!(
                        "FSD Cross-Slice Violation: slice '{}' cannot directly depend on sibling slice '{}'",
                        cur, tgt
                    ),
                    remediation: "Compose sibling slices at the widgets or pages level.".into(),
                    fingerprint: compute_fingerprint("FSD-004", "1.0", site.target, site.snippet),
                });
            }
        }
    }
}

fn check_public_api(site: &ImportSite, out: &mut Vec<Violation>) {
    if (site.target.contains("/features/") || site.target.contains("/entities/"))
        && (site.target.contains("/internal/")
            || site.target.contains("/model/")
            || site.target.contains("/ui/"))
    {
        out.push(Violation {
            rule_id: "FSD-002".into(),
            rule_version: "1.0".into(),
            category: Category::Architecture,
            severity: Severity::Deny,
            file: site.file.to_path_buf(),
            line: site.line,
            column: 1,
            symbol: site.target.to_string(),
            snippet: site.snippet.to_string(),
            message: format!(
                "FSD Public API bypass: import '{}' reaches into private internals of slice",
                site.target
            ),
            remediation: "Import from slice public API root (e.g. '@/features/auth') instead of deep internals.".into(),
            fingerprint: compute_fingerprint("FSD-002", "1.0", site.target, site.snippet),
        });
    }
}

fn extract_import_target(line: &str) -> String {
    if let Some(pos) = line.find("from") {
        let rest = line.get(pos + 4..).unwrap_or("").trim();
        let target = rest
            .trim_matches(';')
            .trim()
            .trim_matches('\'')
            .trim_matches('"');
        return target.to_string();
    }
    String::new()
}

fn extract_slice_name(path: &str, layer: &ResolvedLayer) -> Option<String> {
    let normalized = path.replace('\\', "/").to_lowercase();
    let mut markers = vec![format!("{}/", layer.name.to_lowercase())];
    for alias in &layer.aliases {
        markers.push(format!("{}/", alias.to_lowercase()));
    }

    for marker in markers {
        if let Some(idx) = normalized.find(&marker) {
            let rest = normalized.get(idx + marker.len()..).unwrap_or("");
            let slice = rest.split('/').next()?;
            if !slice.is_empty() {
                return Some(slice.to_string());
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn has_rule(violations: &[Violation], rule_id: &str) -> bool {
        for v in violations {
            if v.rule_id == rule_id {
                return true;
            }
        }
        false
    }

    #[test]
    fn test_fsd_layer_methods() {
        assert_eq!(FsdLayer::parse("src/shared/ui/button.vue"), FsdLayer::Shared);
        assert_eq!(FsdLayer::parse("src/entities/user/model.ts"), FsdLayer::Entities);
        assert_eq!(FsdLayer::parse("src/features/auth/ui.vue"), FsdLayer::Features);
        assert_eq!(FsdLayer::parse("src/widgets/header/ui.vue"), FsdLayer::Widgets);
        assert_eq!(FsdLayer::parse("src/pages/home/ui.vue"), FsdLayer::Pages);
        assert_eq!(FsdLayer::parse("src/app/main.ts"), FsdLayer::App);
        assert_eq!(FsdLayer::parse("external-lib"), FsdLayer::Unknown);

        assert_eq!(FsdLayer::Shared.as_str(), "shared");
        assert_eq!(FsdLayer::Entities.as_str(), "entities");
        assert_eq!(FsdLayer::Features.as_str(), "features");
        assert_eq!(FsdLayer::Widgets.as_str(), "widgets");
        assert_eq!(FsdLayer::Pages.as_str(), "pages");
        assert_eq!(FsdLayer::App.as_str(), "app");
        assert_eq!(FsdLayer::Unknown.as_str(), "unknown");

        assert!(FsdLayer::Pages.can_import(FsdLayer::Features));
        assert!(!FsdLayer::Entities.can_import(FsdLayer::Features));
        assert!(FsdLayer::Unknown.can_import(FsdLayer::Shared));
    }

    #[test]
    fn test_fsd_001_layer_violation() {
        let code = "import { LoginButton } from '@/features/auth';";
        let violations = FsdRulesChecker::check_source(code, &PathBuf::from("src/entities/user/index.ts"));
        assert!(has_rule(&violations, "FSD-001"));

        let good = "import { UserAvatar } from '@/entities/user';";
        let violations_good = FsdRulesChecker::check_source(good, &PathBuf::from("src/features/auth/index.ts"));
        assert!(!has_rule(&violations_good, "FSD-001"));
    }

    #[test]
    fn test_fsd_002_public_api_bypass() {
        let code = "import { secretHelper } from '@/features/auth/internal/secret';";
        let violations = FsdRulesChecker::check_source(code, &PathBuf::from("src/pages/home/index.vue"));
        assert!(has_rule(&violations, "FSD-002"));
    }

    #[test]
    fn test_fsd_003_uikit_purity() {
        let code = "import { useUserStore } from '@/entities/user/stores';";
        let violations = FsdRulesChecker::check_source(code, &PathBuf::from("packages/ui/button.vue"));
        assert!(has_rule(&violations, "FSD-003"));
    }

    #[test]
    fn test_fsd_004_cross_slice() {
        let code = "import { cartHelper } from '@/features/cart';";
        let violations = FsdRulesChecker::check_source(code, &PathBuf::from("src/features/auth/index.ts"));
        assert!(has_rule(&violations, "FSD-004"));
    }

    #[test]
    fn test_fsd_custom_config_layers() {
        let mut cfg = CerberusConfig::default();
        let mut layers = std::collections::HashMap::new();
        layers.insert("custom_layer".to_string(), cerberus_domain::FrontendLayerConfig {
            order: Some(2),
            aliases: vec!["custom".into()],
            allowed_deps: vec!["shared".into()],
            is_orchestrator: false,
            allow_cross_slice: false,
        });
        cfg.frontend_layers = layers;

        let resolved = resolve_layers_from_config(Some(&cfg));
        assert_eq!(resolved.len(), 1);
        assert_eq!(resolved[0].name, "custom_layer");
        assert!(resolved[0].matches_segment("custom"));
    }
}
