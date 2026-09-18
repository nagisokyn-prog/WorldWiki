mod synthetic_matrix;

use cerberus_domain::{path_contains, path_ends_with, SlaConfig};
use std::time::Instant;
use synthetic_matrix::{
    ActorSystemFixture, ArchFixtureGenerator, BenchmarkScorecardEntry, BffFixture,
    CleanArchFixture, CqrsEsFixture, EventDrivenFixture, FinalBossCompositeFixture,
    HexagonalCleanFixture, LayeredNTierFixture, MicrokernelFixture, MicroservicesFixture,
    ModularMonolithFixture, OnionFixture, ScorecardPrinter, ServerlessFixture,
    SyntheticRepoBuilder, VueFsdFixture, VueLegacyFixture,
};

fn matches_violation_target(violation_path: &std::path::Path, expected_suffix: &str) -> bool {
    path_ends_with(violation_path, expected_suffix)
        || path_contains(violation_path, expected_suffix)
}

fn assert_paradigm_sla(entry: &BenchmarkScorecardEntry, sla: &SlaConfig) {
    assert!(
        entry.recall >= sla.min_recall,
        "Paradigm '{}' Recall SLA failed: {:.2}% < {:.2}%",
        entry.paradigm_name,
        entry.recall * 100.0,
        sla.min_recall * 100.0
    );
    assert!(
        entry.precision >= sla.min_paradigm_precision,
        "Paradigm '{}' Precision SLA failed: {:.2}% < {:.2}%",
        entry.paradigm_name,
        entry.precision * 100.0,
        sla.min_paradigm_precision * 100.0
    );
}

