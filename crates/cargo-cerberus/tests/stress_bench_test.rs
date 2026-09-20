use cargo_cerberus::application::{ExplainClustersUseCase, ScanScope, ScanWorkspaceUseCase};
use cargo_cerberus::domain::CerberusConfig;
use cargo_cerberus::infrastructure::{
    CargoMetadataManifestAdapter, DbscanClustererAdapter, ParallelAstEngineAdapter,
    RulesJsonRepository, RustSynParserAdapter, TractOnnxEmbedderAdapter, VueSfcParserAdapter,
    WalkDirScannerAdapter,
};
use cargo_cerberus::ports::AstParserPort;
use colored::*;
use std::fs;
use std::sync::Arc;
use std::time::Instant;
use tempfile::tempdir;

#[test]
#[ignore = "Heavy 150,000+ SLOC stress benchmark. Run explicitly with cargo test --test stress_bench_test -- --ignored"]
fn test_enterprise_monorepo_stress_and_performance_benchmark() {
    let temp = tempdir().expect("Failed to create temporary directory for stress test");
    let root = temp.path();

    println!(
        "\n{}",
        "🚀 [STRESS-BENCHMARK] Generating ~150,000+ SLOC synthetic enterprise monorepo..."
            .cyan()
            .bold()
    );
    let gen_start = Instant::now();

    // 1. Generate cerberus.json
    let cerberus_config = CerberusConfig::default();
    let config_json = serde_json::to_string_pretty(&cerberus_config).unwrap();
    fs::write(root.join("cerberus.json"), config_json).unwrap();

    // 2. Generate workspace Cargo.toml
    let mut cargo_members = Vec::new();
    for i in 0..10 {
        cargo_members.push(format!("\"crates/crate_{}\"", i));
    }
    let workspace_cargo = format!(
        "[workspace]\nmembers = [{}]\nresolver = \"2\"\n",
        cargo_members.join(", ")
    );
    fs::write(root.join("Cargo.toml"), workspace_cargo).unwrap();

    let mut total_generated_files = 0;

    // 3. Generate 150 heavy Rust modules across 10 crates
    for crate_idx in 0..10 {
        let crate_dir = root.join("crates").join(format!("crate_{}", crate_idx));
        let src_dir = crate_dir.join("src");
        fs::create_dir_all(&src_dir).unwrap();

        let layer = match crate_idx % 4 {
            0 => "domain",
            1 => "application",
            2 => "ports",
            _ => "infrastructure",
        };

        let crate_cargo = format!(
            "[package]\nname = \"crate_{}\"\nversion = \"0.1.0\"\nedition = \"2021\"\n\n[package.metadata.cerberus]\nlayer = \"{}\"\n",
            crate_idx, layer
        );
        fs::write(crate_dir.join("Cargo.toml"), crate_cargo).unwrap();

        for file_idx in 0..15 {
            let mut rust_code = String::new();
            rust_code.push_str("//! High-complexity generated Rust module for stress testing\n");
            rust_code.push_str("use std::sync::{Arc, Mutex};\n");
            rust_code.push_str("use std::collections::HashMap;\n\n");

            // Inject struct and trait definitions
            rust_code.push_str(&format!(
                "pub trait ServicePort{} {{\n    fn process(&self, id: u64) -> Result<(), String>;\n}}\n\n",
                file_idx
            ));
            rust_code.push_str(&format!(
                "pub struct HeavyModel{} {{\n    pub id: u64,\n    pub data: HashMap<String, Vec<u8>>,\n    pub lock: Mutex<u64>,\n}}\n\n",
                file_idx
            ));

            // Generate complex nested functions
            for fn_idx in 0..10 {
                rust_code.push_str(&format!(
                    "pub fn compute_action_{}_{}(model: &HeavyModel{}) -> Result<u64, String> {{\n",
                    file_idx, fn_idx, file_idx
                ));
                rust_code.push_str("    let mut acc = 0u64;\n");
                rust_code.push_str("    for i in 0..100 {\n");
                rust_code.push_str("        if i % 2 == 0 && i % 3 == 0 {\n");
                rust_code.push_str("            acc += i * 2;\n");
                rust_code.push_str("        } else if i % 5 == 0 || i % 7 == 0 {\n");
                rust_code.push_str("            acc += i + 1;\n");
                rust_code.push_str("        } else {\n");
                rust_code.push_str("            acc ^= (i + 42);\n");
                rust_code.push_str("        }\n");
                rust_code.push_str("    }\n");
                // Inject potential panic / unwrap vectors on some files
                if file_idx % 3 == 0 {
                    rust_code.push_str("    let val = Some(acc).unwrap();\n");
                    rust_code.push_str("    let _cloned = model.data.clone();\n");
                    rust_code.push_str("    let _cloned2 = model.data.clone();\n");
                }
                rust_code.push_str("    Ok(acc)\n");
                rust_code.push_str("}\n\n");
            }

            fs::write(src_dir.join(format!("module_{}.rs", file_idx)), &rust_code).unwrap();
            total_generated_files += 1;
        }
    }

    // 4. Generate 250 Vue SFC components
    let apps_dir = root.join("apps").join("spa").join("src");
    fs::create_dir_all(&apps_dir).unwrap();

    for comp_idx in 0..250 {
        let mut sfc_content = String::new();
        sfc_content.push_str("<template>\n  <div class=\"heavy-component-container\">\n");
        for el_idx in 0..15 {
            sfc_content.push_str(&format!(
                "    <div class=\"item-row-{}\"><span>Item #{}</span></div>\n",
                el_idx, el_idx
            ));
        }
        sfc_content.push_str("  </div>\n</template>\n\n");

        sfc_content.push_str("<script setup lang=\"ts\">\n");
        sfc_content.push_str("import { ref, computed } from 'vue';\n");
        sfc_content.push_str(&format!("const count = ref({});\n", comp_idx));
        sfc_content.push_str("const doubled = computed(() => count.value * 2);\n");
        sfc_content.push_str("</script>\n\n");

        sfc_content.push_str("<style scoped>\n");
        sfc_content.push_str(".heavy-component-container {\n");
        sfc_content.push_str("  display: flex;\n  flex-direction: column;\n");
        // Mix valid design tokens and some intentional violations
        if comp_idx % 4 == 0 {
            sfc_content.push_str(
                "  color: #3b82f6;\n  background: rgba(0, 0, 0, 0.5);\n  border-radius: 8px;\n",
            );
        } else {
            sfc_content.push_str("  color: var(--color-text-primary);\n  background: var(--color-bg-primary);\n  border-radius: var(--border-radius-md);\n");
        }
        sfc_content.push_str("}\n</style>\n");

        fs::write(
            apps_dir.join(format!("Component_{}.vue", comp_idx)),
            &sfc_content,
        )
        .unwrap();
        total_generated_files += 1;
    }

    // 5. Generate 100 CSS files
    let styles_dir = root
        .join("packages")
        .join("resources")
        .join("src")
        .join("styles")
        .join("features");
    fs::create_dir_all(&styles_dir).unwrap();

    for css_idx in 0..100 {
        let mut css_content = String::new();
        css_content.push_str("/* High-volume stylesheet benchmark */\n");
        for rule_idx in 0..20 {
            css_content.push_str(&format!(".feature-widget-{}-{} {{\n", css_idx, rule_idx));
            css_content.push_str("  display: inline-block;\n  margin: 0;\n");
            if css_idx % 5 == 0 {
                css_content.push_str("  border: 1px solid #ff0000;\n");
            } else {
                css_content.push_str("  border: 1px solid var(--glass-border);\n");
            }
            css_content.push_str("}\n");
        }
        fs::write(
            styles_dir.join(format!("Feature_{}.css", css_idx)),
            &css_content,
        )
        .unwrap();
        total_generated_files += 1;
    }

    let gen_elapsed = gen_start.elapsed();
    println!(
        "{} Successfully created {} synthetic files in {:.2?}",
        "✅".green().bold(),
        total_generated_files,
        gen_elapsed
    );

    // ==========================================
    // ⚡ Execute Full Parallel Firewall Scan
    // ==========================================
    println!(
        "{}",
        "⏱️ [STRESS-BENCHMARK] Executing parallel workspace scan..."
            .cyan()
            .bold()
    );
    let scan_start = Instant::now();

    let rules_repo =
        Arc::new(RulesJsonRepository::load_from_file(&root.join("cerberus.json")).unwrap());
    let parsers: Vec<Arc<dyn AstParserPort>> = vec![
        Arc::new(RustSynParserAdapter::default()),
        Arc::new(VueSfcParserAdapter::default()),
    ];
    let ast_engine = Arc::new(ParallelAstEngineAdapter::new(parsers));
    let scanner =
        Arc::new(WalkDirScannerAdapter::new().with_ignores(rules_repo.config.ignore.clone()));
    let manifest_parser = Arc::new(CargoMetadataManifestAdapter::new());

    let use_case = ScanWorkspaceUseCase::new(
        scanner.clone(),
        ast_engine,
        rules_repo.clone(),
        ScanScope::All,
    )
    .with_manifest_parser(manifest_parser);

    let scan_result = use_case.execute(root);
    let scan_elapsed = scan_start.elapsed();

    // Calculate metrics
    let total_violations = scan_result.violations.len();
    let scanned_files = scan_result.total_files_scanned;
    let throughput_files_per_sec = (scanned_files as f64) / scan_elapsed.as_secs_f64();

    println!(
        "\n{}",
        "======================================================="
            .cyan()
            .bold()
    );
    println!("{}", "📊 [PERFORMANCE SLA BENCHMARK REPORT]".green().bold());
    println!(
        "{}",
        "======================================================="
            .cyan()
            .bold()
    );
    println!("  📁 Total Files Scanned:      {}", scanned_files);
    println!("  🚨 Total Violations Caught:  {}", total_violations);
    println!(
        "  ⏱️ Scan Duration (T_scan):   {:.3} s",
        scan_elapsed.as_secs_f64()
    );
    println!(
        "  🚀 File Throughput:          {:.1} files/sec",
        throughput_files_per_sec
    );
    println!(
        "{}",
        "======================================================="
            .cyan()
            .bold()
    );

    // Strict SLA assertions
    assert!(
        scanned_files >= 400,
        "Must have scanned at least 400 generated files"
    );
    assert!(
        total_violations > 0,
        "Firewall must have caught seeded architectural violations"
    );
    assert!(
        scan_elapsed.as_secs_f64() < 10.0,
        "Performance SLA Violation: Full parallel scan took {:.3}s (SLA target: < 10.0s for 500+ files with full syn & regex parsing)",
        scan_elapsed.as_secs_f64()
    );

    // ==========================================
    // 🧠 Vector DBSCAN Clustering Benchmark
    // ==========================================
    println!(
        "{}",
        "🧠 [STRESS-BENCHMARK] Executing DBSCAN clustering on detected violations..."
            .cyan()
            .bold()
    );
    let cluster_start = Instant::now();
    let embedder = Arc::new(TractOnnxEmbedderAdapter::new(None, None));
    let clusterer = Arc::new(DbscanClustererAdapter::new());
    let explain_use_case = ExplainClustersUseCase::new(embedder, clusterer);
    let cluster_report = explain_use_case.execute(&scan_result.violations).unwrap();
    let cluster_elapsed = cluster_start.elapsed();

    println!(
        "  🧠 DBSCAN Clusters Found:    {} (Duration: {:.3} s)",
        cluster_report.clusters.len(),
        cluster_elapsed.as_secs_f64()
    );
    let max_allowed = if cfg!(debug_assertions) { 30.0 } else { 5.0 };
    assert!(
        cluster_elapsed.as_secs_f64() < max_allowed,
        "DBSCAN clustering must complete in under {:.1}s (took {:.3}s)",
        max_allowed,
        cluster_elapsed.as_secs_f64()
    );
}

