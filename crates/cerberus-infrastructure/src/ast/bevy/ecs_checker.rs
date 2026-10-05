use std::collections::HashSet;
use std::path::PathBuf;
use syn::visit::{self, Visit};
use syn::{ExprMethodCall, File, ItemFn, ItemImpl, ItemStruct, Visibility};

use super::context::BevyScanContext;
use super::helpers::{
    block_has_write_to_var, count_method_in_block, find_mut_query_params, has_derive,
    type_to_string,
};
use cerberus_domain::{compute_fingerprint, Category, RuleDefinition, Severity, Violation};

pub struct BevyEcsChecker<'a> {
    file_path: &'a str,
    rules: &'a [RuleDefinition],
    ctx: &'a BevyScanContext,
}

impl<'a> BevyEcsChecker<'a> {
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

        // First collect components defined in this file to detect BEVY-ECS-004
        let mut component_structs = HashSet::new();
        for item in &syntax.items {
            if let syn::Item::Struct(s) = item {
                if has_derive(&s.attrs, "Component") {
                    component_structs.insert(s.ident.to_string());
                }
            }
        }

        let mut violations = Vec::new();
        let mut visitor = EcsVisitor {
            checker: self,
            component_structs,
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

struct EcsVisitor<'a, 'b> {
    checker: &'a BevyEcsChecker<'a>,
    component_structs: HashSet<String>,
    violations: &'b mut Vec<Violation>,
}

impl<'a, 'b, 'ast> Visit<'ast> for EcsVisitor<'a, 'b> {
    fn visit_item_struct(&mut self, node: &'ast ItemStruct) {
        let ident_str = node.ident.to_string();

        // BEVY-ECS-001: God Component (>7 fields)
        if has_derive(&node.attrs, "Component") && self.checker.is_rule_enabled("BEVY-ECS-001") {
            let field_count = node.fields.iter().count();
            if field_count > 7 {
                let snippet = format!("struct {} ({} fields)", ident_str, field_count);
                let fp = compute_fingerprint("BEVY-ECS-001", "1.0", &ident_str, &snippet);
                self.violations.push(Violation {
                    rule_id: "BEVY-ECS-001".into(),
                    rule_version: "1.0".into(),
                    category: Category::BevyEcs,
                    severity: self.checker.get_severity("BEVY-ECS-001", Severity::Warn),
                    file: PathBuf::from(self.checker.file_path),
                    line: 1,
                    column: 1,
                    symbol: ident_str.clone(),
                    message: format!(
                        "God Component '{}' contains {} fields (>7). ECS components should be granular and focused.",
                        ident_str, field_count
                    ),
                    snippet,
                    remediation: "Decompose into smaller cohesive components (e.g. Health, Velocity, Inventory).".into(),
                    fingerprint: fp,
                });
            }
        }

        // BEVY-ECS-003: HashMap<Entity, T> in Resource
        if has_derive(&node.attrs, "Resource") && self.checker.is_rule_enabled("BEVY-ECS-003") {
            for field in node.fields.iter() {
                let ty_str = type_to_string(&field.ty);
                if (ty_str.contains("HashMap") || ty_str.contains("BTreeMap"))
                    && ty_str.contains("Entity")
                {
                    let snippet = quote::quote!(#field).to_string();
                    let fp = compute_fingerprint("BEVY-ECS-003", "1.0", &ident_str, &snippet);
                    self.violations.push(Violation {
                        rule_id: "BEVY-ECS-003".into(),
                        rule_version: "1.0".into(),
                        category: Category::BevyEcs,
                        severity: self.checker.get_severity("BEVY-ECS-003", Severity::Warn),
                        file: PathBuf::from(self.checker.file_path),
                        line: 1,
                        column: 1,
                        symbol: ident_str.clone(),
                        message: format!(
                            "Resource '{}' contains HashMap<Entity, T>. Entity data belongs in ECS Components, not global maps.",
                            ident_str
                        ),
                        snippet,
                        remediation: "Attach Component<T> to each entity instead of storing an entity map in Resource.".into(),
                        fingerprint: fp,
                    });
                }
            }
        }

        visit::visit_item_struct(self, node);
    }

    fn visit_item_impl(&mut self, node: &'ast ItemImpl) {
        // BEVY-ECS-004: Business logic in Component impl (>3 pub fn)
        if self.checker.is_rule_enabled("BEVY-ECS-004") {
            let self_ty_str = type_to_string(&node.self_ty);
            let base_ty = self_ty_str
                .split('<')
                .next()
                .unwrap_or(&self_ty_str)
                .split("::")
                .last()
                .unwrap_or(&self_ty_str)
                .trim();
            if self.component_structs.contains(base_ty) {
                let mut business_methods = 0;
                for item in &node.items {
                    if let syn::ImplItem::Fn(impl_fn) = item {
                        if let Visibility::Public(_) = &impl_fn.vis {
                            let fn_name = impl_fn.sig.ident.to_string();
                            if !matches!(
                                fn_name.as_str(),
                                "new" | "default" | "from" | "into" | "clone"
                            ) {
                                business_methods += 1;
                            }
                        }
                    }
                }

                if business_methods > 3 {
                    let snippet = format!("impl {} ({} pub methods)", self_ty_str, business_methods);
                    let fp = compute_fingerprint("BEVY-ECS-004", "1.0", &self_ty_str, &snippet);
                    self.violations.push(Violation {
                        rule_id: "BEVY-ECS-004".into(),
                        rule_version: "1.0".into(),
                        category: Category::BevyEcs,
                        severity: self.checker.get_severity("BEVY-ECS-004", Severity::Deny),
                        file: PathBuf::from(self.checker.file_path),
                        line: 1,
                        column: 1,
                        symbol: self_ty_str.clone(),
                        message: format!(
                            "Component '{}' impl contains {} public business logic methods. Components must be pure data.",
                            self_ty_str, business_methods
                        ),
                        snippet,
                        remediation: "Move business logic into Bevy systems or pure domain helper modules.".into(),
                        fingerprint: fp,
                    });
                }
            }
        }

        visit::visit_item_impl(self, node);
    }

    fn visit_item_fn(&mut self, node: &'ast ItemFn) {
        let fn_name = node.sig.ident.to_string();

        // BEVY-ECS-005: Clone epidemic
        if self.checker.is_rule_enabled("BEVY-ECS-005") {
            let clone_count = count_method_in_block(&node.block, "clone");
            let stmts_count = node.block.stmts.len().max(1);
            let ratio = clone_count as f64 / stmts_count as f64;

            if clone_count > 3 && ratio > 0.3 {
                let snippet = format!("fn {} ({} clones in {} stmts)", fn_name, clone_count, stmts_count);
                let fp = compute_fingerprint("BEVY-ECS-005", "1.0", &fn_name, &snippet);
                self.violations.push(Violation {
                    rule_id: "BEVY-ECS-005".into(),
                    rule_version: "1.0".into(),
                    category: Category::BevyEcs,
                    severity: self.checker.get_severity("BEVY-ECS-005", Severity::Warn),
                    file: PathBuf::from(self.checker.file_path),
                    line: 1,
                    column: 1,
                    symbol: fn_name.clone(),
                    message: format!(
                        "System '{}' exhibits clone epidemic ({} .clone() calls).",
                        fn_name, clone_count
                    ),
                    snippet,
                    remediation: "Split system or use ParamSet instead of defensive cloning.".into(),
                    fingerprint: fp,
                });
            }
        }

        // BEVY-ECS-006: Query<&mut T> used without mutation
        if self.checker.is_rule_enabled("BEVY-ECS-006") {
            let mut_params = find_mut_query_params(&node.sig);
            for (var_name, inner_ty) in mut_params {
                if !block_has_write_to_var(&node.block, &var_name) {
                    let snippet = format!("Query<&mut {}> in fn {}", inner_ty, fn_name);
                    let fp = compute_fingerprint("BEVY-ECS-006", "1.0", &var_name, &snippet);
                    self.violations.push(Violation {
                        rule_id: "BEVY-ECS-006".into(),
                        rule_version: "1.0".into(),
                        category: Category::BevyEcs,
                        severity: self.checker.get_severity("BEVY-ECS-006", Severity::Warn),
                        file: PathBuf::from(self.checker.file_path),
                        line: 1,
                        column: 1,
                        symbol: var_name.clone(),
                        message: format!(
                            "Query<&mut {}> on '{}' is read-only in system '{}', but requests mutable access (spurious change detection).",
                            inner_ty, var_name, fn_name
                        ),
                        snippet,
                        remediation: format!("Change Query<&mut {}> to Query<&{}>.", inner_ty, inner_ty),
                        fingerprint: fp,
                    });
                }
            }
        }

        visit::visit_item_fn(self, node);
    }

    fn visit_expr_method_call(&mut self, node: &'ast ExprMethodCall) {
        let method = node.method.to_string();

        // BEVY-ECS-007: despawn() style rule for Bevy < 0.15 (warn, not deny)
        // Note: In Bevy 0.15+, despawn() is recursive by default and despawn_recursive was removed.
        let is_bevy_gte_015 = self
            .checker
            .ctx
            .bevy_version
            .as_ref()
            .is_some_and(|v| v.major > 0 || (v.major == 0 && v.minor >= 15));
        if method == "despawn" && !is_bevy_gte_015 && self.checker.is_rule_enabled("BEVY-ECS-007") {
            let snippet = quote::quote!(#node).to_string();
            let fp = compute_fingerprint("BEVY-ECS-007", "1.0", "despawn", &snippet);
            self.violations.push(Violation {
                rule_id: "BEVY-ECS-007".into(),
                rule_version: "1.0".into(),
                category: Category::BevyEcs,
                severity: self.checker.get_severity("BEVY-ECS-007", Severity::Warn),
                file: PathBuf::from(self.checker.file_path),
                line: 1,
                column: 1,
                symbol: "despawn".into(),
                message: "commands.entity(e).despawn() style rule: prefer despawn_recursive() to avoid orphaned children.".into(),
                snippet,
                remediation: "Use commands.entity(e).despawn_recursive().".into(),
                fingerprint: fp,
            });
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
        let checker = BevyEcsChecker::new("src/ecs.rs", &rules, &ctx);
        checker.check_file(&file)
    }

    #[test]
    fn test_non_bevy_project_returns_empty() {
        let bad = indoc! {r#"
            #[derive(Component)]
            pub struct PlayerData {
                pub f1: u32, pub f2: u32, pub f3: u32, pub f4: u32,
                pub f5: u32, pub f6: u32, pub f7: u32, pub f8: u32,
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
        let checker = BevyEcsChecker::new("src/ecs.rs", &rules, &ctx);
        let violations = checker.check_file(&file);
        assert!(violations.is_empty());
    }

    #[test]
    fn test_bevy_ecs_001_god_component() {
        let bad = indoc! {r#"
            #[derive(Component)]
            pub struct PlayerData {
                pub f1: u32,
                pub f2: u32,
                pub f3: u32,
                pub f4: u32,
                pub f5: u32,
                pub f6: u32,
                pub f7: u32,
                pub f8: u32,
            }
        "#};
        let violations = check_code(bad);
        assert!(has_rule(&violations, "BEVY-ECS-001"));

        let good = indoc! {r#"
            #[derive(Component)]
            pub struct Health {
                pub current: f32,
                pub max: f32,
            }
        "#};
        let violations_good = check_code(good);
        assert!(!has_rule(&violations_good, "BEVY-ECS-001"));
    }

    #[test]
    fn test_bevy_ecs_003_hashmap_entity_in_resource() {
        let bad = indoc! {r#"
            #[derive(Resource)]
            pub struct EntityRegistry {
                pub map: std::collections::HashMap<Entity, PlayerStats>,
            }
        "#};
        let violations = check_code(bad);
        assert!(has_rule(&violations, "BEVY-ECS-003"));

        let good = indoc! {r#"
            #[derive(Resource)]
            pub struct GameConfig {
                pub difficulty: u32,
                pub map_name: String,
            }
        "#};
        let violations_good = check_code(good);
        assert!(!has_rule(&violations_good, "BEVY-ECS-003"));
    }

    #[test]
    fn test_bevy_ecs_003_btreemap_entity_in_resource() {
        let bad = indoc! {r#"
            #[derive(Resource)]
            pub struct EntityRegistry {
                pub map: std::collections::BTreeMap<Entity, PlayerStats>,
            }
        "#};
        let violations = check_code(bad);
        assert!(has_rule(&violations, "BEVY-ECS-003"));
    }

    #[test]
    fn test_bevy_ecs_004_business_logic_in_component() {
        let bad = indoc! {r#"
            #[derive(Component)]
            pub struct Character;

            impl Character {
                pub fn attack(&mut self) {}
                pub fn defend(&mut self) {}
                pub fn cast_spell(&mut self) {}
                pub fn level_up(&mut self) {}
            }
        "#};
        let violations = check_code(bad);
        assert!(has_rule(&violations, "BEVY-ECS-004"));

        let good = indoc! {r#"
            #[derive(Component)]
            pub struct Character;

            impl Character {
                pub fn new() -> Self { Self }
                pub fn default() -> Self { Self }
                pub fn get_id(&self) -> u32 { 1 }
            }
        "#};
        let violations_good = check_code(good);
        assert!(!has_rule(&violations_good, "BEVY-ECS-004"));
    }

    #[test]
    fn test_bevy_ecs_004_private_methods_and_non_component_impl() {
        let code = indoc! {r#"
            #[derive(Component)]
            pub struct Character;

            impl Character {
                fn private_calc(&self) -> u32 { 42 }
                fn private_helper(&self) {}
                pub fn new() -> Self { Self }
            }

            pub struct NonComponentHelper;

            impl NonComponentHelper {
                pub fn do_something(&self) {}
                pub fn do_something_else(&self) {}
                pub fn calc(&self) {}
                pub fn process(&self) {}
            }
        "#};
        let violations = check_code(code);
        assert!(!has_rule(&violations, "BEVY-ECS-004"));
    }

    #[test]
    fn test_bevy_ecs_005_clone_epidemic() {
        let bad = indoc! {r#"
            fn clone_heavy_system() {
                let a = x.clone();
                let b = y.clone();
                let c = z.clone();
                let d = w.clone();
            }
        "#};
        let violations = check_code(bad);
        assert!(has_rule(&violations, "BEVY-ECS-005"));

        let good = indoc! {r#"
            fn clean_system(query: Query<&Transform>) {
                for t in query.iter() {
                    let p = t.translation;
                }
            }
        "#};
        let violations_good = check_code(good);
        assert!(!has_rule(&violations_good, "BEVY-ECS-005"));
    }

    #[test]
    fn test_bevy_ecs_006_mut_query_without_write() {
        let bad = indoc! {r#"
            fn print_health(query: Query<&mut Health>) {
                for h in query.iter() {
                    println!("{}", h.value);
                }
            }
        "#};
        let violations = check_code(bad);
        assert!(has_rule(&violations, "BEVY-ECS-006"));

        let good = indoc! {r#"
            fn update_health(mut query: Query<&mut Health>) {
                for mut h in query.iter_mut() {
                    h.value += 10;
                }
            }
        "#};
        let violations_good = check_code(good);
        assert!(!has_rule(&violations_good, "BEVY-ECS-006"));
    }

    #[test]
    fn test_bevy_ecs_007_despawn_style() {
        let bad = indoc! {r#"
            fn cleanup(mut commands: Commands, e: Entity) {
                commands.entity(e).despawn();
            }
        "#};
        let file: syn::File = syn::parse_str(bad).unwrap();
        let ctx_legacy = BevyScanContext {
            is_bevy_project: true,
            bevy_version: Some(semver::Version::new(0, 14, 0)),
            update_systems: std::collections::HashSet::new(),
            startup_systems: std::collections::HashSet::new(),
        };
        let rules = cerberus_domain::BuiltinRuleRegistry::all_rules();
        let checker = BevyEcsChecker::new("src/ecs.rs", &rules, &ctx_legacy);
        let violations = checker.check_file(&file);
        assert!(has_rule(&violations, "BEVY-ECS-007"));
        let mut sev = None;
        for v in &violations {
            if v.rule_id == "BEVY-ECS-007" {
                sev = Some(v.severity);
                break;
            }
        }
        assert_eq!(sev, Some(Severity::Warn));

        let ctx_modern = BevyScanContext {
            is_bevy_project: true,
            bevy_version: Some(semver::Version::new(0, 15, 0)),
            update_systems: std::collections::HashSet::new(),
            startup_systems: std::collections::HashSet::new(),
        };
        let checker_modern = BevyEcsChecker::new("src/ecs.rs", &rules, &ctx_modern);
        let violations_modern = checker_modern.check_file(&file);
        assert!(!has_rule(&violations_modern, "BEVY-ECS-007"));
    }

    #[test]
    fn test_bevy_ecs_disabled_rule() {
        let code = indoc! {r#"
            #[derive(Component)]
            pub struct PlayerData {
                pub f1: u32, pub f2: u32, pub f3: u32, pub f4: u32,
                pub f5: u32, pub f6: u32, pub f7: u32, pub f8: u32,
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
            id: "BEVY-ECS-001".into(),
            title: "God Component".into(),
            version: "1.0".into(),
            category: Category::BevyEcs,
            severity: Severity::Off,
            description: "God Component".into(),
            remediation: "Split".into(),
        }];
        let checker = BevyEcsChecker::new("src/ecs.rs", &rules, &ctx);
        let violations = checker.check_file(&file);
        assert!(violations.is_empty());
    }

    #[test]
    fn test_bevy_ecs_fallback_when_empty_rules() {
        let bad = indoc! {r#"
            #[derive(Component)]
            pub struct PlayerData {
                pub f1: u32, pub f2: u32, pub f3: u32, pub f4: u32,
                pub f5: u32, pub f6: u32, pub f7: u32, pub f8: u32,
            }
            #[derive(Resource)]
            pub struct EntityRegistry {
                pub map: std::collections::HashMap<Entity, u32>,
            }
            fn test_despawn(mut commands: Commands, e: Entity) {
                commands.entity(e).despawn();
            }
        "#};
        let file: syn::File = syn::parse_str(bad).unwrap();
        let ctx = BevyScanContext {
            is_bevy_project: true,
            bevy_version: Some(semver::Version::new(0, 14, 0)),
            update_systems: std::collections::HashSet::new(),
            startup_systems: std::collections::HashSet::new(),
        };
        let rules: Vec<RuleDefinition> = Vec::new();
        let checker = BevyEcsChecker::new("src/ecs.rs", &rules, &ctx);
        let violations = checker.check_file(&file);
        assert!(has_rule(&violations, "BEVY-ECS-001"));
        assert!(has_rule(&violations, "BEVY-ECS-003"));
        assert!(has_rule(&violations, "BEVY-ECS-007"));
    }
}
