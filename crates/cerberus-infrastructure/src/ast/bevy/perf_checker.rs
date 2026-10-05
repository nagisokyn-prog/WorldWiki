use std::path::PathBuf;
use syn::visit::{self, Visit};
use syn::{Expr, ExprAssign, ExprForLoop, ExprMethodCall, File, ItemFn, ItemStruct};

use super::context::BevyScanContext;
use super::helpers::{expr_to_path_string, find_mut_query_params, has_derive, type_to_string};
use cerberus_domain::{compute_fingerprint, Category, RuleDefinition, Severity, Violation};

pub struct BevyPerfChecker<'a> {
    file_path: &'a str,
    rules: &'a [RuleDefinition],
    ctx: &'a BevyScanContext,
}

impl<'a> BevyPerfChecker<'a> {
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
        let mut visitor = PerfVisitor {
            checker: self,
            violations: &mut violations,
            current_fn_name: String::new(),
            current_fn_is_update: false,
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

struct DerefAssignVisitor {
    found_unconditional_deref: bool,
}

impl<'ast> Visit<'ast> for DerefAssignVisitor {
    fn visit_expr_assign(&mut self, assign: &'ast ExprAssign) {
        if let Expr::Unary(unary) = assign.left.as_ref() {
            if matches!(unary.op, syn::UnOp::Deref(_)) {
                self.found_unconditional_deref = true;
            }
        }
        visit::visit_expr_assign(self, assign);
    }
}

struct LoopSpawnVisitor {
    spawn_in_loop: bool,
}

impl<'ast> Visit<'ast> for LoopSpawnVisitor {
    fn visit_expr_for_loop(&mut self, for_node: &'ast ExprForLoop) {
        let body = &for_node.body;
        let body_str = quote::quote!(#body).to_string();
        if body_str.contains("commands . spawn") || body_str.contains("commands.spawn") {
            self.spawn_in_loop = true;
        }
        visit::visit_expr_for_loop(self, for_node);
    }
}

struct PerfVisitor<'a, 'b> {
    checker: &'a BevyPerfChecker<'a>,
    violations: &'b mut Vec<Violation>,
    current_fn_name: String,
    current_fn_is_update: bool,
}

impl<'a, 'b, 'ast> Visit<'ast> for PerfVisitor<'a, 'b> {
    fn visit_item_struct(&mut self, node: &'ast ItemStruct) {
        let ident_str = node.ident.to_string();

        // BEVY-PERF-MEM-002: Resource contains Vec<Handle<T>> or HashMap<_, Handle<T>>
        if has_derive(&node.attrs, "Resource") && self.checker.is_rule_enabled("BEVY-PERF-MEM-002") {
            for field in node.fields.iter() {
                let ty_str = type_to_string(&field.ty);
                if (ty_str.contains("Vec < Handle") || ty_str.contains("HashMap <") || ty_str.contains("Vec<Handle"))
                    && ty_str.contains("Handle")
                {
                    let snippet = quote::quote!(#field).to_string();
                    let fp = compute_fingerprint("BEVY-PERF-MEM-002", "1.0", &ident_str, &snippet);
                    self.violations.push(Violation {
                        rule_id: "BEVY-PERF-MEM-002".into(),
                        rule_version: "1.0".into(),
                        category: Category::BevyPerf,
                        severity: self.checker.get_severity("BEVY-PERF-MEM-002", Severity::Warn),
                        file: PathBuf::from(self.checker.file_path),
                        line: 1,
                        column: 1,
                        symbol: ident_str.clone(),
                        message: format!(
                            "Resource '{}' stores collections of Handle<T>. Ensure Handles are pruned when entities despawn.",
                            ident_str
                        ),
                        snippet,
                        remediation: "Implement explicit lifecycle management or asset unloader for stored Handles.".into(),
                        fingerprint: fp,
                    });
                }
            }
        }

        visit::visit_item_struct(self, node);
    }

    fn visit_item_fn(&mut self, node: &'ast ItemFn) {
        let prev_fn = self.current_fn_name.clone();
        let prev_update = self.current_fn_is_update;

        let fn_name = node.sig.ident.to_string();
        let is_update = self.checker.ctx.update_systems.contains(&fn_name)
            || (!self.checker.ctx.startup_systems.contains(&fn_name)
                && !fn_name.contains("setup")
                && !fn_name.contains("startup")
                && !fn_name.contains("init"));

        self.current_fn_name = fn_name.clone();
        self.current_fn_is_update = is_update;

        let fn_str = quote::quote!(#node).to_string();

        // BEVY-PERF-CHANGE-001: Unconditional *t = new_transform
        if self.checker.is_rule_enabled("BEVY-PERF-CHANGE-001") {
            let mut_params = find_mut_query_params(&node.sig);
            let mut has_transform = false;
            for (_, ty) in &mut_params {
                if ty.contains("Transform") {
                    has_transform = true;
                    break;
                }
            }

            if has_transform && !fn_str.contains("set_if_neq") {
                let mut deref_visitor = DerefAssignVisitor {
                    found_unconditional_deref: false,
                };
                deref_visitor.visit_item_fn(node);

                if deref_visitor.found_unconditional_deref {
                    let snippet = format!("*transform = ... in fn {}", fn_name);
                    let fp = compute_fingerprint("BEVY-PERF-CHANGE-001", "1.0", &fn_name, &snippet);
                    self.violations.push(Violation {
                        rule_id: "BEVY-PERF-CHANGE-001".into(),
                        rule_version: "1.0".into(),
                        category: Category::BevyPerf,
                        severity: self.checker.get_severity("BEVY-PERF-CHANGE-001", Severity::Warn),
                        file: PathBuf::from(self.checker.file_path),
                        line: 1,
                        column: 1,
                        symbol: fn_name.clone(),
                        message: format!(
                            "Unconditional full deref assignment '*t = ...' on Transform in system '{}' triggers expensive GlobalTransform recalculation every tick.",
                            fn_name
                        ),
                        snippet,
                        remediation: "Use 'transform.set_if_neq(new_val)' or compare changes before assigning.".into(),
                        fingerprint: fp,
                    });
                }
            }
        }

        // BEVY-PERF-ECS-002: Spawn in for-loop without spawn_batch
        if self.checker.is_rule_enabled("BEVY-PERF-ECS-002") {
            let has_spawn_batch = fn_str.contains("spawn_batch");
            if !has_spawn_batch {
                let mut loop_visitor = LoopSpawnVisitor {
                    spawn_in_loop: false,
                };
                loop_visitor.visit_item_fn(node);

                if loop_visitor.spawn_in_loop {
                    let snippet = format!("for ... {{ commands.spawn(...) }} in fn {}", fn_name);
                    let fp = compute_fingerprint("BEVY-PERF-ECS-002", "1.0", &fn_name, &snippet);
                    self.violations.push(Violation {
                        rule_id: "BEVY-PERF-ECS-002".into(),
                        rule_version: "1.0".into(),
                        category: Category::BevyPerf,
                        severity: self.checker.get_severity("BEVY-PERF-ECS-002", Severity::Warn),
                        file: PathBuf::from(self.checker.file_path),
                        line: 1,
                        column: 1,
                        symbol: fn_name.clone(),
                        message: format!(
                            "Spawning entities inside for-loop in system '{}' without spawn_batch causes Command queue overhead.",
                            fn_name
                        ),
                        snippet,
                        remediation: "Use 'commands.spawn_batch((0..N).map(|_| (ComponentA, ComponentB)))'.".into(),
                        fingerprint: fp,
                    });
                }
            }
        }

        visit::visit_item_fn(self, node);

        self.current_fn_name = prev_fn;
        self.current_fn_is_update = prev_update;
    }

    fn visit_expr_method_call(&mut self, node: &'ast ExprMethodCall) {
        let method = node.method.to_string();

        // BEVY-PERF-ASSET-001: assets.add(...) in Update system
        if method == "add" && self.current_fn_is_update && self.checker.is_rule_enabled("BEVY-PERF-ASSET-001") {
            if let Some(recv) = expr_to_path_string(&node.receiver) {
                let recv_lower = recv.to_lowercase();
                if recv_lower.contains("asset") || recv_lower.contains("meshes") || recv_lower.contains("materials") {
                    let snippet = quote::quote!(#node).to_string();
                    let fp = compute_fingerprint("BEVY-PERF-ASSET-001", "1.0", &self.current_fn_name, &snippet);
                    self.violations.push(Violation {
                        rule_id: "BEVY-PERF-ASSET-001".into(),
                        rule_version: "1.0".into(),
                        category: Category::BevyPerf,
                        severity: self.checker.get_severity("BEVY-PERF-ASSET-001", Severity::Deny),
                        file: PathBuf::from(self.checker.file_path),
                        line: 1,
                        column: 1,
                        symbol: self.current_fn_name.clone(),
                        message: format!(
                            "Calling assets.add() in Update system '{}' creates new GPU resource every frame (VRAM leak).",
                            self.current_fn_name
                        ),
                        snippet,
                        remediation: "Preallocate assets in Startup systems and reuse Handles.".into(),
                        fingerprint: fp,
                    });
                }
            }
        }

        // BEVY-PERF-ASSET-003: asset_server.load(...) in Update system
        if method == "load" && self.current_fn_is_update && self.checker.is_rule_enabled("BEVY-PERF-ASSET-003") {
            if let Some(recv) = expr_to_path_string(&node.receiver) {
                let recv_lower = recv.to_lowercase();
                if recv_lower.contains("asset") || recv_lower.contains("server") {
                    let snippet = quote::quote!(#node).to_string();
                    let fp = compute_fingerprint("BEVY-PERF-ASSET-003", "1.0", &self.current_fn_name, &snippet);
                    self.violations.push(Violation {
                        rule_id: "BEVY-PERF-ASSET-003".into(),
                        rule_version: "1.0".into(),
                        category: Category::BevyPerf,
                        severity: self.checker.get_severity("BEVY-PERF-ASSET-003", Severity::Deny),
                        file: PathBuf::from(self.checker.file_path),
                        line: 1,
                        column: 1,
                        symbol: self.current_fn_name.clone(),
                        message: format!(
                            "Calling asset_server.load() inside Update system '{}' initiates disk/network reload each frame.",
                            self.current_fn_name
                        ),
                        snippet,
                        remediation: "Load assets in Startup systems and cache the Handle in a Resource.".into(),
                        fingerprint: fp,
                    });
                }
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
        let mut update_systems = std::collections::HashSet::new();
        update_systems.insert("render_tick".to_string());
        update_systems.insert("tick_system".to_string());

        let ctx = BevyScanContext {
            is_bevy_project: true,
            bevy_version: Some(semver::Version::new(0, 19, 1)),
            update_systems,
            startup_systems: std::collections::HashSet::new(),
        };
        let rules = cerberus_domain::BuiltinRuleRegistry::all_rules();
        let checker = BevyPerfChecker::new("src/perf.rs", &rules, &ctx);
        checker.check_file(&file)
    }

    #[test]
    fn test_bevy_perf_asset_001_assets_add_in_update() {
        let bad = indoc! {r#"
            fn render_tick(mut meshes: ResMut<Assets<Mesh>>) {
                let handle = meshes.add(Mesh::from(Sphere::default()));
            }
        "#};
        let violations = check_code(bad);
        assert!(has_rule(&violations, "BEVY-PERF-ASSET-001"));
    }

    #[test]
    fn test_bevy_perf_ecs_002_spawn_in_loop() {
        let bad = indoc! {r#"
            fn spawn_bullets(mut commands: Commands) {
                for i in 0..100 {
                    commands.spawn((Bullet, Velocity(i as f32)));
                }
            }
        "#};
        let violations = check_code(bad);
        assert!(has_rule(&violations, "BEVY-PERF-ECS-002"));
    }

    #[test]
    fn test_non_bevy_project_returns_empty() {
        let bad = indoc! {r#"
            fn render_tick(mut meshes: ResMut<Assets<Mesh>>) {
                let handle = meshes.add(Mesh::from(Sphere::default()));
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
        let checker = BevyPerfChecker::new("src/perf.rs", &rules, &ctx);
        assert!(checker.check_file(&file).is_empty());
    }

    #[test]
    fn test_bevy_perf_mem_002_handle_collection_in_resource() {
        let bad = indoc! {r#"
            #[derive(Resource)]
            pub struct TextureCache {
                pub handles: Vec<Handle<Image>>,
            }
        "#};
        let violations = check_code(bad);
        assert!(has_rule(&violations, "BEVY-PERF-MEM-002"));

        let good = indoc! {r#"
            #[derive(Resource)]
            pub struct SimpleConfig {
                pub count: usize,
            }
        "#};
        let violations_good = check_code(good);
        assert!(!has_rule(&violations_good, "BEVY-PERF-MEM-002"));
    }

    #[test]
    fn test_bevy_perf_change_001_unconditional_deref_transform() {
        let bad = indoc! {r#"
            fn sync_movement(mut query: Query<&mut Transform>) {
                for mut t in query.iter_mut() {
                    *t = Transform::from_xyz(1.0, 2.0, 3.0);
                }
            }
        "#};
        let violations = check_code(bad);
        assert!(has_rule(&violations, "BEVY-PERF-CHANGE-001"));

        let good = indoc! {r#"
            fn sync_movement(mut query: Query<&mut Transform>) {
                for mut t in query.iter_mut() {
                    t.set_if_neq(Transform::from_xyz(1.0, 2.0, 3.0));
                }
            }
        "#};
        let violations_good = check_code(good);
        assert!(!has_rule(&violations_good, "BEVY-PERF-CHANGE-001"));
    }

    #[test]
    fn test_bevy_perf_ecs_002_spawn_batch_positive() {
        let good = indoc! {r#"
            fn spawn_bullets(mut commands: Commands) {
                commands.spawn_batch((0..100).map(|i| (Bullet, Velocity(i as f32))));
            }
        "#};
        let violations = check_code(good);
        assert!(!has_rule(&violations, "BEVY-PERF-ECS-002"));
    }

    #[test]
    fn test_bevy_perf_asset_003_load_in_update() {
        let bad = indoc! {r#"
            fn tick_system(asset_server: Res<AssetServer>) {
                let handle = asset_server.load("textures/player.png");
            }
        "#};
        let violations = check_code(bad);
        assert!(has_rule(&violations, "BEVY-PERF-ASSET-003"));

        let good = indoc! {r#"
            fn setup_system(asset_server: Res<AssetServer>) {
                let handle = asset_server.load("textures/player.png");
            }
        "#};
        let violations_good = check_code(good);
        assert!(!has_rule(&violations_good, "BEVY-PERF-ASSET-003"));
    }

    #[test]
    fn test_bevy_perf_asset_001_setup_system_good() {
        let good = indoc! {r#"
            fn setup_meshes(mut meshes: ResMut<Assets<Mesh>>) {
                let handle = meshes.add(Mesh::from(Sphere::default()));
            }
        "#};
        let violations = check_code(good);
        assert!(!has_rule(&violations, "BEVY-PERF-ASSET-001"));
    }

    #[test]
    fn test_bevy_perf_disabled_rule() {
        let code = indoc! {r#"
            fn render_tick(mut meshes: ResMut<Assets<Mesh>>) {
                let handle = meshes.add(Mesh::from(Sphere::default()));
            }
        "#};
        let file: syn::File = syn::parse_str(code).unwrap();
        let mut update_systems = std::collections::HashSet::new();
        update_systems.insert("render_tick".to_string());
        let ctx = BevyScanContext {
            is_bevy_project: true,
            bevy_version: Some(semver::Version::new(0, 19, 1)),
            update_systems,
            startup_systems: std::collections::HashSet::new(),
        };
        let rules = vec![RuleDefinition {
            id: "BEVY-PERF-ASSET-001".into(),
            title: "Asset add in update".into(),
            version: "1.0".into(),
            category: Category::BevyPerf,
            severity: Severity::Off,
            description: "Asset add in update".into(),
            remediation: "Move".into(),
        }];
        let checker = BevyPerfChecker::new("src/perf.rs", &rules, &ctx);
        let violations = checker.check_file(&file);
        assert!(violations.is_empty());
    }

    #[test]
    fn test_bevy_perf_fallback_when_empty_rules() {
        let bad = indoc! {r#"
            #[derive(Resource)]
            pub struct TextureCache {
                pub handles: Vec<Handle<Image>>,
            }
            fn tick_system(mut meshes: ResMut<Assets<Mesh>>, asset_server: Res<AssetServer>) {
                let h1 = meshes.add(Mesh::from(Sphere::default()));
                let h2 = asset_server.load("test.png");
            }
        "#};
        let file: syn::File = syn::parse_str(bad).unwrap();
        let mut update_systems = std::collections::HashSet::new();
        update_systems.insert("tick_system".to_string());
        let ctx = BevyScanContext {
            is_bevy_project: true,
            bevy_version: Some(semver::Version::new(0, 19, 1)),
            update_systems,
            startup_systems: std::collections::HashSet::new(),
        };
        let rules: Vec<RuleDefinition> = Vec::new();
        let checker = BevyPerfChecker::new("src/perf.rs", &rules, &ctx);
        let violations = checker.check_file(&file);
        assert!(has_rule(&violations, "BEVY-PERF-MEM-002"));
        assert!(has_rule(&violations, "BEVY-PERF-ASSET-001"));
        assert!(has_rule(&violations, "BEVY-PERF-ASSET-003"));
    }
}
