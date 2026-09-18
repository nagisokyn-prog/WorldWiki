use colored::*;
use std::path::Path;
use std::sync::Arc;

use cerberus_application::{ScanScope, ScanWorkspaceUseCase};
use cerberus_domain::Severity;
use cerberus_infrastructure::{
    ConsoleReportAdapter, JsonReportAdapter, ParallelAstEngineAdapter, RulesJsonRepository,
    SarifReportAdapter, VueSfcParserAdapter, WalkDirScannerAdapter,
};
use cerberus_ports::AstParserPort;

use crate::cli::{Cli, Commands, RuleCommands};

pub fn run_app(cli: Cli) -> Result<(), String> {
    if let Some(Commands::Init { path, adopt, force }) = cli.command {
        return handle_init(&path, adopt, force);
    }

    if let Some(Commands::Rule { action }) = cli.command {
        return handle_rule(action);
    }

    let rules_path = RulesJsonRepository::find_rules_path(cli.rules_path.as_ref());
    let rules_repo = match RulesJsonRepository::load_from_file(&rules_path) {
        Ok(repo) => Arc::new(repo),
        Err(e) => return Err(format!("{} {}", "❌ Error loading configuration:".red().bold(), e)),
    };

    if cli.validate_rules {
        return validate_rules(&rules_repo);
    }

    match cli.command {
        Some(Commands::Tree { path, json }) => handle_tree(&path, json.as_deref(), &rules_repo),
        Some(Commands::Check {
            path,
            sarif,
            json,
            ci,
        }) => run_check(CheckExecutionOptions {
            rules_repo,
            path: &path,
            sarif_path: sarif.as_deref(),
            json_path: json.as_deref(),
            ci,
        }),
        _ => run_check(CheckExecutionOptions {
            rules_repo,
            path: Path::new("."),
            sarif_path: None,
            json_path: None,
            ci: false,
        }),
    }
}

