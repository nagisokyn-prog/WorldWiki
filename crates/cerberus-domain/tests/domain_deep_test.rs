use cerberus_domain::{
    ArchLayer, Category, DirNode, FileMetrics, FileMetricsNode, HealthLevel, LayerRule,
    LayerTopologyMatrix, PackageArchMetadata, PackageMetrics, PackageNode, PressureCalculator,
    PressureWeights, Severity, TreeItemNode, TreeReport, Violation, WorkspaceArchMetadata,
};
use std::collections::HashMap;
use std::path::PathBuf;

#[test]
fn test_arch_layer_parsing_and_as_str() {
    assert_eq!(ArchLayer::parse("domain"), ArchLayer::Domain);
    assert_eq!(ArchLayer::Domain.as_str(), "domain");
    assert_eq!(ArchLayer::parse("ports"), ArchLayer::Ports);
    assert_eq!(ArchLayer::Ports.as_str(), "ports");
    assert_eq!(ArchLayer::parse("application"), ArchLayer::Application);
    assert_eq!(ArchLayer::Application.as_str(), "application");
    assert_eq!(ArchLayer::parse("infrastructure"), ArchLayer::Infrastructure);
    assert_eq!(ArchLayer::Infrastructure.as_str(), "infrastructure");
    assert_eq!(ArchLayer::parse("tauri"), ArchLayer::Adapter);
    assert_eq!(ArchLayer::Adapter.as_str(), "adapter");
    assert_eq!(ArchLayer::parse("cli"), ArchLayer::Cli);
    assert_eq!(ArchLayer::Cli.as_str(), "cli");
    assert_eq!(ArchLayer::parse("random"), ArchLayer::Unknown);
    assert_eq!(ArchLayer::Unknown.as_str(), "unknown");
}

#[test]
fn test_arch_layer_dependency_matrix_rules() {
    // Domain can ONLY depend on Domain
    assert!(ArchLayer::Domain.can_depend_on(ArchLayer::Domain));
    assert!(!ArchLayer::Domain.can_depend_on(ArchLayer::Ports));
    assert!(!ArchLayer::Domain.can_depend_on(ArchLayer::Application));
    assert!(!ArchLayer::Domain.can_depend_on(ArchLayer::Infrastructure));

    // Ports can depend on Domain & Ports
    assert!(ArchLayer::Ports.can_depend_on(ArchLayer::Domain));
    assert!(ArchLayer::Ports.can_depend_on(ArchLayer::Ports));
    assert!(!ArchLayer::Ports.can_depend_on(ArchLayer::Infrastructure));

    // Application can depend on Domain & Ports & Application
    assert!(ArchLayer::Application.can_depend_on(ArchLayer::Domain));
    assert!(ArchLayer::Application.can_depend_on(ArchLayer::Ports));
    assert!(!ArchLayer::Application.can_depend_on(ArchLayer::Infrastructure));

    // Infrastructure can depend on Domain & Ports & Infrastructure
    assert!(ArchLayer::Infrastructure.can_depend_on(ArchLayer::Domain));
    assert!(ArchLayer::Infrastructure.can_depend_on(ArchLayer::Ports));
    assert!(!ArchLayer::Infrastructure.can_depend_on(ArchLayer::Application));

    // Adapter / CLI / Unknown can depend on anything
    assert!(ArchLayer::Cli.can_depend_on(ArchLayer::Infrastructure));
    assert!(ArchLayer::Adapter.can_depend_on(ArchLayer::Application));
    assert!(ArchLayer::Unknown.can_depend_on(ArchLayer::Domain));
}

#[test]
fn test_layer_metadata_structs_serde() {
    let meta = WorkspaceArchMetadata {
        preset: Some("hexagonal".into()),
        layers: HashMap::from([(
            "domain".into(),
            LayerRule {
                allowed_dependencies: vec!["ports".into()],
                forbidden_external_dependencies: vec!["reqwest".into()],
            },
        )]),
        enforce_module_boundaries: true,
    };
    let json = serde_json::to_string(&meta).unwrap();
    let parsed: WorkspaceArchMetadata = serde_json::from_str(&json).unwrap();
    assert_eq!(meta, parsed);

    let pkg = PackageArchMetadata {
        layer: Some("domain".into()),
        ignore: vec![],
    };
    let pkg_json = serde_json::to_string(&pkg).unwrap();
    let pkg_parsed: PackageArchMetadata = serde_json::from_str(&pkg_json).unwrap();
    assert_eq!(pkg, pkg_parsed);
}

