use cerberus_domain::BuiltinRuleRegistry;
use cerberus_infrastructure::ast::bevy::{
    run_all_bevy_checks, BevyApiChecker, BevyAsyncChecker, BevyEcsChecker, BevyPerfChecker,
    BevyQueryChecker, BevyScanContext, BevySchedChecker,
};
use indoc::indoc;

fn create_test_context(version: Option<semver::Version>) -> BevyScanContext {
    let mut update_systems = std::collections::HashSet::new();
    update_systems.insert("tick_update".to_string());
    update_systems.insert("render_tick".to_string());
    update_systems.insert("sync_positions".to_string());

    let mut startup_systems = std::collections::HashSet::new();
    startup_systems.insert("setup_camera".to_string());
    startup_systems.insert("init_game".to_string());

    BevyScanContext {
        is_bevy_project: true,
        bevy_version: version.or_else(|| Some(semver::Version::new(0, 19, 1))),
        update_systems,
        startup_systems,
    }
}

// ═════════════════════════════════════════════════════════════════════
// 1. BEVY-API Rules Tests
// ═════════════════════════════════════════════════════════════════════

#[test]
fn test_bevy_api_deprecated_methods() {
    let code = indoc! {r#"
        fn configure_app(app: &mut App) {
            app.add_system(player_movement);
            app.add_startup_system(setup_camera);
            app.add_plugin(MyGamePlugin);
        }

        fn spawn_player(mut commands: Commands) {
            commands.spawn().insert_bundle(PlayerBundle::default());
        }

        fn emit_event(mut writer: EventWriter<PlayerDied>) {
            writer.send(PlayerDied);
        }
    "#};

    let file: syn::File = syn::parse_str(code).unwrap();
    let rules = BuiltinRuleRegistry::all_rules();
    let ctx = create_test_context(Some(semver::Version::new(0, 19, 1)));
    let checker = BevyApiChecker::new("src/api.rs", &rules, &ctx);
    let violations = checker.check_file(&file);

    let ids: Vec<&str> = violations.iter().map(|v| v.rule_id.as_str()).collect();
    assert!(ids.contains(&"BEVY-API-001"), "Expected BEVY-API-001 for add_system");
    assert!(ids.contains(&"BEVY-API-002"), "Expected BEVY-API-002 for add_startup_system");
    assert!(ids.contains(&"BEVY-API-003"), "Expected BEVY-API-003 for EventWriter::send in Bevy 0.19");
    assert!(ids.contains(&"BEVY-API-004"), "Expected BEVY-API-004 for insert_bundle");
    assert!(ids.contains(&"BEVY-API-005"), "Expected BEVY-API-005 for add_plugin");
}

#[test]
fn test_bevy_api_clean_modern_patterns() {
    let code = indoc! {r#"
        fn configure_app(app: &mut App) {
            app.add_systems(Update, player_movement);
            app.add_systems(Startup, setup_camera);
            app.add_plugins(MyGamePlugin);
        }

        fn spawn_player(mut commands: Commands) {
            commands.spawn((Player, Health(100)));
        }

        fn emit_event(mut writer: EventWriter<PlayerDied>) {
            writer.write(PlayerDied);
        }
    "#};

    let file: syn::File = syn::parse_str(code).unwrap();
    let rules = BuiltinRuleRegistry::all_rules();
    let ctx = create_test_context(Some(semver::Version::new(0, 19, 1)));
    let checker = BevyApiChecker::new("src/api_clean.rs", &rules, &ctx);
    let violations = checker.check_file(&file);

    assert!(violations.is_empty(), "Modern Bevy API code should have 0 violations");
}

// ═════════════════════════════════════════════════════════════════════
// 2. BEVY-SCHED Rules Tests
// ═════════════════════════════════════════════════════════════════════

#[test]
fn test_bevy_sched_violations() {
    let code = indoc! {r#"
        fn bad_sync_system() {
            std::thread::sleep(std::time::Duration::from_millis(50));
            let rt = tokio::runtime::Runtime::new().unwrap();
            rt.block_on(async { do_async_work().await });
        }
    "#};

    let file: syn::File = syn::parse_str(code).unwrap();
    let rules = BuiltinRuleRegistry::all_rules();
    let ctx = create_test_context(None);
    let checker = BevySchedChecker::new("src/sched.rs", &rules, &ctx);
    let violations = checker.check_file(&file);

    let ids: Vec<&str> = violations.iter().map(|v| v.rule_id.as_str()).collect();
    assert!(ids.contains(&"BEVY-SCHED-001"), "Expected thread::sleep violation");
    assert!(ids.contains(&"BEVY-SCHED-002"), "Expected block_on violation");
    assert!(ids.contains(&"BEVY-SCHED-004"), "Expected Runtime::new violation");
}

// ═════════════════════════════════════════════════════════════════════
// 3. BEVY-ECS Rules Tests
// ═════════════════════════════════════════════════════════════════════

#[test]
fn test_bevy_ecs_violations() {
    let code = indoc! {r#"
        #[derive(Component)]
        pub struct GodMonster {
            pub a: i32, pub b: i32, pub c: i32, pub d: i32,
            pub e: i32, pub f: i32, pub g: i32, pub h: i32,
        }

        #[derive(Resource)]
        pub struct GlobalEntityState {
            pub entities: std::collections::HashMap<Entity, PlayerData>,
        }

        fn bad_despawn(mut commands: Commands, e: Entity) {
            commands.entity(e).despawn();
        }

        fn unused_mut_query(query: Query<&mut Health>) {
            for h in query.iter() {
                println!("{}", h.points);
            }
        }
    "#};

    let file: syn::File = syn::parse_str(code).unwrap();
    let rules = BuiltinRuleRegistry::all_rules();
    let ctx = create_test_context(Some(semver::Version::new(0, 14, 0)));
    let checker = BevyEcsChecker::new("src/ecs.rs", &rules, &ctx);
    let violations = checker.check_file(&file);

    let ids: Vec<&str> = violations.iter().map(|v| v.rule_id.as_str()).collect();
    assert!(ids.contains(&"BEVY-ECS-001"), "Expected God Component");
    assert!(ids.contains(&"BEVY-ECS-003"), "Expected HashMap<Entity, T> in Resource");
    assert!(ids.contains(&"BEVY-ECS-006"), "Expected Unused mut Query");
    assert!(ids.contains(&"BEVY-ECS-007"), "Expected despawn without recursive style warning");
}

// ═════════════════════════════════════════════════════════════════════
// 4. BEVY-QUERY Rules Tests
// ═════════════════════════════════════════════════════════════════════

#[test]
fn test_bevy_query_violations() {
    let code = indoc! {r#"
        fn dangerous_query(player_query: Query<&Transform, With<Player>>) {
            let player = player_query.single();
        }

        fn unconsumed_events(mut ev_reader: EventReader<AppExit>) {
            println!("No read call on ev_reader");
        }

        fn conflicting_access(mut a: ResMut<GameScore>, b: Res<GameScore>) {
            a.val += b.val;
        }
    "#};

    let file: syn::File = syn::parse_str(code).unwrap();
    let rules = BuiltinRuleRegistry::all_rules();
    let ctx = create_test_context(None);
    let checker = BevyQueryChecker::new("src/query.rs", &rules, &ctx);
    let violations = checker.check_file(&file);

    let ids: Vec<&str> = violations.iter().map(|v| v.rule_id.as_str()).collect();
    assert!(ids.contains(&"BEVY-QUERY-001"), "Expected query.single() panic violation");
    assert!(ids.contains(&"BEVY-QUERY-004"), "Expected unconsumed EventReader violation");
    assert!(ids.contains(&"BEVY-QUERY-005"), "Expected ResMut and Res same type conflict");
}

// ═════════════════════════════════════════════════════════════════════
// 5. BEVY-ASYNC Rules Tests
// ═════════════════════════════════════════════════════════════════════

#[test]
fn test_bevy_async_violations() {
    let code = indoc! {r#"
        fn detached_task_system() {
            IoTaskPool::get().spawn(async move {
                do_background_network();
            }).detach();
        }

        fn direct_blocking_db_call() {
            let conn = surrealdb::engine::remote::ws::Ws::new();
        }
    "#};

    let file: syn::File = syn::parse_str(code).unwrap();
    let rules = BuiltinRuleRegistry::all_rules();
    let ctx = create_test_context(None);
    let checker = BevyAsyncChecker::new("src/async.rs", &rules, &ctx);
    let violations = checker.check_file(&file);

    let ids: Vec<&str> = violations.iter().map(|v| v.rule_id.as_str()).collect();
    assert!(ids.contains(&"BEVY-ASYNC-004"), "Expected Task::detach violation");
    assert!(ids.contains(&"BEVY-ASYNC-003"), "Expected direct blocking surrealdb call");
}

// ═════════════════════════════════════════════════════════════════════
// 6. BEVY-PERF Rules Tests & Full Orchestration
// ═════════════════════════════════════════════════════════════════════

#[test]
fn test_bevy_perf_and_full_orchestration() {
    let code = indoc! {r#"
        #[derive(Resource)]
        pub struct TextureCache {
            pub handles: Vec<Handle<Image>>,
        }

        fn tick_update(
            mut meshes: ResMut<Assets<Mesh>>,
            asset_server: Res<AssetServer>,
            mut commands: Commands,
            mut transforms: Query<&mut Transform>,
        ) {
            let new_mesh = meshes.add(Mesh::from(Cuboid::default()));
            let tex = asset_server.load("textures/brick.png");

            for i in 0..50 {
                commands.spawn((Enemy, Health(50)));
            }

            for mut t in transforms.iter_mut() {
                *t = Transform::from_xyz(0.0, 0.0, 0.0);
            }
        }
    "#};

    let file: syn::File = syn::parse_str(code).unwrap();
    let rules = BuiltinRuleRegistry::all_rules();
    let ctx = create_test_context(None);

    let perf_checker = BevyPerfChecker::new("src/perf_game.rs", &rules, &ctx);
    let perf_violations = perf_checker.check_file(&file);
    assert!(!perf_violations.is_empty(), "BevyPerfChecker should detect violations");

    let violations = run_all_bevy_checks(&file, "src/perf_game.rs", &rules, &ctx);

    let ids: Vec<&str> = violations.iter().map(|v| v.rule_id.as_str()).collect();
    assert!(ids.contains(&"BEVY-PERF-ASSET-001"), "Expected assets.add in Update");
    assert!(ids.contains(&"BEVY-PERF-ASSET-003"), "Expected asset_server.load in Update");
    assert!(ids.contains(&"BEVY-PERF-ECS-002"), "Expected spawn in loop without spawn_batch");
    assert!(ids.contains(&"BEVY-PERF-CHANGE-001"), "Expected unconditional *transform assignment");
    assert!(ids.contains(&"BEVY-PERF-MEM-002"), "Expected Vec<Handle<T>> in Resource");
}
