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
    std::fs::write(config_path, initial_config)
        .map_err(|e| format!("Failed to create cerberus.json: {}", e))?;
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
                let json_str = serde_json::to_string_pretty(&report)
                    .map_err(|e| format!("Failed to serialize JSON report: {}", e))?;
                std::fs::write(json_path, json_str)
                    .map_err(|e| format!("Failed to write JSON report: {}", e))?;
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
