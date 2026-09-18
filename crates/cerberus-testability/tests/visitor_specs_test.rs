use std::path::Path;
use tempfile::tempdir;
use cerberus_testability::domain::{
    DampingMath, LayerContext, TestabilityArchetype, TestabilityFactor, TestabilityTier,
    WorkspaceTestabilityReport,
};
use cerberus_testability::application::{
    AnalyzeWorkspaceTestabilityUseCase, ComputeTestabilityUseCase,
};
use cerberus_testability::infrastructure::ConsoleTestabilityRenderer;

#[test]
fn test_factor_metadata_and_weights() {
    let factors = [
        TestabilityFactor::F01HiddenAmbientIo,
        TestabilityFactor::F02DirectOsFsAccess,
        TestabilityFactor::F03SharedGlobalMutableState,
        TestabilityFactor::F04SideEffectingConstructor,
        TestabilityFactor::F05HeavyMultiLineClosure,
        TestabilityFactor::F06ConcreteCouplingInBoundary,
        TestabilityFactor::Conc002OrphanConcurrency,
    ];

    for factor in factors {
        assert!(!factor.code().is_empty());
        assert!(!factor.name().is_empty());
        assert!(!factor.description().is_empty());

        let w_dom = factor.base_weight(LayerContext::Domain);
        let w_app = factor.base_weight(LayerContext::Application);
        let w_inf = factor.base_weight(LayerContext::Infrastructure);
        let w_unk = factor.base_weight(LayerContext::Unknown);

        assert!(w_dom >= w_app);
        assert!(w_app >= w_unk);
        assert!(w_unk >= w_inf);

        assert!(factor.unit_ratio() > 0.0);
        assert!(factor.integration_ratio() >= 0.0);
    }
}

#[test]
fn test_archetypes_and_dominance_rules() {
    let pure = TestabilityArchetype::Pure;
    let mock = TestabilityArchetype::Mockable;
    let int_bound = TestabilityArchetype::IntBound;
    let flaky = TestabilityArchetype::Flaky;
    let poison = TestabilityArchetype::Poisoned;

    assert_eq!(pure.t_unit(), 100.0);
    assert_eq!(pure.t_int(), 100.0);
    assert_eq!(pure.ti(), 100.0);

    assert_eq!(mock.t_unit(), 85.0);
    assert_eq!(mock.t_int(), 90.0);
    assert_eq!(mock.ti(), 86.5);

    assert_eq!(int_bound.t_unit(), 25.0);
    assert_eq!(int_bound.t_int(), 85.0);
    assert_eq!(int_bound.ti(), 43.0);

    assert_eq!(flaky.t_unit(), 15.0);
    assert_eq!(flaky.t_int(), 35.0);
    assert_eq!(flaky.ti(), 21.0);

    assert_eq!(poison.t_unit(), 5.0);
    assert_eq!(poison.t_int(), 15.0);
    assert_eq!(poison.ti(), 8.0);

    // Dominance order: Poisoned > Flaky > IntBound > Mockable > Pure
    assert_eq!(pure.combine(mock), mock);
    assert_eq!(mock.combine(int_bound), int_bound);
    assert_eq!(int_bound.combine(flaky), flaky);
    assert_eq!(flaky.combine(poison), poison);
    assert_eq!(pure.combine(poison), poison);
}

#[test]
fn test_layer_context_resolution() {
    assert_eq!(LayerContext::Domain.as_str(), "Domain");
    assert_eq!(LayerContext::Application.as_str(), "Application");
    assert_eq!(LayerContext::Infrastructure.as_str(), "Infrastructure");
    assert_eq!(LayerContext::Unknown.as_str(), "Unknown");

    assert_eq!(LayerContext::from_str_loose("core_domain_logic"), LayerContext::Domain);
    assert_eq!(LayerContext::from_str_loose("use_case_application"), LayerContext::Application);
    assert_eq!(LayerContext::from_str_loose("tauri_adapter_storage"), LayerContext::Infrastructure);
    assert_eq!(LayerContext::from_str_loose("random_helper"), LayerContext::Unknown);

    assert_eq!(LayerContext::from_path(Path::new("crates/domain/src/lib.rs")), LayerContext::Domain);
    assert_eq!(LayerContext::from_path(Path::new("crates/application/src/lib.rs")), LayerContext::Application);
    assert_eq!(LayerContext::from_path(Path::new("crates/infrastructure/src/lib.rs")), LayerContext::Infrastructure);
    assert_eq!(LayerContext::from_path(Path::new("crates/tools/src/lib.rs")), LayerContext::Unknown);
}

