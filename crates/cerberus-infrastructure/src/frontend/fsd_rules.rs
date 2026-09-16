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
        // Higher layer can import lower layer. Lower layer cannot import higher layer.
        // Self layer cannot import same layer slice (handled separately).
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

impl FsdRulesChecker {
    pub fn check_source(source: &str, file_path: &Path) -> Vec<Violation> {
        let mut violations = Vec::new();
        let current_path_str = file_path.to_string_lossy();
        let current_layer = FsdLayer::parse(&current_path_str);

        let is_uikit_package = current_path_str.contains("packages/components")
            || current_path_str.contains("packages\\components")
            || current_path_str.contains("@worldwiki/components");

        for (line_idx, line) in source.lines().enumerate() {
            let trimmed = line.trim();
            if !trimmed.starts_with("import ") && !trimmed.starts_with("from ") {
                continue;
            }

            // Extract import target path
            let import_target = extract_import_target(trimmed);
            if import_target.is_empty() {
                continue;
            }

            // 1. UI-Kit Purity Check (FSD-003)
            if is_uikit_package
                && (import_target.contains("stores")
                    || import_target.contains("pinia")
                    || import_target.contains("@/app")
                    || import_target.contains("@/features")
                    || import_target.contains("@/entities"))
            {
                let fingerprint = compute_fingerprint(
                    "FSD-003",
                    "1.0",
                    &import_target,
                    trimmed,
                );
                violations.push(Violation {
                    rule_id: "FSD-003".into(),
                    rule_version: "1.0".into(),
                    category: Category::Architecture,
                    severity: Severity::Deny,
                    file: file_path.to_path_buf(),
                    line: line_idx + 1,
                    column: 1,
                    symbol: import_target.clone(),
                    snippet: trimmed.to_string(),
                    message: format!(
                        "UI-Kit package cannot import business stores or application layer: '{}'",
                        import_target
                    ),
                    remediation: "Pass data via props and callbacks into pure UI components.".into(),
                    fingerprint,
                });
            }

            // 2. FSD Layer Hierarchy Check (FSD-001)
            let target_layer = FsdLayer::parse(&import_target);
            if current_layer != FsdLayer::Unknown && target_layer != FsdLayer::Unknown {
                if !current_layer.can_import(target_layer) {
                    let fingerprint = compute_fingerprint(
                        "FSD-001",
                        "1.0",
                        &import_target,
                        trimmed,
                    );
                    violations.push(Violation {
                        rule_id: "FSD-001".into(),
                        rule_version: "1.0".into(),
                        category: Category::Architecture,
                        severity: Severity::Deny,
                        file: file_path.to_path_buf(),
                        line: line_idx + 1,
                        column: 1,
                        symbol: import_target.clone(),
                        snippet: trimmed.to_string(),
                        message: format!(
                            "FSD Layer Violation: layer '{}' is forbidden from importing from upper layer '{}' ('{}')",
                            current_layer.as_str(),
                            target_layer.as_str(),
                            import_target
                        ),
                        remediation: "Invert dependency direction: entities cannot import features/pages/widgets.".into(),
                        fingerprint,
                    });
                }

                // 3. FSD Cross-Slice Direct Dependency (FSD-004)
                if current_layer == target_layer && matches!(current_layer, FsdLayer::Features | FsdLayer::Entities | FsdLayer::Widgets) {
                    let current_slice = extract_slice_name(&current_path_str, current_layer);
                    let target_slice = extract_slice_name(&import_target, target_layer);
                    if let (Some(cur), Some(tgt)) = (current_slice, target_slice) {
                        if cur != tgt {
                            let fingerprint = compute_fingerprint(
                                "FSD-004",
                                "1.0",
                                &import_target,
                                trimmed,
                            );
                            violations.push(Violation {
                                rule_id: "FSD-004".into(),
                                rule_version: "1.0".into(),
                                category: Category::Architecture,
                                severity: Severity::Deny,
                                file: file_path.to_path_buf(),
                                line: line_idx + 1,
                                column: 1,
                                symbol: import_target.clone(),
                                snippet: trimmed.to_string(),
                                message: format!(
                                    "FSD Cross-Slice Violation: slice '{}' cannot directly depend on sibling slice '{}'",
                                    cur, tgt
                                ),
                                remediation: "Compose sibling slices at the widgets or pages level.".into(),
                                fingerprint,
                            });
                        }
                    }
                }

                // 4. FSD Public API Check (FSD-002)
                if (import_target.contains("/features/") || import_target.contains("/entities/"))
                    && (import_target.contains("/internal/") || import_target.contains("/model/") || import_target.contains("/ui/"))
                {
                    let fingerprint = compute_fingerprint(
                        "FSD-002",
                        "1.0",
                        &import_target,
                        trimmed,
                    );
                    violations.push(Violation {
                        rule_id: "FSD-002".into(),
                        rule_version: "1.0".into(),
                        category: Category::Architecture,
                        severity: Severity::Deny,
                        file: file_path.to_path_buf(),
                        line: line_idx + 1,
                        column: 1,
                        symbol: import_target.clone(),
                        snippet: trimmed.to_string(),
                        message: format!(
                            "FSD Public API bypass: import '{}' reaches into private internals of slice",
                            import_target
                        ),
                        remediation: "Import from slice public API root (e.g. '@/features/auth') instead of deep internals.".into(),
                        fingerprint,
                    });
                }
            }
        }

        violations
    }
}

