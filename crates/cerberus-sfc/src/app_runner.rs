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

use crate::cli::{Cli, Commands};

pub fn run_app(cli: Cli) -> Result<(), String> {
    if let Some(Commands::Init { force }) = cli.command {
        return handle_init(force);
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

fn handle_init(force: bool) -> Result<(), String> {
    println!("{}", "🚀 Initializing Cerberus Frontend Guardian...".cyan().bold());
    let config_path = Path::new("cerberus.json");
    if config_path.exists() && !force {
        println!("{} cerberus.json already exists (use --force to overwrite)", "ℹ️".yellow());
        return Ok(());
    }

    let initial_config = r#"{
  "$schema": "https://cerberus-firewall.dev/schema.json",
  "version": "1.0",
  "ignore": [
    ".logic_legacy/**",
    "tests/fixtures/**",
    "target/**",
    "node_modules/**",
    "dist/**",
    "coverage/**"
  ],
  "extends": [
    "cerberus:vue-clean-architecture",
    "cerberus:fsd-strict",
    "cerberus:perf-high-fps",
    "cerberus:css-design-tokens"
  ],
  "rules": {
    "vue/no-monolith-script-setup": "deny",
    "vue/require-companion-hook": "deny",
    "vue/no-types-in-sfc": "deny",
    "css/no-hardcoded-colors": "deny",
    "css/require-design-tokens": "deny",
    "css/max-style-lines": "warn",
    "fsd/layer-imports-hierarchy": "deny",
    "fsd/public-api-only": "deny",
    "fsd/ui-kit-zero-domain": "deny",
    "perf/shallow-ref-for-heavy-ast": "deny",
    "perf/no-reactive-canvas-three": "deny",
    "perf/no-allocations-in-raf": "deny",
    "leak/uncleaned-ipc-listener": "deny"
  }
}
"#;
    if let Err(e) = std::fs::write(config_path, initial_config) {
        return Err(format!("Failed to create cerberus.json: {}", e));
    }
    println!("{} Created cerberus.json with standard Vue/FSD/Perf presets.", "✅".green().bold());
    Ok(())
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
        let old_cwd = std::env::current_dir().unwrap();
        std::env::set_current_dir(init_temp.path()).unwrap();
        assert!(handle_init(false).is_ok());
        assert!(handle_init(false).is_ok()); // already exists
        assert!(handle_init(true).is_ok()); // force overwrite
        std::env::set_current_dir(old_cwd).unwrap();

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
        let cli_init = Cli {
            command: Some(Commands::Init { force: true }),
            rules_path: None,
            validate_rules: false,
        };
        assert!(run_app(cli_init).is_ok());

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