#[test]
fn test_sloc_damping_math() {
    let d0 = DampingMath::calculate_sloc_damping(0);
    let d30 = DampingMath::calculate_sloc_damping(30);
    let d300 = DampingMath::calculate_sloc_damping(300);
    let d3000 = DampingMath::calculate_sloc_damping(3000);

    assert_eq!(d0, 1.0);
    assert_eq!(d30, 1.0);
    assert!(d300 < d30);
    assert!(d3000 < d300);

    let (u0, i0) = DampingMath::calculate_factor_penalty(
        TestabilityFactor::F01HiddenAmbientIo,
        0,
        100,
        LayerContext::Domain,
    );
    assert_eq!(u0, 0.0);
    assert_eq!(i0, 0.0);

    let (u1, i1) = DampingMath::calculate_factor_penalty(
        TestabilityFactor::F01HiddenAmbientIo,
        2,
        50,
        LayerContext::Domain,
    );
    assert!(u1 > 0.0);
    assert!(i1 > 0.0);
    assert!(u1 > i1);
}

#[test]
fn test_tiers_and_workspace_report() {
    assert_eq!(TestabilityTier::from_score(95.0), TestabilityTier::S);
    assert_eq!(TestabilityTier::from_score(85.0), TestabilityTier::A);
    assert_eq!(TestabilityTier::from_score(75.0), TestabilityTier::B);
    assert_eq!(TestabilityTier::from_score(55.0), TestabilityTier::C);
    assert_eq!(TestabilityTier::from_score(35.0), TestabilityTier::D);
    assert_eq!(TestabilityTier::from_score(15.0), TestabilityTier::F);

    assert_eq!(TestabilityTier::S.as_str(), "S");
    assert_eq!(TestabilityTier::A.as_str(), "A");
    assert_eq!(TestabilityTier::B.as_str(), "B");
    assert_eq!(TestabilityTier::C.as_str(), "C");
    assert_eq!(TestabilityTier::D.as_str(), "D");
    assert_eq!(TestabilityTier::F.as_str(), "F");

    let empty_report = WorkspaceTestabilityReport::new(Vec::new());
    assert_eq!(empty_report.total_files, 0);
    assert_eq!(empty_report.workspace_score, 100.0);
    assert_eq!(empty_report.workspace_tier, TestabilityTier::S);
}

#[test]
fn test_ast_frictions_detection() {
    let source_all_factors = r#"
use std::collections::HashMap;

static mut GLOBAL_MAP: Option<HashMap<String, u32>> = None;

pub struct DatabaseConnection;

pub struct GodService {
    pub db: DatabaseConnection,
}

impl GodService {
    pub fn new() -> Self {
        let _ = std::fs::read_to_string("test.txt");
        let _time = std::time::SystemTime::now();
        let _inst = std::time::Instant::now();
        let _uuid = uuid::Uuid::new_v4();
        tokio::spawn(async {});
        Self { db: DatabaseConnection }
    }

    pub fn process(&self) -> Result<(), String> {
        let res: Result<(), std::io::Error> = Ok(());
        res.map_err(|e| {
            let msg = format!("error: {}", e);
            let timestamp = 12345;
            format!("{}: {}", timestamp, msg)
        })
    }
}
"#;

    let report = ComputeTestabilityUseCase::compute_for_source(
        "src/god_service.rs",
        source_all_factors,
        LayerContext::Domain,
    );

    assert!(report.frictions.len() >= 5);
    assert_eq!(report.archetype, TestabilityArchetype::Poisoned);
    assert_eq!(report.t_composite, 8.0);
    assert!(report.sloc > 10);
}

