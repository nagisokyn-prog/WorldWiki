use std::path::PathBuf;
use syn::visit::{self, Visit};
use syn::{ExprMethodCall, File};

use super::context::BevyScanContext;
use super::helpers::expr_to_path_string;
use cerberus_domain::{compute_fingerprint, Category, RuleDefinition, Severity, Violation};

pub struct BevyApiChecker<'a> {
    file_path: &'a str,
    rules: &'a [RuleDefinition],
    ctx: &'a BevyScanContext,
}

impl<'a> BevyApiChecker<'a> {
    pub fn new(file_path: &'a str, rules: &'a [RuleDefinition], ctx: &'a BevyScanContext) -> Self {
        Self {
            file_path,
            rules,
            ctx,
        }
    }

    pub fn check_file(&self, syntax: &File) -> Vec<Violation> {
        if !self.ctx.is_bevy_project {
            return Vec::new();
        }

        let mut violations = Vec::new();
        let mut visitor = ApiVisitor {
            checker: self,
            violations: &mut violations,
        };
        visitor.visit_file(syntax);
        violations
    }

    fn is_rule_enabled(&self, rule_id: &str) -> bool {
        for r in self.rules {
            if r.id == rule_id {
                return r.severity != Severity::Off;
            }
        }
        true
    }

    fn get_severity(&self, rule_id: &str, default: Severity) -> Severity {
        for r in self.rules {
            if r.id == rule_id {
                return r.severity;
            }
        }
        default
    }
}

struct ApiVisitor<'a, 'b> {
    checker: &'a BevyApiChecker<'a>,
    violations: &'b mut Vec<Violation>,
}