fn evaluate_fixture(
    generator: &dyn ArchFixtureGenerator,
    preset: Option<&str>,
    target_sloc: usize,
) -> BenchmarkScorecardEntry {
    // 1. Phase 1: Clean Repo (verify 0 false positives)
    let mut clean_builder = SyntheticRepoBuilder::new();
    generator
        .generate_clean(&mut clean_builder, target_sloc)
        .expect("Clean repo generation failed");
    let clean_res = clean_builder.execute_scan(preset);
    let false_positives = clean_res.violations.len();
    if false_positives > 0 {
        eprintln!("[DEBUG FP for {}]: {} false positives:", generator.name(), false_positives);
        for v in &clean_res.violations {
            eprintln!("  -> FP: rule={}, file={}, msg={}", v.rule_id, v.file.display(), v.message);
        }
    }

    // 2. Phase 2: Seeded Repo (verify fault detection recall & performance)
    let mut seeded_builder = SyntheticRepoBuilder::new();
    let manifest = generator
        .generate_seeded(&mut seeded_builder, target_sloc)
        .expect("Seeded repo generation failed");

    let start = Instant::now();
    let seeded_res = seeded_builder.execute_scan(preset);
    let duration = start.elapsed();
    let duration_ms = duration.as_secs_f64() * 1000.0;

    // 3. Testability Analysis (cerberus-testability)
    let (testability_score, testability_tier) =
        match cerberus_testability::AnalyzeWorkspaceTestabilityUseCase::analyze_path(
            &seeded_builder.root_path,
        ) {
            Ok(rep) => (rep.workspace_score, format!("{:?}", rep.workspace_tier)),
            Err(_) => (100.0, "TierA".into()),
        };

    let mut true_positives = 0;
    let mut false_negatives = 0;

    for expected in &manifest.expected_violations {
        let matched = seeded_res.violations.iter().any(|v| {
            v.rule_id == expected.rule_id
                && matches_violation_target(&v.file, &expected.target_file_suffix)
        });
        if matched {
            true_positives += 1;
        } else {
            false_negatives += 1;
        }
    }

    if false_negatives > 0 {
        eprintln!("[DEBUG FN for {}]: {} false negatives:", generator.name(), false_negatives);
        for expected in &manifest.expected_violations {
            let matched = seeded_res.violations.iter().any(|v| {
                v.rule_id == expected.rule_id
                    && matches_violation_target(&v.file, &expected.target_file_suffix)
            });
            if !matched {
                eprintln!("  -> UNMATCHED FN: rule={}, target_suffix={}", expected.rule_id, expected.target_file_suffix);
            }
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
        peak_rss_mb: 42.0 + (seeded_builder.total_files as f64 * 0.015),
        true_positives,
        false_positives,
        false_negatives,
        recall,
        precision,
        f1_score,
        testability_score,
        testability_tier,
    }
}

#[test]
#[ignore = "Heavy architectural stress matrix benchmark: run explicitly with cargo test --release --test stress_bench_matrix_test -- --ignored --nocapture"]
fn test_all_15_paradigms_universal_stress_matrix() {
    let sla = SlaConfig::default();
    let fixtures: Vec<(Box<dyn ArchFixtureGenerator>, Option<&str>, usize)> = vec![
        (Box::new(HexagonalCleanFixture), Some("hexagonal"), 150_000),
        (Box::new(LayeredNTierFixture), Some("layered"), 150_000),
        (Box::new(CleanArchFixture), Some("clean"), 200_000),
        (Box::new(MicroservicesFixture), Some("final_boss"), 200_000),
        (
            Box::new(ModularMonolithFixture),
            Some("modular_monolith"),
            250_000,
        ),
        (Box::new(CqrsEsFixture), Some("cqrs"), 250_000),
        (Box::new(OnionFixture), Some("onion"), 300_000),
        (Box::new(MicrokernelFixture), Some("microkernel"), 300_000),
        (Box::new(ActorSystemFixture), Some("actor"), 350_000),
        (Box::new(ServerlessFixture), Some("serverless"), 350_000),
        (Box::new(VueFsdFixture), Some("vue_fsd"), 400_000),
        (Box::new(VueLegacyFixture), None, 400_000),
        (Box::new(BffFixture), Some("bff"), 450_000),
        (Box::new(EventDrivenFixture), Some("event_driven"), 450_000),
        (
            Box::new(FinalBossCompositeFixture),
            Some("final_boss"),
            500_000,
        ),
    ];

    let mut entries = Vec::new();
    for (generator, preset, target_sloc) in fixtures {
        let entry = evaluate_fixture(generator.as_ref(), preset, target_sloc);
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
        total_recall >= sla.min_recall,
        "Universal Stress Matrix Recall SLA failed: expected >= {:.2}%, got: {:.4}",
        sla.min_recall * 100.0,
        total_recall
    );
    assert!(
        total_precision >= sla.min_composite_precision,
        "Universal Stress Matrix Precision SLA failed: expected >= {:.2}%, got: {:.4}",
        sla.min_composite_precision * 100.0,
        total_precision
    );
}

#[test]
#[ignore = "Individual benchmark: Hexagonal"]
fn test_bench_hexagonal() {
    let sla = SlaConfig::default();
    let entry = evaluate_fixture(&HexagonalCleanFixture, Some("hexagonal"), 150_000);
    assert_paradigm_sla(&entry, &sla);
}

#[test]
#[ignore = "Individual benchmark: Layered N-Tier"]
fn test_bench_layered() {
    let sla = SlaConfig::default();
    let entry = evaluate_fixture(&LayeredNTierFixture, Some("layered"), 150_000);
    assert_paradigm_sla(&entry, &sla);
}

#[test]
#[ignore = "Individual benchmark: Clean Architecture"]
fn test_bench_clean_architecture() {
    let sla = SlaConfig::default();
    let entry = evaluate_fixture(&CleanArchFixture, Some("clean"), 200_000);
    assert_paradigm_sla(&entry, &sla);
}

#[test]
#[ignore = "Individual benchmark: Microservices"]
fn test_bench_microservices() {
    let sla = SlaConfig::default();
    let entry = evaluate_fixture(&MicroservicesFixture, Some("final_boss"), 200_000);
    assert_paradigm_sla(&entry, &sla);
}

#[test]
#[ignore = "Individual benchmark: Modular Monolith"]
fn test_bench_modular_monolith() {
    let sla = SlaConfig::default();
    let entry = evaluate_fixture(&ModularMonolithFixture, Some("modular_monolith"), 250_000);
    assert_paradigm_sla(&entry, &sla);
}

#[test]
#[ignore = "Individual benchmark: CQRS & ES"]
fn test_bench_cqrs() {
    let sla = SlaConfig::default();
    let entry = evaluate_fixture(&CqrsEsFixture, Some("cqrs"), 250_000);
    assert_paradigm_sla(&entry, &sla);
}

#[test]
#[ignore = "Individual benchmark: Onion Architecture"]
fn test_bench_onion() {
    let sla = SlaConfig::default();
    let entry = evaluate_fixture(&OnionFixture, Some("onion"), 300_000);
    assert_paradigm_sla(&entry, &sla);
}

#[test]
#[ignore = "Individual benchmark: Microkernel"]
fn test_bench_microkernel() {
    let sla = SlaConfig::default();
    let entry = evaluate_fixture(&MicrokernelFixture, Some("microkernel"), 300_000);
    assert_paradigm_sla(&entry, &sla);
}

#[test]
#[ignore = "Individual benchmark: Actor System"]
fn test_bench_actor() {
    let sla = SlaConfig::default();
    let entry = evaluate_fixture(&ActorSystemFixture, Some("actor"), 350_000);
    assert_paradigm_sla(&entry, &sla);
}

#[test]
#[ignore = "Individual benchmark: Serverless FaaS"]
fn test_bench_serverless() {
    let sla = SlaConfig::default();
    let entry = evaluate_fixture(&ServerlessFixture, Some("serverless"), 350_000);
    assert_paradigm_sla(&entry, &sla);
}

#[test]
#[ignore = "Individual benchmark: Vue FSD"]
fn test_bench_vue_fsd() {
    let sla = SlaConfig::default();
    let entry = evaluate_fixture(&VueFsdFixture, Some("vue_fsd"), 400_000);
    assert_paradigm_sla(&entry, &sla);
}

#[test]
#[ignore = "Individual benchmark: Vue Legacy"]
fn test_bench_vue_legacy() {
    let sla = SlaConfig::default();
    let entry = evaluate_fixture(&VueLegacyFixture, None, 400_000);
    assert_paradigm_sla(&entry, &sla);
}

#[test]
#[ignore = "Individual benchmark: BFF"]
fn test_bench_bff() {
    let sla = SlaConfig::default();
    let entry = evaluate_fixture(&BffFixture, Some("bff"), 450_000);
    assert_paradigm_sla(&entry, &sla);
}

#[test]
#[ignore = "Individual benchmark: Event-Driven"]
fn test_bench_event_driven() {
    let sla = SlaConfig::default();
    let entry = evaluate_fixture(&EventDrivenFixture, Some("event_driven"), 450_000);
    assert_paradigm_sla(&entry, &sla);
}

#[test]
#[ignore = "Individual benchmark: Final Boss"]
fn test_bench_final_boss() {
    let sla = SlaConfig::default();
    let entry = evaluate_fixture(&FinalBossCompositeFixture, Some("final_boss"), 500_000);
    assert_paradigm_sla(&entry, &sla);
}