#[test]
fn test_renderer_and_workspace_analysis() {
    let dir = tempdir().unwrap();
    let file1 = dir.path().join("domain.rs");
    let file2 = dir.path().join("service.rs");

    std::fs::write(&file1, "pub fn add(a: i32, b: i32) -> i32 { a + b }\n").unwrap();
    std::fs::write(&file2, "pub fn fail() { let _ = std::time::SystemTime::now(); }\n").unwrap();

    let report = AnalyzeWorkspaceTestabilityUseCase::analyze_path(dir.path()).unwrap();
    assert_eq!(report.total_files, 2);

    let console_output = ConsoleTestabilityRenderer::render_report(&report);
    assert!(console_output.contains("TESTABILITY INDEX REPORT"));
    assert!(console_output.contains("domain.rs") || console_output.contains("service.rs"));

    let json_output = ConsoleTestabilityRenderer::render_json(&report).unwrap();
    assert!(json_output.contains("\"schema_version\": \"2.3.0\""));

    let mem_report = AnalyzeWorkspaceTestabilityUseCase::analyze_in_memory(&[
        ("test1.rs", "pub fn x() -> i32 { 42 }", LayerContext::Domain),
        ("test2.rs", "pub fn y() { let _ = std::time::SystemTime::now(); }", LayerContext::Domain),
    ]);
    assert_eq!(mem_report.total_files, 2);
    assert_eq!(mem_report.files[0].file_path, "test2.rs");
    assert_eq!(mem_report.files[1].file_path, "test1.rs");
}

#[test]
fn test_unparsable_source_fallback() {
    let unparsable = "pub fn not valid rust syntax { { {";
    let report = ComputeTestabilityUseCase::compute_for_source("invalid.rs", unparsable, LayerContext::Domain);
    assert_eq!(report.frictions.len(), 0);
    assert_eq!(report.archetype, TestabilityArchetype::Pure);
    assert_eq!(report.t_composite, 100.0);
}

#[test]
fn test_exhaustive_ast_visitor_branches() {
    let source_edge_branches = r#"
use std::collections::HashMap;
use std::sync::atomic::AtomicUsize;

static COUNTER: AtomicUsize = AtomicUsize::new(0);

struct PrivateService {
    db: DatabaseConnection, // Private struct: does not trigger F-06
}

pub struct PublicBoundary {
    pub stream: TcpStream,
    pub surreal: Surreal,
    pub client: ReqwestClient,
}

fn default() -> PublicBoundary {
    let _ = File::create("temp.dat");
    let _ = File::open("temp.dat");
    let _ = tokio::net::TcpListener::bind("127.0.0.1:8080");
    let _ = std::net::TcpListener::bind("127.0.0.1:8080");
    let _ = async_std::task::spawn(async {});
    let _ = rand::random::<u32>();
    panic!()
}

pub fn check_combinators() {
    let opt: Option<i32> = None;
    let _ = opt.unwrap_or_else(|| {
        let x = 1;
        let y = 2;
        x + y
    });

    let res: Result<i32, String> = Ok(1);
    let _ = res.and_then(|val| {
        let doubled = val * 2;
        let final_val = doubled + 10;
        Ok(final_val)
    });
}
"#;

    let report = ComputeTestabilityUseCase::compute_for_source(
        "src/edge_cases.rs",
        source_edge_branches,
        LayerContext::Domain,
    );

    assert!(report.frictions.len() >= 6);
    assert_eq!(report.archetype, TestabilityArchetype::Poisoned);
}

