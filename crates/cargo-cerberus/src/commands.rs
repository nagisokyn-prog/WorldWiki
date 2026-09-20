use colored::*;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use cerberus_infrastructure::{GitHooksInstaller, NativeModelDownloaderAdapter, RulesJsonRepository};

use crate::check_runner::{run_check, CheckExecutionOptions};
use crate::cli::{Commands, RuleCommands};
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
            record_baseline,
            baseline,
        } => run_check(CheckExecutionOptions {
            rules_repo,
            path: &path,
            sarif_path: sarif.as_deref(),
            json_path: json.as_deref(),
            expanded,
            ci,
            frontend_only,
            backend_only,
            record_baseline,
            baseline_path: baseline.as_deref(),
        }),

        Commands::Init {
            path,
            preset: _,
            adopt,
            force,
            frontend_only,
            backend_only,
            hooks,
            models,
        } => handle_init(&path, adopt, force, frontend_only, backend_only, hooks, models),
        Commands::Rule { action } => handle_rule(action),
        Commands::Model { action } => handle_model(action),
        Commands::Explain { path, clusters } => handle_explain(&path, clusters, &rules_repo),
        Commands::Tree {
            path,
            json,
            save_json,
            output,
        } => {
            let json_target = json.or(save_json);
            handle_tree(&path, json_target.as_deref(), output.as_deref(), &rules_repo)
        }
        Commands::Baseline { action } => handle_baseline(action),
        Commands::Ledger { action } => handle_ledger(action),
        Commands::Testability {
            path,
            json,
            threshold,
            calibrate,
        } => handle_testability(&path, json.as_deref(), threshold, calibrate),
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

