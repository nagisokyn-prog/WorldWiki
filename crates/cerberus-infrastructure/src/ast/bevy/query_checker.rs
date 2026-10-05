use std::collections::HashSet;
use std::path::PathBuf;
use syn::visit::{self, Visit};
use syn::{ExprMethodCall, File, ItemFn};

use super::context::BevyScanContext;
use super::helpers::{
    block_calls_method_on_var, expr_to_path_string, find_param_names_with_wrapper,
    find_query_param_names,
};
use cerberus_domain::{compute_fingerprint, Category, RuleDefinition, Severity, Violation};

pub struct BevyQueryChecker<'a> {
    file_path: &'a str,
    rules: &'a [RuleDefinition],
    ctx: &'a BevyScanContext,
}

impl<'a> BevyQueryChecker<'a> {
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
        let mut visitor = QueryVisitor {
            checker: self,
            violations: &mut violations,
            current_query_params: Vec::new(),
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

struct QueryVisitor<'a, 'b> {
    checker: &'a BevyQueryChecker<'a>,
    violations: &'b mut Vec<Violation>,
    current_query_params: Vec<String>,
}

impl<'a, 'b, 'ast> Visit<'ast> for QueryVisitor<'a, 'b> {
    fn visit_item_fn(&mut self, node: &'ast ItemFn) {
        let fn_name = node.sig.ident.to_string();
        let prev_query_params = self.current_query_params.clone();
        self.current_query_params = find_query_param_names(&node.sig);

        // BEVY-QUERY-004: EventReader without consumption
        if self.checker.is_rule_enabled("BEVY-QUERY-004") {
            let event_readers = find_param_names_with_wrapper(&node.sig, "EventReader");
            for (var_name, event_ty) in event_readers {
                let is_read = block_calls_method_on_var(&node.block, &var_name, "read")
                    || block_calls_method_on_var(&node.block, &var_name, "iter")
                    || block_calls_method_on_var(&node.block, &var_name, "par_read");

                if !is_read {
                    let snippet = format!("EventReader<{}> in fn {}", event_ty, fn_name);
                    let fp = compute_fingerprint("BEVY-QUERY-004", "1.0", &var_name, &snippet);
                    self.violations.push(Violation {
                        rule_id: "BEVY-QUERY-004".into(),
                        rule_version: "1.0".into(),
                        category: Category::BevyQuery,
                        severity: self.checker.get_severity("BEVY-QUERY-004", Severity::Warn),
                        file: PathBuf::from(self.checker.file_path),
                        line: 1,
                        column: 1,
                        symbol: var_name.clone(),
                        message: format!(
                            "EventReader<{}> parameter '{}' in system '{}' is never read with .read() or .iter(). Events will drop after 2 frames.",
                            event_ty, var_name, fn_name
                        ),
                        snippet,
                        remediation: "Consume events with 'for event in events.read() { ... }'.".into(),
                        fingerprint: fp,
                    });
                }
            }
        }

        // BEVY-QUERY-005: ResMut<T> + Res<T> conflict on same type T
        if self.checker.is_rule_enabled("BEVY-QUERY-005") {
            let mut res_mut_types: HashSet<String> = HashSet::new();
            for (_, ty) in find_param_names_with_wrapper(&node.sig, "ResMut") {
                res_mut_types.insert(ty);
            }
            let mut res_types: HashSet<String> = HashSet::new();
            for (_, ty) in find_param_names_with_wrapper(&node.sig, "Res") {
                res_types.insert(ty);
            }

            for conflict_ty in res_mut_types.intersection(&res_types) {
                let snippet = format!("ResMut<{}> and Res<{}> in fn {}", conflict_ty, conflict_ty, fn_name);
                let fp = compute_fingerprint("BEVY-QUERY-005", "1.0", conflict_ty, &snippet);
                self.violations.push(Violation {
                    rule_id: "BEVY-QUERY-005".into(),
                    rule_version: "1.0".into(),
                    category: Category::BevyQuery,
                    severity: self.checker.get_severity("BEVY-QUERY-005", Severity::Deny),
                    file: PathBuf::from(self.checker.file_path),
                    line: 1,
                    column: 1,
                    symbol: conflict_ty.clone(),
                    message: format!(
                        "System '{}' requests both ResMut<{}> and Res<{}> on the same type, triggering runtime scheduler panic B0001.",
                        fn_name, conflict_ty, conflict_ty
                    ),
                    snippet,
                    remediation: "ResMut<T> allows reading; remove the redundant Res<T> parameter or use ParamSet.".into(),
                    fingerprint: fp,
                });
            }
        }

        visit::visit_item_fn(self, node);
        self.current_query_params = prev_query_params;
    }

    fn visit_expr_method_call(&mut self, node: &'ast ExprMethodCall) {
        let method = node.method.to_string();

        // BEVY-QUERY-001: query.single() / query.single_mut()
        if (method == "single" || method == "single_mut")
            && self.checker.is_rule_enabled("BEVY-QUERY-001")
        {
            let mut is_query_call = false;
            if let Some(receiver_path) = expr_to_path_string(&node.receiver) {
                let base_ident = receiver_path.split('.').next().unwrap_or(&receiver_path);
                for p in &self.current_query_params {
                    if p == base_ident {
                        is_query_call = true;
                        break;
                    }
                }
                if !is_query_call
                    && (base_ident.contains("query")
                        || base_ident.contains("player")
                        || base_ident.contains("camera"))
                {
                    is_query_call = true;
                }
            }

            if is_query_call {
                let snippet = quote::quote!(#node).to_string();
                let fp = compute_fingerprint("BEVY-QUERY-001", "1.0", &method, &snippet);
                self.violations.push(Violation {
                    rule_id: "BEVY-QUERY-001".into(),
                    rule_version: "1.0".into(),
                    category: Category::BevyQuery,
                    severity: self.checker.get_severity("BEVY-QUERY-001", Severity::Deny),
                    file: PathBuf::from(self.checker.file_path),
                    line: 1,
                    column: 1,
                    symbol: method.clone(),
                    message: "query.single() panics at runtime if entity count is 0 or >1.".into(),
                    snippet,
                    remediation: "Use 'if let Ok(item) = query.get_single() { ... }' or 'query.get_single_mut()'.".into(),
                    fingerprint: fp,
                });
            }
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

    fn check_code(code: &str) -> Vec<Violation> {
        let file: syn::File = syn::parse_str(code).unwrap();
        let ctx = BevyScanContext {
            is_bevy_project: true,
            bevy_version: Some(semver::Version::new(0, 19, 1)),
            update_systems: std::collections::HashSet::new(),
            startup_systems: std::collections::HashSet::new(),
        };
        let rules = cerberus_domain::BuiltinRuleRegistry::all_rules();
        let checker = BevyQueryChecker::new("src/queries.rs", &rules, &ctx);
        checker.check_file(&file)
    }

    #[test]
    fn test_bevy_query_001_single_panic() {
        let bad = indoc! {r#"
            fn player_system(query: Query<&Transform, With<Player>>) {
                let transform = query.single();
            }
        "#};
        let violations = check_code(bad);
        assert!(has_rule(&violations, "BEVY-QUERY-001"));

        let good = indoc! {r#"
            fn player_system(query: Query<&Transform, With<Player>>) {
                if let Ok(transform) = query.get_single() {
                    println!("{:?}", transform);
                }
            }
        "#};
        let violations_good = check_code(good);
        assert!(!has_rule(&violations_good, "BEVY-QUERY-001"));
    }

    #[test]
    fn test_bevy_query_004_event_reader_unconsumed() {
        let bad = indoc! {r#"
            fn on_damage(mut events: EventReader<DamageEvent>) {
                println!("System ticked without reading events");
            }
        "#};
        let violations = check_code(bad);
        assert!(has_rule(&violations, "BEVY-QUERY-004"));

        let good = indoc! {r#"
            fn on_damage(mut events: EventReader<DamageEvent>) {
                for event in events.read() {
                    println!("Damage: {:?}", event);
                }
            }
        "#};
        let violations_good = check_code(good);
        assert!(!has_rule(&violations_good, "BEVY-QUERY-004"));
    }

    #[test]
    fn test_non_bevy_project_returns_empty() {
        let bad = indoc! {r#"
            fn player_system(query: Query<&Transform, With<Player>>) {
                let transform = query.single();
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
        let checker = BevyQueryChecker::new("src/queries.rs", &rules, &ctx);
        assert!(checker.check_file(&file).is_empty());
    }

    #[test]
    fn test_bevy_query_001_single_mut_panic() {
        let bad = indoc! {r#"
            fn player_system(mut player_query: Query<&mut Transform, With<Player>>) {
                let mut transform = player_query.single_mut();
            }
        "#};
        let violations = check_code(bad);
        assert!(has_rule(&violations, "BEVY-QUERY-001"));
    }

    #[test]
    fn test_bevy_query_004_par_read_good() {
        let good = indoc! {r#"
            fn on_damage(mut events: EventReader<DamageEvent>) {
                events.par_read().for_each(|ev| {
                    println!("Damage: {:?}", ev);
                });
            }
        "#};
        let violations_good = check_code(good);
        assert!(!has_rule(&violations_good, "BEVY-QUERY-004"));
    }

    #[test]
    fn test_bevy_query_005_resmut_res_conflict() {
        let bad = indoc! {r#"
            fn conflict_system(mut a: ResMut<Score>, b: Res<Score>) {
                a.points += b.points;
            }
        "#};
        let violations = check_code(bad);
        assert!(has_rule(&violations, "BEVY-QUERY-005"));

        let good = indoc! {r#"
            fn valid_system(mut a: ResMut<Score>, b: Res<Time>) {
                a.points += 1;
            }
        "#};
        let violations_good = check_code(good);
        assert!(!has_rule(&violations_good, "BEVY-QUERY-005"));
    }

    #[test]
    fn test_bevy_query_disabled_rule() {
        let code = indoc! {r#"
            fn player_system(query: Query<&Transform, With<Player>>) {
                let transform = query.single();
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
            id: "BEVY-QUERY-001".into(),
            title: "Single panic".into(),
            version: "1.0".into(),
            category: Category::BevyQuery,
            severity: Severity::Off,
            description: "Single panic".into(),
            remediation: "Use get_single".into(),
        }];
        let checker = BevyQueryChecker::new("src/queries.rs", &rules, &ctx);
        let violations = checker.check_file(&file);
        assert!(violations.is_empty());
    }

    #[test]
    fn test_bevy_query_fallback_when_empty_rules() {
        let bad = indoc! {r#"
            fn player_system(query: Query<&Transform, With<Player>>, mut events: EventReader<DamageEvent>) {
                let transform = query.single();
            }
        "#};
        let file: syn::File = syn::parse_str(bad).unwrap();
        let ctx = BevyScanContext {
            is_bevy_project: true,
            bevy_version: Some(semver::Version::new(0, 19, 1)),
            update_systems: std::collections::HashSet::new(),
            startup_systems: std::collections::HashSet::new(),
        };
        let rules: Vec<RuleDefinition> = Vec::new();
        let checker = BevyQueryChecker::new("src/queries.rs", &rules, &ctx);
        let violations = checker.check_file(&file);
        assert!(has_rule(&violations, "BEVY-QUERY-001"));
        assert!(has_rule(&violations, "BEVY-QUERY-004"));
    }
}
