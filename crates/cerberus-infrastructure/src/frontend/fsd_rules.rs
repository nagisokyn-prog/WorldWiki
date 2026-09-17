use cerberus_domain::{compute_fingerprint, Category, Severity, Violation};
use std::path::Path;

pub struct FsdRulesChecker;

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
        let normalized = path_str.replace('\\', "/").to_lowercase();
        if normalized.contains("/shared/") || normalized.starts_with("shared/") {
            Self::Shared
        } else if normalized.contains("/entities/") || normalized.starts_with("entities/") {
            Self::Entities
        } else if normalized.contains("/features/") || normalized.starts_with("features/") {
            Self::Features
        } else if normalized.contains("/widgets/") || normalized.starts_with("widgets/") {
            Self::Widgets
        } else if normalized.contains("/pages/") || normalized.starts_with("pages/") {
            Self::Pages
        } else if normalized.contains("/app/") || normalized.starts_with("app/") {
            Self::App
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

pub struct ImportSite<'a> {
    pub file: &'a Path,
    pub line: usize,
    pub snippet: &'a str,
    pub target: &'a str,
}

impl FsdRulesChecker {
    pub fn check_source(source: &str, file_path: &Path) -> Vec<Violation> {
        let mut violations = Vec::new();
        let current_path_str = file_path.to_string_lossy();
        let current_layer = FsdLayer::parse(&current_path_str);

        let is_uikit = current_path_str.contains("packages/components")
            || current_path_str.contains("packages\\components")
            || current_path_str.contains("@worldwiki/components");

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

            let target_layer = FsdLayer::parse(&import_target);
            if current_layer != FsdLayer::Unknown && target_layer != FsdLayer::Unknown {
                check_layer_hierarchy(current_layer, target_layer, &site, &mut violations);
                check_cross_slice(current_layer, target_layer, &current_path_str, &site, &mut violations);
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
            message: format!("UI-Kit package cannot import business stores or application layer: '{}'", site.target),
            remediation: "Pass data via props and callbacks into pure UI components.".into(),
            fingerprint: compute_fingerprint("FSD-003", "1.0", site.target, site.snippet),
        });
    }
}

fn check_layer_hierarchy(
    cur: FsdLayer,
    tgt: FsdLayer,
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
                cur.as_str(),
                tgt.as_str(),
                site.target
            ),
            remediation: "Invert dependency direction: entities cannot import features/pages/widgets.".into(),
            fingerprint: compute_fingerprint("FSD-001", "1.0", site.target, site.snippet),
        });
    }
}

fn check_cross_slice(
    cur_layer: FsdLayer,
    tgt_layer: FsdLayer,
    cur_path: &str,
    site: &ImportSite,
    out: &mut Vec<Violation>,
) {
    if cur_layer == tgt_layer && matches!(cur_layer, FsdLayer::Features | FsdLayer::Entities | FsdLayer::Widgets) {
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
                    message: format!("FSD Cross-Slice Violation: slice '{}' cannot directly depend on sibling slice '{}'", cur, tgt),
                    remediation: "Compose sibling slices at the widgets or pages level.".into(),
                    fingerprint: compute_fingerprint("FSD-004", "1.0", site.target, site.snippet),
                });
            }
        }
    }
}

fn check_public_api(site: &ImportSite, out: &mut Vec<Violation>) {
    if (site.target.contains("/features/") || site.target.contains("/entities/"))
        && (site.target.contains("/internal/") || site.target.contains("/model/") || site.target.contains("/ui/"))
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
            message: format!("FSD Public API bypass: import '{}' reaches into private internals of slice", site.target),
            remediation: "Import from slice public API root (e.g. '@/features/auth') instead of deep internals.".into(),
            fingerprint: compute_fingerprint("FSD-002", "1.0", site.target, site.snippet),
        });
    }
}

fn extract_import_target(line: &str) -> String {
    if let Some(pos) = line.find("from") {
        let rest = line.get(pos + 4..).unwrap_or("").trim();
        let target = rest.trim_matches(';').trim().trim_matches('\'').trim_matches('"');
        return target.to_string();
    }
    String::new()
}

fn extract_slice_name(path: &str, layer: FsdLayer) -> Option<String> {
    let layer_str = layer.as_str();
    let normalized = path.replace('\\', "/");
    let marker = format!("{}/", layer_str);
    if let Some(idx) = normalized.find(&marker) {
        let rest = normalized.get(idx + marker.len()..).unwrap_or("");
        let slice = rest.split('/').next()?;
        if !slice.is_empty() {
            return Some(slice.to_string());
        }
    }
    None
}