fn handle_init(
    path: &Path,
    adopt: bool,
    force: bool,
    frontend_only: bool,
    backend_only: bool,
    hooks: bool,
    models: bool,
) -> Result<(), String> {
    println!("{}", "🚀 Initializing Cerberus...".cyan().bold());

    let scope = if frontend_only {
        cerberus_application::ProjectScope::FrontendOnly
    } else if backend_only {
        cerberus_application::ProjectScope::BackendOnly
    } else {
        cerberus_application::ProjectScope::Fullstack
    };

    let opts = cerberus_application::ScaffoldOptions::new(path, scope)
        .with_adopt(adopt)
        .with_force(force);

    match cerberus_application::ScaffoldUseCase::execute(&opts) {
        Ok(report) => {
            println!("{} {}", "✅".green().bold(), report.message);
        }
        Err(e) => return Err(format!("{} {}", "❌ Scaffolding failed:".red().bold(), e)),
    }

    if hooks {
        match GitHooksInstaller::install(path) {
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

fn handle_rule(action: RuleCommands) -> Result<(), String> {
    match action {
        RuleCommands::List { json, markdown } => {
            let format = if json {
                cerberus_application::ExplainFormat::Json
            } else if markdown {
                cerberus_application::ExplainFormat::Markdown
            } else {
                cerberus_application::ExplainFormat::Terminal
            };
            match cerberus_application::ExplainRuleUseCase::list(format) {
                Ok(out) => {
                    print!("{}", out);
                    Ok(())
                }
                Err(e) => Err(format!("{} {}", "❌ Error listing rules:".red().bold(), e)),
            }
        }
        RuleCommands::Explain {
            rule,
            json,
            markdown,
        } => {
            let format = if json {
                cerberus_application::ExplainFormat::Json
            } else if markdown {
                cerberus_application::ExplainFormat::Markdown
            } else {
                cerberus_application::ExplainFormat::Terminal
            };
            match cerberus_application::ExplainRuleUseCase::explain(&rule, format) {
                Ok(card) => {
                    print!("{}", card);
                    Ok(())
                }
                Err(e) => Err(format!("{} {}", "❌ Error explaining rule:".red().bold(), e)),
            }
        }
    }
}

fn handle_tree(
    path: &Path,
    json: Option<&Path>,
    output: Option<&Path>,
    rules_repo: &RulesJsonRepository,
) -> Result<(), String> {
    let limits = rules_repo.limits();
    let weights = cerberus_domain::PressureWeights::default();
    let use_case = cerberus_application::RenderTreeUseCase::new(limits, weights)
        .with_ignores(rules_repo.config.ignore.to_vec());

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
            } else if let Some(out_path) = output {
                // Render text output to file
                let formatted = cerberus_infrastructure::TreeFormatterAdapter::render_string(&report);
                if let Err(e) = std::fs::write(out_path, formatted) {
                    return Err(format!("Failed to write output text file: {}", e));
                }
                println!(
                    "{} ASCII tree saved to {}",
                    "✅".green().bold(),
                    out_path.display()
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

fn handle_testability(
    path: &Path,
    json: Option<&Path>,
    threshold: Option<f64>,
    calibrate: bool,
) -> Result<(), String> {
    if calibrate {
        println!("{}", "🧬 Running Cerberus Testability Calibration Suite...".cyan().bold());
        let cal_res = cerberus_testability::RunCalibrationSuiteUseCase::run_suite();
        for (anchor, report) in &cal_res.anchor_reports {
            println!(
                "  [{}] {:<45} -> Score: {:>5.1} (Expected: [{:.1}, {:.1}])",
                anchor.id, anchor.name, report.t_composite, anchor.target_score_range.0, anchor.target_score_range.1
            );
        }
        if !cal_res.validation_errors.is_empty() {
            for err in &cal_res.validation_errors {
                eprintln!("{} {}", "❌ Calibration error:".red().bold(), err);
            }
            return Err("Calibration suite failed!".to_string());
        }
        println!("{}", "✅ All synthetic anchors calibrated and strictly monotonic.".green().bold());
        return Ok(());
    }

    let report = match cerberus_testability::AnalyzeWorkspaceTestabilityUseCase::analyze_path(path) {
        Ok(r) => r,
        Err(e) => return Err(format!("{} {}", "❌ Error analyzing workspace testability:".red().bold(), e)),
    };

    if let Some(json_path) = json {
        let json_str = match cerberus_testability::ConsoleTestabilityRenderer::render_json(&report) {
            Ok(s) => s,
            Err(e) => return Err(format!("Failed to serialize JSON report: {}", e)),
        };
        if let Err(e) = std::fs::write(json_path, json_str) {
            return Err(format!("Failed to write JSON report: {}", e));
        }
        println!(
            "{} Testability report saved to {}",
            "✅".green().bold(),
            json_path.display()
        );
    } else {
        let console_out = cerberus_testability::ConsoleTestabilityRenderer::render_report(&report);
        print!("{}", console_out);
    }

    if let Some(min_score) = threshold {
        if report.workspace_score < min_score {
            return Err(format!(
                "{} Workspace testability score ({:.1}) is below threshold ({:.1})",
                "❌ Error:".red().bold(),
                report.workspace_score,
                min_score
            ));
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_handle_init_all_modes() {
        let temp = tempdir().unwrap();
        assert!(handle_init(temp.path(), true, true, false, false, false, false).is_ok());
        assert!(handle_init(temp.path(), false, true, true, false, false, false).is_ok());
        assert!(handle_init(temp.path(), false, true, false, true, false, false).is_ok());
    }

    #[test]
    fn test_handle_rule_commands() {
        assert!(handle_rule(RuleCommands::List { json: false, markdown: false }).is_ok());
        assert!(handle_rule(RuleCommands::List { json: true, markdown: false }).is_ok());
        assert!(handle_rule(RuleCommands::List { json: false, markdown: true }).is_ok());

        assert!(handle_rule(RuleCommands::Explain { rule: "ARCH-001".into(), json: false, markdown: false }).is_ok());
        assert!(handle_rule(RuleCommands::Explain { rule: "ARCH-001".into(), json: true, markdown: false }).is_ok());
        assert!(handle_rule(RuleCommands::Explain { rule: "ARCH-001".into(), json: false, markdown: true }).is_ok());
        assert!(handle_rule(RuleCommands::Explain { rule: "NONEXISTENT".into(), json: false, markdown: false }).is_err());
    }

    #[test]
    fn test_handle_tree_and_output() {
        let temp = tempdir().unwrap();
        let repo = RulesJsonRepository::default();
        let json_out = temp.path().join("tree.json");
        let txt_out = temp.path().join("tree.txt");

        assert!(handle_tree(temp.path(), None, None, &repo).is_ok());
        assert!(handle_tree(temp.path(), Some(&json_out), None, &repo).is_ok());
        assert!(handle_tree(temp.path(), None, Some(&txt_out), &repo).is_ok());
        assert!(handle_tree(Path::new("non_existent_404_dir"), None, None, &repo).is_err());
    }

    #[test]
    fn test_execute_command_rule_and_init() {
        let temp = tempdir().unwrap();
        let cmd_init = Commands::Init {
            path: temp.path().to_path_buf(),
            preset: None,
            adopt: true,
            force: true,
            frontend_only: false,
            backend_only: false,
            hooks: false,
            models: false,
        };
        assert!(execute_command(cmd_init, None).is_ok());

        let cmd_rule = Commands::Rule {
            action: RuleCommands::Explain {
                rule: "ARCH-001".into(),
                json: false,
                markdown: false,
            },
        };
        assert!(execute_command(cmd_rule, None).is_ok());
    }
}

