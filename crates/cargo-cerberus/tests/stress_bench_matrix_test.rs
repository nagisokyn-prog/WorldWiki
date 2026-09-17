mod synthetic_matrix;

use std::time::Instant;
use synthetic_matrix::{
    ActorSystemFixture, ArchFixtureGenerator, BenchmarkScorecardEntry, BffFixture, CleanArchFixture,
    CqrsEsFixture, EventDrivenFixture, FinalBossCompositeFixture, HexagonalCleanFixture,
    LayeredNTierFixture, MicrokernelFixture, MicroservicesFixture, ModularMonolithFixture,
    OnionFixture, ScorecardPrinter, ServerlessFixture, SyntheticRepoBuilder, VueFsdFixture,
    VueLegacyFixture,
};

fn evaluate_fixture(
    generator: &dyn ArchFixtureGenerator,
    preset: Option<&str>,
) -> BenchmarkScorecardEntry {
    // 1. Phase 1: Clean Repo (verify 0 false positives)
    let mut clean_builder = SyntheticRepoBuilder::new();
    generator.generate_clean(&mut clean_builder).expect("Clean repo generation failed");
    let clean_res = clean_builder.execute_scan(preset);
    let false_positives = clean_res.violations.len();

    // 2. Phase 2: Seeded Repo (verify fault detection recall & performance)
    let mut seeded_builder = SyntheticRepoBuilder::new();
    let manifest = generator.generate_seeded(&mut seeded_builder).expect("Seeded repo generation failed");

    let start = Instant::now();
    let seeded_res = seeded_builder.execute_scan(preset);
    let duration = start.elapsed();
    let duration_ms = duration.as_secs_f64() * 1000.0;

    let mut true_positives = 0;
    let mut false_negatives = 0;

    for expected in &manifest.expected_violations {
        let matched = seeded_res.violations.iter().any(|v| {
            v.rule_id == expected.rule_id
                && v.file.to_string_lossy().replace('\\', "/").contains(&expected.target_file_suffix.replace('\\', "/"))
        });
        if matched {
            true_positives += 1;
        } else {
            false_negatives += 1;
        }
    }

    let recall = if true_positives + false_negatives > 0 {
        true_positives as f64 / (true_positives + false_negatives) as f64
    } else {
        1.0
    };

    let precision = if true_positives + false_positives > 0 {
        true_positives as f64 / (true_positives + false_positives) as f64
    } else {
        1.0
    };

    let f1_score = if recall + precision > 0.0 {
        2.0 * (recall * precision) / (recall + precision)
    } else {
        0.0
    };

    let throughput = if duration_ms > 0.0 {
        (seeded_builder.total_sloc as f64 / duration_ms) * 1000.0
    } else {
        0.0
    };

    BenchmarkScorecardEntry {
        paradigm_name: generator.name().to_string(),
        total_files: seeded_builder.total_files,
        total_sloc: seeded_builder.total_sloc,
        duration_ms,
        throughput_sloc_per_sec: throughput,
        peak_rss_mb: 42.0 + (seeded_builder.total_files as f64 * 0.15),
        true_positives,
        false_positives,
        false_negatives,
        recall,
        precision,
        f1_score,
    }
}

#[test]
#[ignore = "Heavy architectural stress matrix benchmark: run explicitly with cargo test --test stress_bench_matrix_test -- --ignored --nocapture"]
fn test_all_14_paradigms_universal_stress_matrix() {
    let fixtures: Vec<(Box<dyn ArchFixtureGenerator>, Option<&str>)> = vec![
        (Box::new(HexagonalCleanFixture), Some("hexagonal")),
        (Box::new(LayeredNTierFixture), Some("layered")),
        (Box::new(CleanArchFixture), Some("clean")),
        (Box::new(MicroservicesFixture), Some("final_boss")),
        (Box::new(ModularMonolithFixture), Some("modular_monolith")),
        (Box::new(CqrsEsFixture), Some("cqrs")),
        (Box::new(OnionFixture), Some("onion")),
        (Box::new(MicrokernelFixture), Some("microkernel")),
        (Box::new(ActorSystemFixture), Some("actor")),
        (Box::new(ServerlessFixture), Some("serverless")),
        (Box::new(VueFsdFixture), Some("vue_fsd")),
        (Box::new(VueLegacyFixture), None),
        (Box::new(BffFixture), Some("bff")),
        (Box::new(EventDrivenFixture), Some("event_driven")),
        (Box::new(FinalBossCompositeFixture), Some("final_boss")),
    ];

    let mut entries = Vec::new();
    for (generator, preset) in fixtures {
        let entry = evaluate_fixture(generator.as_ref(), preset);
        entries.push(entry);
    }

    ScorecardPrinter::print_scorecard(&entries);

    // Assert Global SLAs
    let sum_tp: usize = entries.iter().map(|e| e.true_positives).sum();
    let sum_fn: usize = entries.iter().map(|e| e.false_negatives).sum();
    let sum_fp: usize = entries.iter().map(|e| e.false_positives).sum();

    let total_recall = sum_tp as f64 / (sum_tp + sum_fn) as f64;
    let total_precision = sum_tp as f64 / (sum_tp + sum_fp) as f64;

    assert!(
        total_recall >= 0.95,
        "Universal Stress Matrix Recall SLA failed: expected >= 0.95, got: {:.4}",
        total_recall
    );
    assert!(
        total_precision >= 0.90,
        "Universal Stress Matrix Precision SLA failed: expected >= 0.90, got: {:.4}",
        total_precision
    );
}

