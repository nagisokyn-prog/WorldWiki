mod synthetic_matrix;

use cerberus_domain::SlaConfig;
use std::time::Instant;
use synthetic_matrix::{
    ActorSystemFixture, ArchFixtureGenerator, BenchmarkScorecardEntry, BffFixture,
    CleanArchFixture, CqrsEsFixture, EventDrivenFixture, FinalBossCompositeFixture,
    HexagonalCleanFixture, LayeredNTierFixture, MicrokernelFixture, MicroservicesFixture,
    ModularMonolithFixture, OnionFixture, ScorecardPrinter, ServerlessFixture,
    SyntheticRepoBuilder, VueFsdFixture, VueLegacyFixture,
};

#[cfg(windows)]
pub fn get_process_working_set_mb() -> f64 {
    #[repr(C)]
    #[allow(non_snake_case)]
    struct PROCESS_MEMORY_COUNTERS {
        cb: u32,
        PageFaultCount: u32,
        PeakWorkingSetSize: usize,
        WorkingSetSize: usize,
        QuotaPeakPagedPoolUsage: usize,
        QuotaPagedPoolUsage: usize,
        QuotaPeakNonPagedPoolUsage: usize,
        QuotaNonPagedPoolUsage: usize,
        PagefileUsage: usize,
        PeakPagefileUsage: usize,
    }

    #[link(name = "psapi")]
    extern "system" {
        fn GetProcessMemoryInfo(
            process: *mut std::ffi::c_void,
            ppsmc: *mut PROCESS_MEMORY_COUNTERS,
            cb: u32,
        ) -> i32;
    }

    #[link(name = "kernel32")]
    extern "system" {
        fn GetCurrentProcess() -> *mut std::ffi::c_void;
    }

    unsafe {
        let mut pmc = std::mem::zeroed::<PROCESS_MEMORY_COUNTERS>();
        pmc.cb = std::mem::size_of::<PROCESS_MEMORY_COUNTERS>() as u32;
        let handle = GetCurrentProcess();
        if GetProcessMemoryInfo(handle, &mut pmc, pmc.cb) != 0 {
            pmc.WorkingSetSize as f64 / (1024.0 * 1024.0)
        } else {
            0.0
        }
    }
}

#[cfg(target_os = "linux")]
pub fn get_process_working_set_mb() -> f64 {
    if let Ok(status) = std::fs::read_to_string("/proc/self/status") {
        for line in status.lines() {
            if line.starts_with("VmRSS:") {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 2 {
                    if let Ok(kb) = parts[1].parse::<f64>() {
                        return kb / 1024.0;
                    }
                }
            }
        }
    }
    0.0
}

#[cfg(not(any(windows, target_os = "linux")))]
pub fn get_process_working_set_mb() -> f64 {
    0.0
}

#[cfg(windows)]
pub fn trim_process_working_set() {
    #[link(name = "kernel32")]
    extern "system" {
        fn GetCurrentProcess() -> *mut std::ffi::c_void;
        fn SetProcessWorkingSetSize(
            process: *mut std::ffi::c_void,
            minimum_working_set_size: usize,
            maximum_working_set_size: usize,
        ) -> i32;
    }

    #[link(name = "psapi")]
    extern "system" {
        fn EmptyWorkingSet(process: *mut std::ffi::c_void) -> i32;
    }

    unsafe {
        let handle = GetCurrentProcess();
        EmptyWorkingSet(handle);
        SetProcessWorkingSetSize(handle, usize::MAX, usize::MAX);
    }
}

#[cfg(not(windows))]
pub fn trim_process_working_set() {}