fn handle_init(path: &Path, adopt: bool, force: bool) -> Result<(), String> {
    println!("{}", "🚀 Initializing Cerberus Frontend Guardian...".cyan().bold());

    let opts = cerberus_application::ScaffoldOptions::new(path, cerberus_application::ProjectScope::FrontendOnly)
        .with_adopt(adopt)
        .with_force(force);

    match cerberus_application::ScaffoldUseCase::execute(&opts) {
        Ok(report) => {
            println!("{} {}", "✅".green().bold(), report.message);
            Ok(())
        }
        Err(e) => Err(format!("{} {}", "❌ Frontend scaffolding failed:".red().bold(), e)),
    }
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

fn validate_rules(rules_repo: &RulesJsonRepository) -> Result<(), String> {
    let all_builtin = cerberus_domain::BuiltinRuleRegistry::all_rules();
    let known_rules: Vec<&str> = all_builtin.iter().map(|r| r.id.as_str()).collect();
    match rules_repo.validate_registered_rules(&known_rules) {
        Ok(_) => {
            println!("{}", "✅ All frontend rule IDs match configuration.".green().bold());
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

fn handle_tree(path: &Path, json: Option<&Path>, rules_repo: &RulesJsonRepository) -> Result<(), String> {
    let limits = rules_repo.limits();
    let weights = cerberus_domain::PressureWeights::default();
    let use_case = cerberus_application::RenderTreeUseCase::new(limits, weights);

    match use_case.execute(path) {
        Ok(report) => {
            if let Some(json_path) = json {
                let json_str = serde_json::to_string_pretty(&report).unwrap_or_default();
                if let Err(e) = std::fs::write(json_path, json_str) {
                    return Err(format!("Failed to write JSON report: {}", e));
                }
                println!("{} Tree report saved to {}", "✅".green().bold(), json_path.display());
            } else {
                cerberus_infrastructure::TreeFormatterAdapter::render_console(&report);
            }
            Ok(())
        }
        Err(e) => Err(format!("{} {}", "❌ Error generating metrics tree:".red().bold(), e)),
    }
}

#[derive(Debug)]
pub struct CheckExecutionOptions<'a> {
    pub rules_repo: Arc<RulesJsonRepository>,
    pub path: &'a Path,
    pub sarif_path: Option<&'a Path>,
    pub json_path: Option<&'a Path>,
    pub ci: bool,
}

pub fn run_check(options: CheckExecutionOptions) -> Result<(), String> {
    let parsers: Vec<Arc<dyn AstParserPort>> = vec![Arc::new(VueSfcParserAdapter)];
    let ast_engine = Arc::new(ParallelAstEngineAdapter::new(parsers));
    let scanner = Arc::new(
        WalkDirScannerAdapter::new().with_ignores(options.rules_repo.config.ignore.clone()),
    );
    let use_case = ScanWorkspaceUseCase::new(
        scanner,
        ast_engine,
        options.rules_repo,
        ScanScope::FrontendOnly,
    );
    let scan_result = use_case.execute(options.path);

    for parse_err in &scan_result.parse_errors {
        eprintln!("{} {}", "⚠️".yellow(), parse_err);
    }

    if scan_result.total_files_scanned > 0 {
        let error_rate =
            (scan_result.parse_errors.len() as f64) / (scan_result.total_files_scanned as f64);
        let max_tolerated = if options.ci { 0.02 } else { 0.05 };
        if error_rate > max_tolerated {
            return Err(format!(
                "{} Parse error rate ({:.1}%) exceeds limit ({:.1}%). Failing build.",
                "❌ [PARSE-ERROR-LIMIT]".red().bold(),
                error_rate * 100.0,
                max_tolerated * 100.0
            ));
        }
    }

    ConsoleReportAdapter::print_violations(&scan_result.violations);

    if let Some(sp) = options.sarif_path {
        if let Err(e) = SarifReportAdapter::write_report(sp, &scan_result.violations) {
            eprintln!("{} {}", "Failed to write SARIF report:".red(), e);
        }
    }

    if let Some(jp) = options.json_path {
        if let Err(e) = JsonReportAdapter::write_report(jp, &scan_result.violations) {
            eprintln!("{} {}", "Failed to write JSON report:".red(), e);
        }
    }

    for v in &scan_result.violations {
        if v.severity == Severity::Deny {
            return Err("Frontend violations found with severity Deny".into());
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_sfc_app_runner_unit() {
        let temp = tempdir().unwrap();
        let config_file = temp.path().join("cerberus.json");
        std::fs::write(&config_file, "{\"version\": \"1.0\", \"rules\": {}}").unwrap();
        let repo = Arc::new(RulesJsonRepository::load_from_file(&config_file).unwrap());

        let opts = CheckExecutionOptions {
            rules_repo: repo.clone(),
            path: temp.path(),
            sarif_path: None,
            json_path: None,
            ci: false,
        };
        let debug_repr = format!("{:?}", opts);
        assert!(debug_repr.contains("CheckExecutionOptions"));

        // test validate_rules
        assert!(validate_rules(&repo).is_ok());

        // test validate_rules with missing rules in legacy config
        let invalid_config = temp.path().join("invalid_cerberus.json");
        std::fs::write(&invalid_config, "{\"version\": \"1.0\", \"rules\": [{\"id\": \"ARCH-001\", \"version\": \"1.0\", \"category\": \"Architecture\", \"severity\": \"deny\", \"title\": \"t\", \"description\": \"d\", \"remediation\": \"r\"}]}").unwrap();
        let invalid_repo = RulesJsonRepository::load_from_file(&invalid_config).unwrap();
        assert!(validate_rules(&invalid_repo).is_err());

        // test handle_init
        let init_temp = tempdir().unwrap();
        assert!(handle_init(init_temp.path(), false, false).is_ok());
        assert!(handle_init(init_temp.path(), false, false).is_ok()); // already exists, skips gracefully
        assert!(handle_init(init_temp.path(), true, true).is_ok()); // force overwrite

        // test handle_rule
        assert!(handle_rule(RuleCommands::List { json: false, markdown: false }).is_ok());
        assert!(handle_rule(RuleCommands::List { json: true, markdown: false }).is_ok());
        assert!(handle_rule(RuleCommands::List { json: false, markdown: true }).is_ok());
        assert!(handle_rule(RuleCommands::Explain { rule: "VUE-007".into(), json: false, markdown: false }).is_ok());
        assert!(handle_rule(RuleCommands::Explain { rule: "VUE-007".into(), json: true, markdown: false }).is_ok());
        assert!(handle_rule(RuleCommands::Explain { rule: "VUE-007".into(), json: false, markdown: true }).is_ok());
        assert!(handle_rule(RuleCommands::Explain { rule: "NONEXISTENT".into(), json: false, markdown: false }).is_err());

        // test handle_tree console and json
        let tree_json = temp.path().join("tree.json");
        assert!(handle_tree(temp.path(), None, &repo).is_ok());
        assert!(handle_tree(temp.path(), Some(&tree_json), &repo).is_ok());
        assert!(handle_tree(Path::new("non_existent_404_dir"), None, &repo).is_err());

        // test run_check with sarif and json
        let sarif_out = temp.path().join("report.sarif");
        let json_out = temp.path().join("report.json");
        let check_opts = CheckExecutionOptions {
            rules_repo: repo.clone(),
            path: temp.path(),
            sarif_path: Some(&sarif_out),
            json_path: Some(&json_out),
            ci: true,
        };
        assert!(run_check(check_opts).is_ok());

        // test run_app commands
        let cli_validate = Cli {
            command: None,
            rules_path: Some(config_file.clone()),
            validate_rules: true,
        };
        assert!(run_app(cli_validate).is_ok());

        let cli_tree = Cli {
            command: Some(Commands::Tree {
                path: temp.path().to_path_buf(),
                json: None,
            }),
            rules_path: Some(config_file.clone()),
            validate_rules: false,
        };
        assert!(run_app(cli_tree).is_ok());

        let cli_check = Cli {
            command: Some(Commands::Check {
                path: temp.path().to_path_buf(),
                sarif: None,
                json: None,
                ci: false,
            }),
            rules_path: Some(config_file.clone()),
            validate_rules: false,
        };
        assert!(run_app(cli_check).is_ok());

        let cli_default = Cli {
            command: None,
            rules_path: Some(config_file),
            validate_rules: false,
        };
        assert!(run_app(cli_default).is_ok());

        // test run_app init command
        let init_run_temp = tempdir().unwrap();
        let cli_init = Cli {
            command: Some(Commands::Init {
                path: init_run_temp.path().to_path_buf(),
                adopt: true,
                force: true,
            }),
            rules_path: None,
            validate_rules: false,
        };
        assert!(run_app(cli_init).is_ok());

        // test run_app rule command
        let cli_rule = Cli {
            command: Some(Commands::Rule {
                action: RuleCommands::Explain {
                    rule: "CSS-001".into(),
                    json: false,
                    markdown: false,
                },
            }),
            rules_path: None,
            validate_rules: false,
        };
        assert!(run_app(cli_rule).is_ok());

        // test run_check with Deny violation
        let deny_temp = tempdir().unwrap();
        let deny_vue = deny_temp.path().join("Bad.vue");
        std::fs::write(&deny_vue, "<script setup>\nconst x = 1;\n</script>\n<style>\n.btn { color: #ff0000; }\n</style>").unwrap();
        let deny_config = deny_temp.path().join("cerberus.json");
        std::fs::write(&deny_config, "{\"version\": \"1.0\", \"rules\": {\"css/no-hardcoded-colors\": \"deny\"}}").unwrap();
        let deny_repo = Arc::new(RulesJsonRepository::load_from_file(&deny_config).unwrap());
        let deny_opts = CheckExecutionOptions {
            rules_repo: deny_repo,
            path: deny_temp.path(),
            sarif_path: None,
            json_path: None,
            ci: false,
        };
        assert!(run_check(deny_opts).is_err());

        // Config load error
        let bad_cli = Cli {
            command: None,
            rules_path: Some(Path::new("non_existent_rules.json").to_path_buf()),
            validate_rules: false,
        };
        assert!(run_app(bad_cli).is_err());
    }
}