#[test]
fn test_layer_topology_matrix_presets_and_custom() {
    // 0. Default matrix
    let def_matrix = LayerTopologyMatrix::default();
    assert_eq!(def_matrix.preset_name, "hexagonal");
    assert!(def_matrix.is_dependency_allowed("application", "domain"));

    // 1. Hexagonal preset
    let hex = LayerTopologyMatrix::preset_matrix("hexagonal");
    assert!(hex.is_dependency_allowed("application", "domain"));
    assert!(hex.is_dependency_allowed("infrastructure", "ports"));
    assert!(!hex.is_dependency_allowed("domain", "infrastructure"));
    assert!(hex.is_external_dep_forbidden("domain", "reqwest"));
    assert!(!hex.is_external_dep_forbidden("infrastructure", "reqwest"));

    // 2. Layered N-Tier
    let layered = LayerTopologyMatrix::preset_matrix("layered");
    assert!(layered.is_dependency_allowed("controller", "service"));
    assert!(layered.is_dependency_allowed("service", "repository"));
    assert!(!layered.is_dependency_allowed("controller", "repository"));
    assert!(!layered.is_dependency_allowed("service", "controller"));

    // 3. Clean architecture
    let clean = LayerTopologyMatrix::preset_matrix("clean");
    assert!(clean.is_dependency_allowed("usecase", "entity"));
    assert!(!clean.is_dependency_allowed("entity", "usecase"));

    // 4. Modular Monolith
    let modular = LayerTopologyMatrix::preset_matrix("modular_monolith");
    assert!(modular.enforce_boundaries);

    // 5. CQRS
    let cqrs = LayerTopologyMatrix::preset_matrix("cqrs");
    assert!(cqrs.is_dependency_allowed("command_handler", "domain_write"));
    assert!(!cqrs.is_dependency_allowed("command_handler", "read_db"));

    // 6. Onion
    let onion = LayerTopologyMatrix::preset_matrix("onion");
    assert!(onion.is_dependency_allowed("application_services", "domain_services"));
    assert!(!onion.is_dependency_allowed("domain_core", "infrastructure"));

    // 7. Microkernel
    let microkernel = LayerTopologyMatrix::preset_matrix("microkernel");
    assert!(microkernel.is_dependency_allowed("plugin", "core_api"));
    assert!(!microkernel.is_dependency_allowed("core", "plugin"));

    // 8. Actor
    let actor = LayerTopologyMatrix::preset_matrix("actor");
    assert!(actor.is_dependency_allowed("worker_actor", "messages"));

    // 9. Serverless
    let serverless = LayerTopologyMatrix::preset_matrix("serverless");
    assert!(serverless.is_dependency_allowed("handler", "shared"));

    // 10. Vue FSD
    let fsd = LayerTopologyMatrix::preset_matrix("vue_fsd");
    assert!(fsd.is_dependency_allowed("pages", "widgets"));
    assert!(fsd.is_dependency_allowed("widgets", "features"));
    assert!(fsd.is_dependency_allowed("features", "entities"));
    assert!(fsd.is_dependency_allowed("entities", "shared"));
    assert!(!fsd.is_dependency_allowed("entities", "features"));
    assert!(!fsd.is_dependency_allowed("shared", "entities"));

    // 11. BFF
    let bff = LayerTopologyMatrix::preset_matrix("bff");
    assert!(bff.is_dependency_allowed("bff_gateway", "domain_client"));

    // 12. Event Driven
    let evt = LayerTopologyMatrix::preset_matrix("event_driven");
    assert!(evt.is_dependency_allowed("producer", "events"));
    assert!(!evt.is_dependency_allowed("producer", "consumer"));

    // 13. Final boss
    let boss = LayerTopologyMatrix::preset_matrix("final_boss");
    assert!(boss.enforce_boundaries);
    assert!(boss.is_dependency_allowed("spa", "packages_components"));

    // 14. Unknown / Default fallback
    let unknown = LayerTopologyMatrix::preset_matrix("custom_nonexistent");
    assert_eq!(unknown.preset_name, "custom_nonexistent");

    // 15. Dynamic override from WorkspaceArchMetadata
    let mut custom_layers = HashMap::new();
    custom_layers.insert(
        "frontend".into(),
        LayerRule {
            allowed_dependencies: vec!["backend_api".into()],
            forbidden_external_dependencies: vec!["direct_db".into()],
        },
    );
    let ws_meta = WorkspaceArchMetadata {
        preset: Some("custom".into()),
        layers: custom_layers,
        enforce_module_boundaries: true,
    };
    let dyn_matrix = LayerTopologyMatrix::from_workspace_metadata(&ws_meta);
    assert!(dyn_matrix.enforce_boundaries);
    assert!(dyn_matrix.is_dependency_allowed("frontend", "backend_api"));
    assert!(!dyn_matrix.is_dependency_allowed("frontend", "direct_db"));
    assert!(dyn_matrix.is_external_dep_forbidden("frontend", "direct_db"));
    assert!(!dyn_matrix.is_external_dep_forbidden("backend_api", "direct_db"));
}