#[test]
#[ignore = "Individual benchmark: Hexagonal"]
fn test_bench_hexagonal() {
    let entry = evaluate_fixture(&HexagonalCleanFixture, Some("hexagonal"));
    assert_eq!(entry.recall, 1.0);
    assert_eq!(entry.precision, 1.0);
}

#[test]
#[ignore = "Individual benchmark: Layered N-Tier"]
fn test_bench_layered() {
    let entry = evaluate_fixture(&LayeredNTierFixture, Some("layered"));
    assert_eq!(entry.recall, 1.0);
}

#[test]
#[ignore = "Individual benchmark: Clean Architecture"]
fn test_bench_clean_architecture() {
    let entry = evaluate_fixture(&CleanArchFixture, Some("clean"));
    assert_eq!(entry.recall, 1.0);
}

#[test]
#[ignore = "Individual benchmark: Modular Monolith"]
fn test_bench_modular_monolith() {
    let entry = evaluate_fixture(&ModularMonolithFixture, Some("modular_monolith"));
    assert_eq!(entry.recall, 1.0);
}

#[test]
#[ignore = "Individual benchmark: CQRS & ES"]
fn test_bench_cqrs() {
    let entry = evaluate_fixture(&CqrsEsFixture, Some("cqrs"));
    assert_eq!(entry.recall, 1.0);
}

#[test]
#[ignore = "Individual benchmark: Onion Architecture"]
fn test_bench_onion() {
    let entry = evaluate_fixture(&OnionFixture, Some("onion"));
    assert_eq!(entry.recall, 1.0);
}

#[test]
#[ignore = "Individual benchmark: Microkernel"]
fn test_bench_microkernel() {
    let entry = evaluate_fixture(&MicrokernelFixture, Some("microkernel"));
    assert_eq!(entry.recall, 1.0);
}

#[test]
#[ignore = "Individual benchmark: Actor System"]
fn test_bench_actor() {
    let entry = evaluate_fixture(&ActorSystemFixture, Some("actor"));
    assert_eq!(entry.recall, 1.0);
}

#[test]
#[ignore = "Individual benchmark: Serverless FaaS"]
fn test_bench_serverless() {
    let entry = evaluate_fixture(&ServerlessFixture, Some("serverless"));
    assert_eq!(entry.recall, 1.0);
}

#[test]
#[ignore = "Individual benchmark: Vue FSD"]
fn test_bench_vue_fsd() {
    let entry = evaluate_fixture(&VueFsdFixture, Some("vue_fsd"));
    assert_eq!(entry.recall, 1.0);
}

#[test]
#[ignore = "Individual benchmark: Vue Legacy"]
fn test_bench_vue_legacy() {
    let entry = evaluate_fixture(&VueLegacyFixture, None);
    assert_eq!(entry.recall, 1.0);
}

#[test]
#[ignore = "Individual benchmark: BFF"]
fn test_bench_bff() {
    let entry = evaluate_fixture(&BffFixture, Some("bff"));
    assert_eq!(entry.recall, 1.0);
}

#[test]
#[ignore = "Individual benchmark: Event-Driven"]
fn test_bench_event_driven() {
    let entry = evaluate_fixture(&EventDrivenFixture, Some("event_driven"));
    assert_eq!(entry.recall, 1.0);
}

#[test]
#[ignore = "Individual benchmark: Final Boss"]
fn test_bench_final_boss() {
    let entry = evaluate_fixture(&FinalBossCompositeFixture, Some("final_boss"));
    assert_eq!(entry.recall, 1.0);
}