fn extract_import_target(line: &str) -> String {
    if let Some(pos) = line.find("from") {
        let rest = &line[pos + 4..].trim();
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
        let rest = &normalized[idx + marker.len()..];
        let slice = rest.split('/').next()?;
        if !slice.is_empty() {
            return Some(slice.to_string());
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_fsd_layer_parsing() {
        assert_eq!(FsdLayer::parse("src/entities/user/model.ts"), FsdLayer::Entities);
        assert_eq!(FsdLayer::parse("src/features/auth/useAuth.ts"), FsdLayer::Features);
        assert_eq!(FsdLayer::parse("src/widgets/header/Header.vue"), FsdLayer::Widgets);
        assert_eq!(FsdLayer::parse("src/pages/home/Home.vue"), FsdLayer::Pages);
        assert_eq!(FsdLayer::parse("src/shared/ui/button.vue"), FsdLayer::Shared);
        assert_eq!(FsdLayer::parse("src/utils/math.ts"), FsdLayer::Unknown);
    }

    #[test]
    fn test_fsd_violations_detection() {
        let entities_file = Path::new("src/entities/user/useUser.ts");
        let code = r#"
            import { useAuth } from '@/features/auth';
            import { Button } from '@/shared/ui';
            import { secret } from '@/features/auth/internal/secret';
        "#;

        let violations = FsdRulesChecker::check_source(code, entities_file);
        assert_eq!(violations.len(), 3);
        assert_eq!(violations.iter().filter(|v| v.rule_id == "FSD-001").count(), 2);
        assert_eq!(violations.iter().filter(|v| v.rule_id == "FSD-002").count(), 1);
    }

    #[test]
    fn test_fsd_uikit_purity_check() {
        let uikit_file = Path::new("packages/components/src/Button.vue");
        let code = "import { useUserStore } from '@/stores/user';";
        let violations = FsdRulesChecker::check_source(code, uikit_file);
        assert_eq!(violations.len(), 1);
        assert_eq!(violations[0].rule_id, "FSD-003");
    }

    #[test]
    fn test_fsd_cross_slice_dependency_check() {
        let feature_auth = Path::new("src/features/auth/useAuth.ts");
        let code = "import { getCart } from '@/features/cart';";
        let violations = FsdRulesChecker::check_source(code, feature_auth);
        assert_eq!(violations.len(), 1);
        assert_eq!(violations[0].rule_id, "FSD-004");
    }
}
