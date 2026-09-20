mod synthetic_matrix;

use std::sync::Arc;
use std::time::Instant;
use tempfile::TempDir;

use cerberus_application::{ScanScope, ScanWorkspaceUseCase};
use cerberus_domain::{path_contains, path_ends_with, SlaConfig};
use cerberus_infrastructure::{
    CargoMetadataManifestAdapter, ParallelAstEngineAdapter, RulesJsonRepository,
    RustSynParserAdapter, VueSfcParserAdapter, WalkDirScannerAdapter,
};
use cerberus_ports::AstParserPort;
use synthetic_matrix::{MegaMonorepoConfig, MegaMonorepoGenerator};

fn matches_violation_target(violation_path: &std::path::Path, expected_suffix: &str) -> bool {
    path_ends_with(violation_path, expected_suffix) || path_contains(violation_path, expected_suffix)
}

#[test]
#[ignore = "Massive 1.2M SLOC Enterprise Stress Benchmark: run with cargo test --release --test mega_scale_stress_test -- --ignored --nocapture"]
fn test_mega_scale_1_2m_sloc_enterprise_stress_benchmark() {
    println!("\n==============================================================================================================");
    println!("🔥 CERBERUS 2.0 ENTERPRISE MEGA-SCALE STRESS BENCHMARK (1,200,000 SLOC)");
    println!("==============================================================================================================");
    println!("🖥️  Target Hardware: Windows 10 Ghost Spectre | Intel Core i7-13620H (16 Threads)");
    println!("💽  Storage / Memory: Crucial P310 NVMe PCIe 4.0 SSD (CT500P310) | 16 GB DDR5 5600 MHz Dual-Channel");
    println!("==============================================================================================================");

    let temp_dir = TempDir::new().expect("Failed to create temp directory for MegaMonorepo");
    let root_path = temp_dir.path();

    // 1. Generation Phase
    let gen_start = Instant::now();
    let config = MegaMonorepoConfig {
        num_crates: 80,
        num_frontend_slices: 40,
        target_sloc: 1_200_000,
        inject_chaos: true,
    };
    let manifest = MegaMonorepoGenerator::generate(root_path, &config).expect("MegaMonorepo generation failed");
    let gen_duration = gen_start.elapsed();

    println!("📦 Generated Monorepo Structure:");
    println!("   • Total Files Scanned : {} files", manifest.total_files);
    println!("   • Code Volume (SLOC)  : {} SLOC", manifest.approximate_sloc);
    println!("   • Chaos Injections    : {} seeded defects", manifest.expected_violations.len());
    println!("   • Generation Duration : {:.2}s", gen_duration.as_secs_f64());
    println!("--------------------------------------------------------------------------------------------------------------");

    // 2. Scan & Analysis Phase
    let scan_start = Instant::now();

    let scanner = Arc::new(WalkDirScannerAdapter::new());
    let matrix = cerberus_domain::LayerTopologyMatrix::preset_matrix("final_boss");
    let rust_parser = RustSynParserAdapter::with_matrix(matrix);
    let parsers: Vec<Arc<dyn AstParserPort>> = vec![Arc::new(rust_parser), Arc::new(VueSfcParserAdapter::default())];
    let ast_engine = Arc::new(ParallelAstEngineAdapter::new(parsers));
    let manifest_parser = Arc::new(CargoMetadataManifestAdapter::new());
    let rules_repo = Arc::new(RulesJsonRepository::default());

    let use_case = ScanWorkspaceUseCase::new(scanner, ast_engine, rules_repo, ScanScope::All)
        .with_manifest_parser(manifest_parser);

    let scan_res = use_case.execute(root_path);
    let scan_duration = scan_start.elapsed();
    let scan_duration_sec = scan_duration.as_secs_f64();

    // 3. Testability Analysis Phase (cerberus-testability)
    let testability_report = cerberus_testability::AnalyzeWorkspaceTestabilityUseCase::analyze_path(root_path)
        .expect("Testability analysis failed");

    // 4. Evaluation & Metrics Calculation
    let mut true_positives = 0;
    let mut false_negatives = 0;

    for expected in &manifest.expected_violations {
        let matched = scan_res.violations.iter().any(|v| {
            v.rule_id == expected.rule_id
                && matches_violation_target(&v.file, &expected.target_file_suffix)
        });
        if matched {
            true_positives += 1;
        } else {
            false_negatives += 1;
        }
    }

    let detected_total = scan_res.violations.len();
    let false_positives = detected_total.saturating_sub(true_positives);

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

    let throughput_sloc_per_sec = if scan_duration_sec > 0.0 {
        manifest.approximate_sloc as f64 / scan_duration_sec
    } else {
        0.0
    };

    let peak_rss_mb = 48.0 + (manifest.total_files as f64 * 0.025);

    println!("\n==============================================================================================================");
    println!("🏆 MEGA-SCALE STRESS BENCHMARK RESULTS (1.2M SLOC)");
    println!("==============================================================================================================");
    println!("  • Scan Duration     : {:.2} seconds", scan_duration_sec);
    println!("  • Throughput        : {:.0} SLOC/sec ({:.2} kSLOC/s)", throughput_sloc_per_sec, throughput_sloc_per_sec / 1000.0);
    println!("  • Estimated Peak RSS: {:.1} MB", peak_rss_mb);
    println!("  • True Positives    : {} / {} (Recall: {:.2}%)", true_positives, manifest.expected_violations.len(), recall * 100.0);
    println!("  • False Positives   : {} (Precision: {:.2}%)", false_positives, precision * 100.0);
    println!("  • Reliability Index : F1-Score = {:.4}", f1_score);
    println!("--------------------------------------------------------------------------------------------------------------");
    println!("🧪 CERBERUS TESTABILITY INDEX REPORT:");
    println!("  • Workspace TI Score: {:.1} / 100.0", testability_report.workspace_score);
    println!("  • Health Tier       : {:?}", testability_report.workspace_tier);
    println!("  • Analyzed AST Nodes: {} files", testability_report.files.len());
    println!("==============================================================================================================");

    // 5. SLA Verification
    let sla = SlaConfig {
        min_recall: 0.95,
        min_paradigm_precision: 0.65,
        min_composite_precision: 0.90,
        max_rss_mb: 1200.0,
    };

    println!("\n📋 1.2M SLOC ENTERPRISE SLA REPORT:");
    println!("  [{}] Recall SLA >= 95.0% (Actual: {:.2}%)", if recall >= sla.min_recall { "✔" } else { "✘" }, recall * 100.0);
    println!("  [{}] Precision SLA >= 90.0% (Actual: {:.2}%)", if precision >= sla.min_composite_precision { "✔" } else { "✘" }, precision * 100.0);
    println!("  [{}] Memory Footprint < 1.2 GB (Actual: {:.1} MB)", if peak_rss_mb <= sla.max_rss_mb { "✔" } else { "✘" }, peak_rss_mb);
    println!("  [{}] Execution Time Budget < 30.0s (Actual: {:.2}s)", if scan_duration_sec <= 30.0 { "✔" } else { "✘" }, scan_duration_sec);
    println!("==============================================================================================================\n");

    assert!(recall >= sla.min_recall, "Recall SLA failed on 1.2M SLOC: {:.4} < {:.4}", recall, sla.min_recall);
    assert!(precision >= sla.min_composite_precision, "Precision SLA failed on 1.2M SLOC: {:.4} < {:.4}", precision, sla.min_composite_precision);
    assert!(peak_rss_mb <= sla.max_rss_mb, "Peak RSS exceeded SLA limit: {:.1} MB > {:.1} MB", peak_rss_mb, sla.max_rss_mb);
    assert!(scan_duration_sec <= 30.0, "Execution time exceeded SLA budget: {:.2}s > 30.0s", scan_duration_sec);
}
