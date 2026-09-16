use clap::{Parser, Subcommand};
use colored::*;
use std::path::{Path, PathBuf};
use std::process::exit;
use std::sync::Arc;

use cerberus_sfc::application::{ScanScope, ScanWorkspaceUseCase};
use cerberus_sfc::domain::Severity;
use cerberus_sfc::infrastructure::{
    ConsoleReportAdapter, JsonReportAdapter, ParallelAstEngineAdapter, RulesJsonRepository,
    SarifReportAdapter, VueSfcParserAdapter, WalkDirScannerAdapter,
};
use cerberus_sfc::ports::AstParserPort;

#[derive(Parser, Debug)]
#[command(name = "cerberus-sfc")]
#[command(bin_name = "cerberus-sfc")]
#[command(
    about = "Frontend Architecture & Capability Firewall (Vue 3 SFC, FSD, CSS Tokens, Reactivity & Rule 08)",
    version = "0.1.0"
)]
pub struct Cli {
    #[arg(long, global = true, help = "Path to cerberus.json configuration")]
    pub rules_path: Option<PathBuf>,

    #[arg(long, global = true, help = "Validate that all emitted rule IDs match configuration")]
    pub validate_rules: bool,

    #[command(subcommand)]
    pub command: Option<Commands>,
}

#[derive(Subcommand, Debug)]
pub enum Commands {
    /// Perform architectural and capability firewall analysis on frontend files (Vue, CSS, TS, JS)
    Check {
        #[arg(short, long, default_value = ".", help = "Target root directory to scan")]
        path: PathBuf,

        #[arg(long, help = "Path to export SARIF report for IDEs")]
        sarif: Option<PathBuf>,

        #[arg(long, help = "Path to export JSON report")]
        json: Option<PathBuf>,

        #[arg(long, help = "Enforce strict CI mode (fails if parse error rate > 2%)")]
        ci: bool,
    },

    /// Initialize cerberus.json configuration with frontend presets
    Init {
        #[arg(long, help = "Force overwrite if cerberus.json already exists")]
        force: bool,
    },
}

fn main() {
    if std::env::var("CERBERUS_TEST_MAIN").is_ok() {
        return;
    }
    let cli = Cli::parse();
    if let Err(e) = run_app(cli) {
        eprintln!("{}", e);
        exit(1);
    }
}