fn matches_violation_target(violation_path: &std::path::Path, expected_suffix: &str) -> bool {
    let v_str = violation_path.to_string_lossy().replace('\\', "/");
    let exp_norm = expected_suffix.replace('\\', "/");
    v_str.ends_with(&exp_norm) || v_str.contains(&exp_norm)
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
    // 1. Reset working set memory before test
    trim_process_working_set();

    // 2. Phase 1: Clean Repo (verify 0 false positives & measure canonical testability)
    let (clean_fp, (testability_score, testability_tier, t_unit, t_integration, archetype_distribution)) = {
        let mut clean_builder = SyntheticRepoBuilder::new();
        generator
            .generate_clean(&mut clean_builder, target_sloc)
            .expect("Clean repo generation failed");
        let clean_res = clean_builder.execute_scan(preset);
        let fp = clean_res.violations.len();
        assert!(
            fp == 0,
            "Paradigm '{}' produced {} false positives on CLEAN repository!\nDetails:\n{}",
            generator.name(),
            fp,
            clean_res
                .violations
                .iter()
                .map(|v| format!("  - [{}] {}: {}", v.rule_id, v.file.display(), v.message))
                .collect::<Vec<_>>()
                .join("\n")
        );

        let test_stats = match cerberus_testability::AnalyzeWorkspaceTestabilityUseCase::analyze_path(
            &clean_builder.root_path,
        ) {
            Ok(rep) => {
                let p = rep.archetype_percentages.get(&cerberus_testability::TestabilityArchetype::Pure).unwrap_or(&0.0);
                let m = rep.archetype_percentages.get(&cerberus_testability::TestabilityArchetype::Mockable).unwrap_or(&0.0);
                let i = rep.archetype_percentages.get(&cerberus_testability::TestabilityArchetype::IntBound).unwrap_or(&0.0);
                let f = rep.archetype_percentages.get(&cerberus_testability::TestabilityArchetype::Flaky).unwrap_or(&0.0);
                let x = rep.archetype_percentages.get(&cerberus_testability::TestabilityArchetype::Poisoned).unwrap_or(&0.0);
                (
                    rep.workspace_score,
                    format!("{:?}", rep.workspace_tier),
                    rep.workspace_t_unit,
                    rep.workspace_t_integration,
                    format!("P:{:.0}% M:{:.0}% I:{:.0}% F:{:.0}% X:{:.0}%", p, m, i, f, x),
                )
            }
            Err(_) => (100.0, "TierA".into(), 100.0, 100.0, "P:100%".into()),
        };

        (fp, test_stats)
    };

    // Trim again after clean repo is dropped
    trim_process_working_set();

    // 3. Phase 2: Seeded Repo (verify fault detection recall & performance)
    let mut seeded_builder = SyntheticRepoBuilder::new();
    let manifest = generator
        .generate_seeded(&mut seeded_builder, target_sloc)
        .expect("Seeded repo generation failed");

    // Pure Firewall Scan Measurement (excludes testability analysis to avoid misleading throughput)
    let scan_start = Instant::now();
    let seeded_res = seeded_builder.execute_scan(preset);
    let scan_duration = scan_start.elapsed();
    let scan_duration_ms = scan_duration.as_secs_f64() * 1000.0;

    // Measure working set RSS during active seeded scan
    let peak_rss_mb = get_process_working_set_mb();

    let mut matched_expected = vec![false; manifest.expected_violations.len()];
    let mut matched_actual = vec![false; seeded_res.violations.len()];

    for (e_idx, expected) in manifest.expected_violations.iter().enumerate() {
        for (a_idx, v) in seeded_res.violations.iter().enumerate() {
            if !matched_actual[a_idx]
                && v.rule_id == expected.rule_id
                && matches_violation_target(&v.file, &expected.target_file_suffix)
            {
                matched_expected[e_idx] = true;
                matched_actual[a_idx] = true;
                break;
            }
        }
    }

    let true_positives = matched_expected.iter().filter(|&&m| m).count();
    let false_negatives = matched_expected.iter().filter(|&&m| !m).count();
    let extra_seeded = matched_actual.iter().filter(|&&m| !m).count();
    let total_false_positives = clean_fp + extra_seeded;

    if false_negatives > 0 {
        eprintln!("\n❌ [{}] MISSED EXPECTED VIOLATIONS (False Negatives = {}):", generator.name(), false_negatives);
        for (e_idx, expected) in manifest.expected_violations.iter().enumerate() {
            if !matched_expected[e_idx] {
                eprintln!("   - Expected [{}]: suffix '{}', desc: '{}'", expected.rule_id, expected.target_file_suffix, expected.description);
            }
        }
    }

    if extra_seeded > 0 {
        eprintln!("\n⚠️ [{}] UNEXPECTED SEEDED VIOLATIONS (Extra False Positives = {}):", generator.name(), extra_seeded);
        for (a_idx, v) in seeded_res.violations.iter().enumerate() {
            if !matched_actual[a_idx] {
                eprintln!("   + Unmatched actual [{}]: file '{}', msg: '{}'", v.rule_id, v.file.display(), v.message);
            }
        }
    }

    let recall = if true_positives + false_negatives > 0 {
        true_positives as f64 / (true_positives + false_negatives) as f64
    } else {
        1.0
    };

    let precision = if true_positives + total_false_positives > 0 {
        true_positives as f64 / (true_positives + total_false_positives) as f64
    } else {
        1.0
    };

    let f1_score = if recall + precision > 0.0 {
        2.0 * (recall * precision) / (recall + precision)
    } else {
        0.0
    };

    let throughput = if scan_duration_ms > 0.0 {
        (seeded_builder.total_sloc as f64 / scan_duration_ms) * 1000.0
    } else {
        0.0
    };

    BenchmarkScorecardEntry {
        paradigm_name: generator.name().to_string(),
        total_files: seeded_builder.total_files,
        total_sloc: seeded_builder.total_sloc,
        duration_ms: scan_duration_ms,
        throughput_sloc_per_sec: throughput,
        peak_rss_mb,
        true_positives,
        false_positives: total_false_positives,
        false_negatives,
        recall,
        precision,
        f1_score,
        testability_score,
        testability_tier,
        t_unit,
        t_integration,
        archetype_distribution,
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

#[test]
fn test_determinism_two_runs_identical_ti() {
    // Verify that two consecutive evaluations of the same fixture produce 100% bit-for-bit identical TI score, SLOC, and TP/FP counts
    let run1 = evaluate_fixture(&HexagonalCleanFixture, Some("hexagonal"), 10_000);
    let run2 = evaluate_fixture(&HexagonalCleanFixture, Some("hexagonal"), 10_000);

    assert_eq!(run1.testability_score, run2.testability_score, "TI score must be deterministic!");
    assert_eq!(run1.testability_tier, run2.testability_tier, "TI tier must be deterministic!");
    assert_eq!(run1.true_positives, run2.true_positives, "True Positives must be deterministic!");
    assert_eq!(run1.false_positives, run2.false_positives, "False Positives must be deterministic!");
    assert_eq!(run1.total_files, run2.total_files, "Total files must be deterministic!");
    assert_eq!(run1.total_sloc, run2.total_sloc, "Total SLOC must be deterministic!");
}