impl<'a, 'b, 'ast> Visit<'ast> for ApiVisitor<'a, 'b> {
    fn visit_expr_method_call(&mut self, node: &'ast ExprMethodCall) {
        let method = node.method.to_string();

        match method.as_str() {
            "add_system" if self.checker.is_rule_enabled("BEVY-API-001") => {
                let snippet = quote::quote!(#node).to_string();
                let fp = compute_fingerprint("BEVY-API-001", "1.0", "add_system", &snippet);
                self.violations.push(Violation {
                    rule_id: "BEVY-API-001".into(),
                    rule_version: "1.0".into(),
                    category: Category::BevyApi,
                    severity: self.checker.get_severity("BEVY-API-001", Severity::Deny),
                    file: PathBuf::from(self.checker.file_path),
                    line: 1,
                    column: 1,
                    symbol: "add_system".into(),
                    message: "app.add_system() was removed in Bevy 0.11. Use app.add_systems(Update, system).".into(),
                    snippet,
                    remediation: "Replace app.add_system(f) with app.add_systems(Update, f).".into(),
                    fingerprint: fp,
                });
            }
            "add_startup_system" if self.checker.is_rule_enabled("BEVY-API-002") => {
                let snippet = quote::quote!(#node).to_string();
                let fp = compute_fingerprint("BEVY-API-002", "1.0", "add_startup_system", &snippet);
                self.violations.push(Violation {
                    rule_id: "BEVY-API-002".into(),
                    rule_version: "1.0".into(),
                    category: Category::BevyApi,
                    severity: self.checker.get_severity("BEVY-API-002", Severity::Deny),
                    file: PathBuf::from(self.checker.file_path),
                    line: 1,
                    column: 1,
                    symbol: "add_startup_system".into(),
                    message: "app.add_startup_system() was removed in Bevy 0.11. Use app.add_systems(Startup, system).".into(),
                    snippet,
                    remediation: "Replace app.add_startup_system(f) with app.add_systems(Startup, f).".into(),
                    fingerprint: fp,
                });
            }
            "insert_bundle" if self.checker.is_rule_enabled("BEVY-API-004") => {
                let snippet = quote::quote!(#node).to_string();
                let fp = compute_fingerprint("BEVY-API-004", "1.0", "insert_bundle", &snippet);
                self.violations.push(Violation {
                    rule_id: "BEVY-API-004".into(),
                    rule_version: "1.0".into(),
                    category: Category::BevyApi,
                    severity: self.checker.get_severity("BEVY-API-004", Severity::Warn),
                    file: PathBuf::from(self.checker.file_path),
                    line: 1,
                    column: 1,
                    symbol: "insert_bundle".into(),
                    message: "insert_bundle() was removed in Bevy 0.12. Pass components as a tuple into spawn().".into(),
                    snippet,
                    remediation: "Use commands.spawn((A, B, C)) instead of spawn().insert_bundle(Bundle).".into(),
                    fingerprint: fp,
                });
            }
            "add_plugin" if self.checker.is_rule_enabled("BEVY-API-005") => {
                let snippet = quote::quote!(#node).to_string();
                let fp = compute_fingerprint("BEVY-API-005", "1.0", "add_plugin", &snippet);
                self.violations.push(Violation {
                    rule_id: "BEVY-API-005".into(),
                    rule_version: "1.0".into(),
                    category: Category::BevyApi,
                    severity: self.checker.get_severity("BEVY-API-005", Severity::Deny),
                    file: PathBuf::from(self.checker.file_path),
                    line: 1,
                    column: 1,
                    symbol: "add_plugin".into(),
                    message: "app.add_plugin() was removed in Bevy 0.12. Use app.add_plugins().".into(),
                    snippet,
                    remediation: "Replace app.add_plugin(MyPlugin) with app.add_plugins(MyPlugin).".into(),
                    fingerprint: fp,
                });
            }
            "send" if self.checker.is_rule_enabled("BEVY-API-003") && self.checker.ctx.is_version_at_least(0, 16) => {
                if let Some(recv) = expr_to_path_string(&node.receiver) {
                    let recv_lower = recv.to_lowercase();
                    if recv_lower.contains("event") || recv_lower.contains("writer") {
                        let snippet = quote::quote!(#node).to_string();
                        let fp = compute_fingerprint("BEVY-API-003", "1.0", "event_send", &snippet);
                        self.violations.push(Violation {
                            rule_id: "BEVY-API-003".into(),
                            rule_version: "1.0".into(),
                            category: Category::BevyApi,
                            severity: self.checker.get_severity("BEVY-API-003", Severity::Deny),
                            file: PathBuf::from(self.checker.file_path),
                            line: 1,
                            column: 1,
                            symbol: "send".into(),
                            message: "EventWriter::send() was renamed to write() in Bevy 0.16.".into(),
                            snippet,
                            remediation: "Replace event_writer.send(...) with event_writer.write(...).".into(),
                            fingerprint: fp,
                        });
                    }
                }
            }
            _ => {}
        }

        visit::visit_expr_method_call(self, node);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use indoc::indoc;

    fn has_rule(violations: &[Violation], rule_id: &str) -> bool {
        for v in violations {
            if v.rule_id == rule_id {
                return true;
            }
        }
        false
    }

    fn check_code(code: &str, version: Option<semver::Version>) -> Vec<Violation> {
        let file: syn::File = syn::parse_str(code).unwrap();
        let ctx = BevyScanContext {
            is_bevy_project: true,
            bevy_version: Some(version.unwrap_or_else(|| semver::Version::new(0, 19, 1))),
            update_systems: std::collections::HashSet::new(),
            startup_systems: std::collections::HashSet::new(),
        };
        let rules = cerberus_domain::BuiltinRuleRegistry::all_rules();
        let checker = BevyApiChecker::new("src/main.rs", &rules, &ctx);
        checker.check_file(&file)
    }

    #[test]
    fn test_bevy_api_001_add_system() {
        let bad = indoc! {r#"
            fn build_app(app: &mut App) {
                app.add_system(player_movement);
            }
        "#};
        let violations = check_code(bad, None);
        assert!(has_rule(&violations, "BEVY-API-001"));

        let good = indoc! {r#"
            fn build_app(app: &mut App) {
                app.add_systems(Update, player_movement);
            }
        "#};
        let violations = check_code(good, None);
        assert!(!has_rule(&violations, "BEVY-API-001"));
    }

    #[test]
    fn test_bevy_api_002_add_startup_system() {
        let bad = indoc! {r#"
            fn build_app(app: &mut App) {
                app.add_startup_system(setup_camera);
            }
        "#};
        let violations = check_code(bad, None);
        assert!(has_rule(&violations, "BEVY-API-002"));
    }

    #[test]
    fn test_bevy_api_003_event_writer_send() {
        let code = indoc! {r#"
            fn trigger(mut event_writer: EventWriter<MyEvent>) {
                event_writer.send(MyEvent);
            }
        "#};
        let v_new = check_code(code, Some(semver::Version::new(0, 19, 1)));
        assert!(has_rule(&v_new, "BEVY-API-003"));

        let v_old = check_code(code, Some(semver::Version::new(0, 14, 0)));
        assert!(!has_rule(&v_old, "BEVY-API-003"));

        let non_event_code = indoc! {r#"
            fn channel_send(tx: &std::sync::mpsc::Sender<u32>) {
                tx.send(42);
            }
        "#};
        let v_non_event = check_code(non_event_code, Some(semver::Version::new(0, 19, 1)));
        assert!(!has_rule(&v_non_event, "BEVY-API-003"));
    }

    #[test]
    fn test_bevy_api_004_insert_bundle() {
        let bad = indoc! {r#"
            fn spawn_things(mut commands: Commands) {
                commands.spawn().insert_bundle(SpriteBundle::default());
            }
        "#};
        let violations = check_code(bad, None);
        assert!(has_rule(&violations, "BEVY-API-004"));
    }

    #[test]
    fn test_non_bevy_project_returns_empty() {
        let bad = indoc! {r#"
            fn build_app(app: &mut App) {
                app.add_plugin(MyPlugin);
            }
        "#};
        let file: syn::File = syn::parse_str(bad).unwrap();
        let ctx = BevyScanContext {
            is_bevy_project: false,
            bevy_version: None,
            update_systems: std::collections::HashSet::new(),
            startup_systems: std::collections::HashSet::new(),
        };
        let rules = cerberus_domain::BuiltinRuleRegistry::all_rules();
        let checker = BevyApiChecker::new("src/main.rs", &rules, &ctx);
        assert!(checker.check_file(&file).is_empty());
    }

    #[test]
    fn test_bevy_api_005_add_plugin() {
        let bad = indoc! {r#"
            fn build_app(app: &mut App) {
                app.add_plugin(MyPlugin);
            }
        "#};
        let violations = check_code(bad, None);
        assert!(has_rule(&violations, "BEVY-API-005"));

        let good = indoc! {r#"
            fn build_app(app: &mut App) {
                app.add_plugins(MyPlugin);
            }
        "#};
        let violations_good = check_code(good, None);
        assert!(!has_rule(&violations_good, "BEVY-API-005"));
    }

    #[test]
    fn test_bevy_api_003_write_good() {
        let good = indoc! {r#"
            fn trigger(mut event_writer: EventWriter<MyEvent>) {
                event_writer.write(MyEvent);
            }
        "#};
        let violations_good = check_code(good, Some(semver::Version::new(0, 19, 1)));
        assert!(!has_rule(&violations_good, "BEVY-API-003"));
    }

    #[test]
    fn test_bevy_api_004_spawn_tuple_good() {
        let good = indoc! {r#"
            fn spawn_things(mut commands: Commands) {
                commands.spawn((Sprite::default(), Transform::default()));
            }
        "#};
        let violations_good = check_code(good, None);
        assert!(!has_rule(&violations_good, "BEVY-API-004"));
    }

    #[test]
    fn test_bevy_api_disabled_rule() {
        let code = indoc! {r#"
            fn build_app(app: &mut App) {
                app.add_system(player_movement);
            }
        "#};
        let file: syn::File = syn::parse_str(code).unwrap();
        let ctx = BevyScanContext {
            is_bevy_project: true,
            bevy_version: Some(semver::Version::new(0, 19, 1)),
            update_systems: std::collections::HashSet::new(),
            startup_systems: std::collections::HashSet::new(),
        };
        let rules = vec![RuleDefinition {
            id: "BEVY-API-001".into(),
            title: "add_system".into(),
            version: "1.0".into(),
            category: Category::BevyApi,
            severity: Severity::Off,
            description: "add_system".into(),
            remediation: "Use add_systems".into(),
        }];
        let checker = BevyApiChecker::new("src/main.rs", &rules, &ctx);
        let violations = checker.check_file(&file);
        assert!(violations.is_empty());
    }

    #[test]
    fn test_bevy_api_rule_fallback_when_empty_rules() {
        let code = indoc! {r#"
            fn build_app(app: &mut App) {
                app.add_system(player_movement);
            }
        "#};
        let file: syn::File = syn::parse_str(code).unwrap();
        let ctx = BevyScanContext {
            is_bevy_project: true,
            bevy_version: Some(semver::Version::new(0, 19, 1)),
            update_systems: std::collections::HashSet::new(),
            startup_systems: std::collections::HashSet::new(),
        };
        let rules = vec![];
        let checker = BevyApiChecker::new("src/main.rs", &rules, &ctx);
        let violations = checker.check_file(&file);
        assert!(!violations.is_empty());
    }
}


