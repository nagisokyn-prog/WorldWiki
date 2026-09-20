use colored::*;
use std::path::Path;
use std::sync::Arc;

use cerberus_infrastructure::{NativeModelDownloaderAdapter, RulesJsonRepository};

use crate::cli::ModelCommands;

pub fn handle_model(action: ModelCommands) -> Result<(), String> {
    let downloader = Arc::new(NativeModelDownloaderAdapter::new());
    let cache_dir = cerberus_infrastructure::TractOnnxEmbedderAdapter::default_cache_dir();
    handle_model_with_downloader(action, downloader, &cache_dir)
}

pub fn handle_model_with_downloader(
    action: ModelCommands,
    downloader: Arc<dyn cerberus_ports::ModelDownloaderPort>,
    cache_dir: &Path,
) -> Result<(), String> {
    let use_case = cerberus_application::DownloadModelUseCase::new(downloader);

    match action {
        ModelCommands::Download => {
            println!(
                "{}",
                "⬇️ Downloading CodeBERTa ONNX model & tokenizer..."
                    .cyan()
                    .bold()
            );
            match use_case.download(
                cache_dir,
                cerberus_infrastructure::ModelRegistry::CODEBERTA_ONNX_URL,
                cerberus_infrastructure::ModelRegistry::TOKENIZER_JSON_URL,
            ) {
                Ok(_) => {
                    println!(
                        "{} Model and tokenizer successfully cached to {}",
                        "✅".green().bold(),
                        cache_dir.display()
                    );
                    Ok(())
                }
                Err(e) => Err(format!(
                    "{} {}",
                    "❌ Failed to download model:".red().bold(),
                    e
                )),
            }
        }
        ModelCommands::Status => {
            let status = use_case.status(cache_dir);
            let is_ready = status.model_exists && status.tokenizer_exists;
            println!(
                "{}",
                "🧠 CERBERUS NEURAL MODEL STATUS:"
                    .cyan()
                    .bold()
            );
            println!("  Cache Directory: {}", cache_dir.display());
            println!(
                "  ONNX Model:      {}",
                if status.model_exists {
                    "✅ Found".green()
                } else {
                    "❌ Missing".red()
                }
            );
            println!(
                "  Tokenizer JSON:  {}",
                if status.tokenizer_exists {
                    "✅ Found".green()
                } else {
                    "❌ Missing".red()
                }
            );
            println!(
                "  Ready:           {}",
                if is_ready {
                    "✅ Ready for ONNX Embeddings".green().bold()
                } else {
                    "⚠️ Needs download (run 'cargo cerberus model download')".yellow()
                }
            );
            Ok(())
        }
        ModelCommands::Clean => match use_case.clean(cache_dir) {
            Ok(_) => {
                println!("{} Model cache cleaned successfully.", "✅".green().bold());
                Ok(())
            }
            Err(e) => Err(format!(
                "{} {}",
                "❌ Failed to clean model cache:".red().bold(),
                e
            )),
        },
    }
}

pub fn handle_explain(
    path: &Path,
    _clusters: bool,
    rules_repo: &Arc<RulesJsonRepository>,
) -> Result<(), String> {
    println!(
        "{}",
        "🧠 Analyzing architectural debt & semantic clusters..."
            .cyan()
            .bold()
    );
    let cache_dir = cerberus_infrastructure::TractOnnxEmbedderAdapter::default_cache_dir();
    let onnx_adapter = cerberus_infrastructure::TractOnnxEmbedderAdapter::new(
        Some(cache_dir.join("model_quantized.onnx")),
        Some(cache_dir.join("tokenizer.json")),
    );
    let is_neural = onnx_adapter.is_model_available();
    let embedder: Arc<dyn cerberus_ports::VectorEmbedderPort> = if is_neural {
        println!(
            "{}",
            "✨ CodeBERTa ONNX Neural Embedder active (768-dim semantic space)"
                .green()
                .bold()
        );
        Arc::new(onnx_adapter)
    } else {
        println!(
            "{}",
            "ℹ️ Neural model not detected. Using fast Subword N-Gram / TF-IDF fallback.".dimmed()
        );
        println!("{}", "💡 Tip: Run 'cargo cerberus model download' for deep 768-dim semantic code understanding.".yellow());
        Arc::new(cerberus_infrastructure::SemanticEmbedderAdapter::new(64))
    };

    let clusterer = Arc::new(cerberus_infrastructure::DbscanClustererAdapter::new());
    let use_case = cerberus_application::ExplainClustersUseCase::new(embedder, clusterer);

    let parsers: Vec<Arc<dyn cerberus_ports::AstParserPort>> = vec![
        Arc::new(cerberus_infrastructure::RustSynParserAdapter::default()),
        Arc::new(cerberus_infrastructure::VueSfcParserAdapter::default()),
    ];
    let scanner: Arc<dyn cerberus_ports::FileSystemScannerPort> =
        Arc::new(cerberus_infrastructure::WalkDirScannerAdapter::new().with_ignores(rules_repo.config.ignore.clone()));

    let rules_repo_port: Arc<dyn cerberus_ports::RulesRepositoryPort> = Arc::clone(rules_repo) as Arc<dyn cerberus_ports::RulesRepositoryPort>;
    let scan_use_case = cerberus_application::ScanWorkspaceUseCase::new(
        scanner,
        Arc::new(cerberus_infrastructure::ParallelAstEngineAdapter::new(
            parsers,
        )),
        rules_repo_port,
        cerberus_application::ScanScope::All,
    );
    let scan_result = scan_use_case.execute(path);

    match use_case.execute(&scan_result.violations) {
        Ok(report) => {
            println!("\n📊 ARCHITECTURAL DEBT CLUSTER REPORT");
            println!("Total Violations: {}", report.total_violations);
            println!("Identified Clusters: {}", report.total_clusters);
            println!("Isolated/Noise Items: {}", report.noise_count);
            println!("{}", "=".repeat(60));

            for cluster in &report.clusters {
                println!("\n🏷️  {}", cluster.label.bold().yellow());
                println!("   {}", cluster.explanation);
                for sample in &cluster.sample_violations {
                    println!(
                        "   ↳ [{}] {}:{} - {}",
                        sample.rule_id,
                        sample.file.display(),
                        sample.line,
                        sample.symbol
                    );
                }
            }
            Ok(())
        }
        Err(e) => Err(format!(
            "{} {}",
            "❌ Error during cluster explanation:".red().bold(),
            e
        )),
    }
}