#[test]
fn test_package_metrics_calculation() {
    let metrics = PackageMetrics::compute("domain".into(), 10, 0, 8, 10);
    assert_eq!(metrics.instability, 0.0);
    assert_eq!(metrics.abstractness, 0.8);
    assert!((metrics.distance_from_main_sequence - 0.2).abs() < 1e-6);
    assert!(!metrics.in_zone_of_pain);

    let pain = PackageMetrics::compute("concrete_god".into(), 10, 0, 0, 10);
    assert!(pain.in_zone_of_pain);

    let empty_metrics = PackageMetrics::compute("empty".into(), 0, 0, 0, 0);
    assert_eq!(empty_metrics.instability, 0.0);
    assert_eq!(empty_metrics.abstractness, 0.0);
}

#[test]
fn test_file_metrics_and_pressure_calculation() {
    let weights = PressureWeights::default();
    let file_metrics = FileMetrics::compute(
        PathBuf::from("src/domain/entity.rs"),
        100,
        10,
        5,
        4,
        3,
        0.1,
        &weights,
    );

    assert_eq!(file_metrics.sloc, 100);
    assert_eq!(file_metrics.functions, 10);
    assert_eq!(file_metrics.cyclomatic, 5);
    assert_eq!(file_metrics.dependencies, 4);
    assert_eq!(file_metrics.ast_depth, 3);
    assert!((file_metrics.distance_d - 0.1).abs() < 1e-6);
    assert!((file_metrics.pressure_score - 65.0).abs() < 1e-6);
}

#[test]
fn test_pressure_calculator_score() {
    let violations = vec![
        Violation {
            rule_id: "ARCH-001".into(),
            rule_version: "1.0".into(),
            category: Category::Architecture,
            severity: Severity::Deny,
            file: PathBuf::from("test.rs"),
            line: 1,
            column: 1,
            symbol: "fn".into(),
            snippet: "use tauri;".into(),
            message: "err".into(),
            remediation: "fix".into(),
            fingerprint: "fp1".into(),
        },
        Violation {
            rule_id: "CSS-003".into(),
            rule_version: "1.0".into(),
            category: Category::Convention,
            severity: Severity::Warn,
            file: PathBuf::from("test.css"),
            line: 1,
            column: 1,
            symbol: "css".into(),
            snippet: "dup".into(),
            message: "err".into(),
            remediation: "fix".into(),
            fingerprint: "fp2".into(),
        },
    ];

    let score = PressureCalculator::compute_score(&violations, 100);
    assert_eq!(score, 130.0);

    let zero = PressureCalculator::compute_score(&[], 0);
    assert_eq!(zero, 0.0);
}