#[test]
fn test_renderer_all_tiers_and_long_paths() {
    use cerberus_testability::domain::{FileTestabilityReport, TestFriction};

    let files = vec![
        FileTestabilityReport {
            file_path: "short.rs".to_string(),
            layer: LayerContext::Domain,
            archetype: TestabilityArchetype::Pure,
            sloc: 50,
            t_unit: 100.0,
            t_integration: 100.0,
            t_composite: 100.0,
            tier: TestabilityTier::S,
            frictions: Vec::new(),
            triggers: Vec::new(),
        },
        FileTestabilityReport {
            file_path: "very_long_nested_path_to_some_very_deeply_nested_module_inside_application_crate.rs".to_string(),
            layer: LayerContext::Application,
            archetype: TestabilityArchetype::Mockable,
            sloc: 120,
            t_unit: 85.0,
            t_integration: 90.0,
            t_composite: 86.5,
            tier: TestabilityTier::A,
            frictions: vec![TestFriction {
                factor: TestabilityFactor::F05HeavyMultiLineClosure,
                line: 10,
                column: 5,
                snippet: "closure".to_string(),
                message: "msg".to_string(),
            }],
            triggers: vec!["Mockable interface".to_string()],
        },
        FileTestabilityReport {
            file_path: "tier_b.rs".to_string(),
            layer: LayerContext::Infrastructure,
            archetype: TestabilityArchetype::Mockable,
            sloc: 80,
            t_unit: 85.0,
            t_integration: 90.0,
            t_composite: 86.5,
            tier: TestabilityTier::A,
            frictions: vec![TestFriction {
                factor: TestabilityFactor::F04SideEffectingConstructor,
                line: 20,
                column: 1,
                snippet: "ctor".to_string(),
                message: "msg".to_string(),
            }],
            triggers: vec!["Mockable interface".to_string()],
        },
        FileTestabilityReport {
            file_path: "tier_c.rs".to_string(),
            layer: LayerContext::Infrastructure,
            archetype: TestabilityArchetype::IntBound,
            sloc: 200,
            t_unit: 25.0,
            t_integration: 85.0,
            t_composite: 43.0,
            tier: TestabilityTier::D,
            frictions: Vec::new(),
            triggers: vec!["Direct I/O".to_string()],
        },
        FileTestabilityReport {
            file_path: "tier_d.rs".to_string(),
            layer: LayerContext::Domain,
            archetype: TestabilityArchetype::Flaky,
            sloc: 90,
            t_unit: 15.0,
            t_integration: 35.0,
            t_composite: 21.0,
            tier: TestabilityTier::F,
            frictions: Vec::new(),
            triggers: vec!["SystemTime::now".to_string()],
        },
        FileTestabilityReport {
            file_path: "tier_f.rs".to_string(),
            layer: LayerContext::Domain,
            archetype: TestabilityArchetype::Poisoned,
            sloc: 300,
            t_unit: 5.0,
            t_integration: 15.0,
            t_composite: 8.0,
            tier: TestabilityTier::F,
            frictions: Vec::new(),
            triggers: vec!["static mut".to_string()],
        },
    ];

    let ws_report = WorkspaceTestabilityReport::new(files);
    let output = ConsoleTestabilityRenderer::render_report(&ws_report);
    assert!(output.contains("[S]"));
    assert!(output.contains("[A]"));
    assert!(output.contains("[D]"));
    assert!(output.contains("[F]"));
    assert!(output.contains("..."));

    // Test individual workspace tier titles
    for score in [95.0, 85.0, 75.0, 55.0, 35.0, 15.0] {
        let single_file = vec![FileTestabilityReport {
            file_path: "f.rs".to_string(),
            layer: LayerContext::Domain,
            archetype: TestabilityArchetype::Pure,
            sloc: 10,
            t_unit: score,
            t_integration: score,
            t_composite: score,
            tier: TestabilityTier::from_score(score),
            frictions: Vec::new(),
            triggers: Vec::new(),
        }];
        let r = WorkspaceTestabilityReport::new(single_file);
        let s = ConsoleTestabilityRenderer::render_report(&r);
        assert!(!s.is_empty());
    }
}
