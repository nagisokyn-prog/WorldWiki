use colored::*;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use cerberus_infrastructure::{GitHooksInstaller, NativeModelDownloaderAdapter, RulesJsonRepository};

use crate::check_runner::{run_check, CheckExecutionOptions};
use crate::cli::Commands;
use crate::ledger_commands::{handle_baseline, handle_ledger};
use crate::model_commands::{handle_explain, handle_model};

pub fn execute_command(command: Commands, rules_path: Option<&PathBuf>) -> Result<(), String> {
    let rules_repo = if let Some(p) = rules_path {
        match RulesJsonRepository::load_from_file(p) {
            Ok(repo) => Arc::new(repo),
            Err(e) => {
                return Err(format!("{} {}", "❌ Error loading rules:".red().bold(), e));
            }
        }
    } else {
        let resolved = RulesJsonRepository::find_rules_path(None);
        Arc::new(RulesJsonRepository::load_from_file_or_default(&resolved))
    };

    match command {
        Commands::Check {
            path,
            sarif,
            json,
            expanded,
            ci,
            frontend_only,
            backend_only,
        } => run_check(CheckExecutionOptions {
            rules_repo,
            path: &path,
            sarif_path: sarif.as_deref(),
            json_path: json.as_deref(),
            expanded,
            ci,
            frontend_only,
            backend_only,
        }),

        Commands::Init { hooks, models } => handle_init(hooks, models),
        Commands::Model { action } => handle_model(action),
        Commands::Explain { path, clusters } => handle_explain(&path, clusters),
        Commands::Tree { path, json } => handle_tree(&path, json.as_deref(), &rules_repo),
        Commands::Baseline { action } => handle_baseline(action),
        Commands::Ledger { action } => handle_ledger(action),
    }
}

pub fn validate_rules_registry(rules_path: Option<&PathBuf>) -> Result<(), String> {
    let resolved_rules_path = RulesJsonRepository::find_rules_path(rules_path);
    let rules_repo = match RulesJsonRepository::load_from_file(&resolved_rules_path) {
        Ok(repo) => repo,
        Err(e) => return Err(format!("{} {}", "❌ Error loading rules:".red().bold(), e)),
    };

    let all_builtin = cerberus_domain::BuiltinRuleRegistry::all_rules();
    let known_rules: Vec<&str> = all_builtin.iter().map(|r| r.id.as_str()).collect();
    match rules_repo.validate_registered_rules(&known_rules) {
        Ok(_) => {
            println!(
                "{}",
                "✅ All emitted rule IDs match rules.json registry."
                    .green()
                    .bold()
            );
            Ok(())
        }
        Err(errors) => {
            let mut err_lines = Vec::new();
            for e in errors {
                err_lines.push(format!("{} {}", "❌ Rule mismatch:".red().bold(), e));
            }
            Err(err_lines.join("\n"))
        }
    }
}

fn handle_init(hooks: bool, models: bool) -> Result<(), String> {
    println!("{}", "🚀 Initializing Cerberus...".cyan().bold());
    let baseline_path = Path::new("cerberus-baseline.json");
    if !baseline_path.exists() && !Path::new("guardian-baseline.json").exists() {
        let _ = std::fs::write(baseline_path, "[]\n");
        println!("{} Created empty cerberus-baseline.json", "✅".green());
    }
    if hooks {
        match GitHooksInstaller::install(Path::new(".")) {
            Ok(_) => println!(
                "{} Git pre-commit & post-merge hooks installed.",
                "✅".green()
            ),
            Err(e) => eprintln!("{} {}", "⚠️ Failed to install git hooks:".yellow(), e),
        }
    }
    if models {
        println!(
            "{}",
            "⬇️ Downloading CodeBERTa neural model for vector intelligence...".cyan()
        );
        let downloader = Arc::new(NativeModelDownloaderAdapter::new());
        let use_case = cerberus_application::DownloadModelUseCase::new(downloader);
        let cache_dir = cerberus_infrastructure::TractOnnxEmbedderAdapter::default_cache_dir();
        match use_case.download(
            &cache_dir,
            cerberus_infrastructure::ModelRegistry::CODEBERTA_ONNX_URL,
            cerberus_infrastructure::ModelRegistry::TOKENIZER_JSON_URL,
        ) {
            Ok(_) => println!(
                "{} Neural model successfully installed to {}",
                "✅".green(),
                cache_dir.display()
            ),
            Err(e) => eprintln!("{} {}", "⚠️ Failed to download neural model:".yellow(), e),
        }
    }
    Ok(())
}

fn handle_tree(
    path: &Path,
    json: Option<&Path>,
    rules_repo: &RulesJsonRepository,
) -> Result<(), String> {
    let limits = rules_repo.limits();
    let weights = cerberus_domain::PressureWeights::default();
    let use_case = cerberus_application::RenderTreeUseCase::new(limits, weights);

    match use_case.execute(path) {
        Ok(report) => {
            if let Some(json_path) = json {
                let json_str = match serde_json::to_string_pretty(&report) {
                    Ok(s) => s,
                    Err(e) => return Err(format!("Failed to serialize JSON report: {}", e)),
                };
                if let Err(e) = std::fs::write(json_path, json_str) {
                    return Err(format!("Failed to write JSON report: {}", e));
                }
                println!(
                    "{} Tree report saved to {}",
                    "✅".green().bold(),
                    json_path.display()
                );
            } else {
                cerberus_infrastructure::TreeFormatterAdapter::render_console(&report);
            }
            Ok(())
        }
        Err(e) => Err(format!(
            "{} {}",
            "❌ Error generating metrics tree:".red().bold(),
            e
        )),
    }
}