#[test]
fn test_tree_report_aggregation_and_serialization() {
    let file1 = FileMetricsNode {
        name: "ok.rs".into(),
        path: PathBuf::from("src/ok.rs"),
        sloc: 50,
        functions: 5,
        cyclomatic: 3,
        dependencies: 2,
        ast_depth: 2,
        pressure: 15.0,
        health: HealthLevel::Healthy,
    };

    let file2 = FileMetricsNode {
        name: "heavy.rs".into(),
        path: PathBuf::from("src/heavy.rs"),
        sloc: 550,
        functions: 30,
        cyclomatic: 40,
        dependencies: 15,
        ast_depth: 8,
        pressure: 320.0,
        health: HealthLevel::Critical,
    };

    let file2_hotspot = FileMetricsNode {
        name: "extreme.rs".into(),
        path: PathBuf::from("src/extreme.rs"),
        sloc: 900,
        functions: 50,
        cyclomatic: 60,
        dependencies: 25,
        ast_depth: 10,
        pressure: 500.0,
        health: HealthLevel::Critical,
    };

    let file2_equal_hotspot = FileMetricsNode {
        name: "equal_extreme.rs".into(),
        path: PathBuf::from("src/equal_extreme.rs"),
        sloc: 900,
        functions: 50,
        cyclomatic: 60,
        dependencies: 25,
        ast_depth: 10,
        pressure: 500.0,
        health: HealthLevel::Critical,
    };

    let file3 = FileMetricsNode {
        name: "warn.rs".into(),
        path: PathBuf::from("src/sub/nested/warn.rs"),
        sloc: 320,
        functions: 15,
        cyclomatic: 12,
        dependencies: 5,
        ast_depth: 4,
        pressure: 160.0,
        health: HealthLevel::Warning,
    };

    let deep_dir = DirNode {
        name: "nested".into(),
        path: PathBuf::from("src/sub/nested"),
        children: vec![TreeItemNode::File(file3)],
    };

    let sub_dir = DirNode {
        name: "sub".into(),
        path: PathBuf::from("src/sub"),
        children: vec![TreeItemNode::Dir(deep_dir)],
    };

    let pkg = PackageNode {
        name: "my_crate".into(),
        path: PathBuf::from("crates/my_crate"),
        ca: 2,
        ce: 1,
        instability: 0.33,
        abstractness: 0.20,
        distance: 0.47,
        is_zone_of_pain: false,
        children: vec![
            TreeItemNode::File(file1.clone()),
            TreeItemNode::File(file2.clone()),
            TreeItemNode::File(file2_hotspot.clone()),
            TreeItemNode::File(file2_equal_hotspot.clone()),
            TreeItemNode::Dir(sub_dir.clone()),
        ],
    };

    let report = TreeReport::new(vec![pkg.clone()]);
    assert_eq!(report.total_files, 5);
    assert_eq!(report.healthy_count, 1);
    assert_eq!(report.warning_count, 1);
    assert_eq!(report.critical_count, 3);
    assert_eq!(report.hotspots.len(), 3);
    assert!((report.avg_distance - 0.47).abs() < 1e-4);

    let empty_report = TreeReport::new(vec![]);
    assert_eq!(empty_report.total_files, 0);
    assert_eq!(empty_report.avg_distance, 0.0);

    assert_eq!(HealthLevel::Healthy.badge_symbol(), "✅");
    assert_eq!(HealthLevel::Warning.badge_symbol(), "⚠️");
    assert_eq!(HealthLevel::Critical.badge_symbol(), "🚨");
    assert_eq!(HealthLevel::Healthy, HealthLevel::Healthy);
    assert_ne!(HealthLevel::Healthy, HealthLevel::Warning);

    let _ = format!("{:?} {:?} {:?} {:?} {:?}", HealthLevel::Healthy, file1, sub_dir, pkg, report);
    let cloned_item = TreeItemNode::Dir(sub_dir.clone()).clone();
    let _ = format!("{:?}", cloned_item);

    let json = serde_json::to_string(&report).unwrap();
    let deserialized: TreeReport = serde_json::from_str(&json).unwrap();
    assert_eq!(deserialized.total_files, report.total_files);
    assert_eq!(deserialized.critical_count, report.critical_count);
}