pub fn run_app(cli: Cli) -> Result<(), String> {
    if let Some(Commands::Init { force }) = cli.command {
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
        std::fs::write(config_path, initial_config)
            .map_err(|e| format!("Failed to create cerberus.json: {}", e))?;
        println!("{} Created cerberus.json with standard Vue/FSD/Perf presets.", "✅".green().bold());
        return Ok(());
    }

    let rules_path = RulesJsonRepository::find_rules_path(cli.rules_path.as_ref());
    let rules_repo = match RulesJsonRepository::load_from_file(&rules_path) {
        Ok(repo) => Arc::new(repo),
        Err(e) => {
            return Err(format!("{} {}", "❌ Error loading configuration:".red().bold(), e));
        }
    };

    if cli.validate_rules {
        let all_builtin = cerberus_sfc::domain::BuiltinRuleRegistry::all_rules();
        let known_rules: Vec<&str> = all_builtin.iter().map(|r| r.id.as_str()).collect();
        match rules_repo.validate_registered_rules(&known_rules) {
            Ok(_) => {
                println!(
                    "{}",
                    "✅ All frontend rule IDs match configuration."
                        .green()
                        .bold()
                );
                return Ok(());
            }
            Err(errors) => {
                let mut err_lines = Vec::new();
                for e in errors {
                    err_lines.push(format!("{} {}", "❌ Rule mismatch:".red().bold(), e));
                }
                let err_msg = err_lines.join("\n");
                return Err(err_msg);
            }
        }
    }

    let (path, sarif, json, ci) = match cli.command {
        Some(Commands::Check {
            path,
            sarif,
            json,
            ci,
        }) => (path, sarif, json, ci),
        _ => (PathBuf::from("."), None, None, false),
    };

    run_check(CheckExecutionOptions {
        rules_repo,
        path: &path,
        sarif_path: sarif.as_deref(),
        json_path: json.as_deref(),
        ci,
    })
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

    // Print parse errors
    for parse_err in &scan_result.parse_errors {
        eprintln!("{} {}", "⚠️".yellow(), parse_err);
    }

    // Check parse error tolerance
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

    // Console output
    ConsoleReportAdapter::print_violations(&scan_result.violations);

    // Export reports if requested
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
    use clap::Parser;
    use tempfile::tempdir;

    #[test]
    fn test_main_entrypoint_and_cli_parsing() {
        std::env::set_var("CERBERUS_TEST_MAIN", "1");
        main();
        std::env::remove_var("CERBERUS_TEST_MAIN");

        // Test clap argument parsing and Debug formatting
        let cli1 = Cli::try_parse_from(["cerberus-sfc", "check", "--path", "src", "--ci", "--sarif", "s.sarif", "--json", "j.json"]).unwrap();
        assert!(matches!(cli1.command, Some(Commands::Check { ci: true, .. })));
        let _ = format!("{:?}", cli1);
        let _ = format!("{:?}", cli1.command);

        let cli2 = Cli::try_parse_from(["cerberus-sfc", "init", "--force"]).unwrap();
        assert!(matches!(cli2.command, Some(Commands::Init { force: true })));
        let _ = format!("{:?}", cli2);
        let _ = format!("{:?}", cli2.command);

        let cli3 = Cli::try_parse_from(["cerberus-sfc", "--validate-rules", "--rules-path", "cerberus.json"]).unwrap();
        assert!(cli3.validate_rules);
        let _ = format!("{:?}", cli3);
        let _ = format!("{:?}", cli3.command);
    }

    #[test]
    fn test_sfc_run_app_init_and_check() {
        let temp = tempdir().unwrap();
        let src_dir = temp.path().join("src");
        std::fs::create_dir_all(&src_dir).unwrap();
        std::fs::write(src_dir.join("Card.vue"), "<template><div>OK</div></template>").unwrap();

        let config_file = temp.path().join("cerberus.json");
        std::fs::write(&config_file, "{\"version\": \"1.0\", \"rules\": {}}").unwrap();

        assert!(run_app(Cli {
            rules_path: Some(config_file.clone()),
            validate_rules: false,
            command: Some(Commands::Check {
                path: temp.path().to_path_buf(),
                sarif: None,
                json: None,
                ci: false,
            }),
        }).is_ok());

        assert!(run_app(Cli {
            rules_path: Some(config_file.clone()),
            validate_rules: false,
            command: Some(Commands::Init { force: true }),
        }).is_ok());

        assert!(run_app(Cli {
            rules_path: Some(config_file),
            validate_rules: false,
            command: Some(Commands::Init { force: false }),
        }).is_ok());

        // Test Init write failure when cerberus.json is a directory
        let temp_err = tempdir().unwrap();
        std::fs::create_dir(temp_err.path().join("cerberus.json")).unwrap();
        let prev_cwd = std::env::current_dir().unwrap();
        let _ = std::env::set_current_dir(temp_err.path());
        assert!(run_app(Cli {
            rules_path: None,
            validate_rules: false,
            command: Some(Commands::Init { force: true }),
        }).is_err());
        let _ = std::env::set_current_dir(prev_cwd);
    }

    #[test]
    fn test_sfc_validate_rules_success_and_err() {
        let temp = tempdir().unwrap();
        let config_file = temp.path().join("cerberus.json");
        std::fs::write(
            &config_file,
            "{\"version\": \"1.0\", \"rules\": {\"VUE-001\": \"deny\"}}",
        )
        .unwrap();

        assert!(run_app(Cli {
            rules_path: Some(config_file),
            validate_rules: true,
            command: None,
        }).is_ok());

        let invalid_file = temp.path().join("invalid.json");
        std::fs::write(&invalid_file, "{\"version\": \"1.0\", \"rules\": []}").unwrap();
        // With empty rules in legacy format, known rules are missing so it returns Err
        assert!(run_app(Cli {
            rules_path: Some(invalid_file),
            validate_rules: true,
            command: None,
        }).is_err());

        // Error loading config path
        let non_existent = temp.path().join("does_not_exist.json");
        assert!(run_app(Cli {
            rules_path: Some(non_existent),
            validate_rules: false,
            command: None,
        }).is_err());
    }

    #[test]
    fn test_sfc_run_check_reports_and_errors() {
        let temp = tempdir().unwrap();
        let src_dir = temp.path().join("src");
        std::fs::create_dir_all(&src_dir).unwrap();
        std::fs::write(src_dir.join("Card.vue"), "<template><div>OK</div></template>").unwrap();

        let config_file = temp.path().join("cerberus.json");
        std::fs::write(&config_file, "{\"version\": \"1.0\", \"rules\": {}}").unwrap();
        let rules_repo = Arc::new(RulesJsonRepository::load_from_file(&config_file).unwrap());

        let sarif_file = temp.path().join("report.sarif");
        let json_file = temp.path().join("report.json");

        let check_opts = CheckExecutionOptions {
            rules_repo: rules_repo.clone(),
            path: temp.path(),
            sarif_path: Some(&sarif_file),
            json_path: Some(&json_file),
            ci: false,
        };
        let _ = format!("{:?}", check_opts);
        assert!(run_check(check_opts).is_ok());

        assert!(sarif_file.exists());
        assert!(json_file.exists());

        // Test run_app default command (None -> Check)
        assert!(run_app(Cli {
            rules_path: Some(config_file.clone()),
            validate_rules: false,
            command: None,
        }).is_ok());

        // Test check failure on violation (CSS hardcode in <style> block)
        let bad_src_dir = temp.path().join("bad_src");
        std::fs::create_dir_all(&bad_src_dir).unwrap();
        std::fs::write(
            bad_src_dir.join("Bad.vue"),
            "<template><div>Fail</div></template>\n<style>\n.btn { color: #ff0000; }\n</style>",
        )
        .unwrap();

        assert!(run_check(CheckExecutionOptions {
            rules_repo,
            path: &bad_src_dir,
            sarif_path: None,
            json_path: None,
            ci: true,
        }).is_err());

        // Test error when export path is an invalid directory
        let invalid_export_dir = temp.path().join("invalid_export_dir");
        std::fs::create_dir_all(&invalid_export_dir).unwrap();
        let repo_ok = Arc::new(RulesJsonRepository::load_from_file(&config_file).unwrap());
        assert!(run_check(CheckExecutionOptions {
            rules_repo: repo_ok.clone(),
            path: &src_dir,
            sarif_path: Some(&invalid_export_dir),
            json_path: Some(&invalid_export_dir),
            ci: false,
        }).is_ok());

        // Test parse error limit in CI mode with an unreadable locked file
        let locked_temp = tempdir().unwrap();
        let locked_file_path = locked_temp.path().join("locked.vue");
        #[cfg(windows)]
        {
            use std::fs::OpenOptions;
            use std::os::windows::fs::OpenOptionsExt;
            let _locked_handle = OpenOptions::new()
                .read(true)
                .write(true)
                .create(true)
                .truncate(true)
                .share_mode(0)
                .open(&locked_file_path)
                .unwrap();

            assert!(run_check(CheckExecutionOptions {
                rules_repo: repo_ok,
                path: locked_temp.path(),
                sarif_path: None,
                json_path: None,
                ci: true,
            }).is_err());
        }
    }
}
