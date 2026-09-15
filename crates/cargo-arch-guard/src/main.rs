use clap::{Parser, Subcommand};
use colored::*;
use std::path::{Path, PathBuf};
use std::process::exit;
use std::sync::Arc;

use cargo_arch_guard::application::{
    ReconcileBaselineUseCase, ScanScope, ScanWorkspaceUseCase,
};
use cargo_arch_guard::domain::Severity;
use cargo_arch_guard::infrastructure::{
    ConsoleReportAdapter, JsonReportAdapter, RulesJsonRepository, RustSynParserAdapter,
    SarifReportAdapter, VueSfcParserAdapter,
};
use cargo_arch_guard::ports::AstParserPort;

#[derive(Parser)]
#[command(name = "cargo-arch-guard")]
#[command(bin_name = "cargo-arch-guard")]
#[command(
    about = "Architectural & Capability Firewall (Hexagonal Core: Ports & Adapters)",
    version = "0.1.0"
)]
struct Cli {
    #[arg(long, global = true, help = "Path to rules.json configuration")]
    rules_path: Option<PathBuf>,

    #[arg(long, global = true, help = "Validate that all emitted rule IDs match rules.json")]
    validate_rules: bool,

    #[command(subcommand)]
    command: Option<Commands>,
}

#[derive(Subcommand)]
enum Commands {
    /// Perform architectural and capability firewall analysis on the workspace (Rust, Vue, CSS, TS)
    Check {
        #[arg(short, long, default_value = ".", help = "Target root directory to scan")]
        path: PathBuf,

        #[arg(long, help = "Path to export SARIF report for IDEs")]
        sarif: Option<PathBuf>,

        #[arg(long, help = "Path to export JSON report")]
        json: Option<PathBuf>,

        #[arg(long, help = "Run deep macro expansion audit via cargo rustc -Zunpretty=expanded")]
        expanded: bool,

        #[arg(long, help = "Enforce strict CI mode (fails if parse error rate > 2%)")]
        ci: bool,

        #[arg(long, help = "Scan strictly frontend files (Vue, CSS, TS)")]
        frontend_only: bool,

        #[arg(long, help = "Scan strictly backend files (Rust)")]
        backend_only: bool,
    },
    /// Reconcile git-merged baseline files
    Baseline {
        #[command(subcommand)]
        action: BaselineCommands,
    },
}

#[derive(Subcommand)]
enum BaselineCommands {
    /// Deduplicate and fix merged guardian-baseline.json
    Reconcile {
        #[arg(short, long, default_value = "guardian-baseline.json")]
        file: PathBuf,
    },
}

fn main() {
    let cli = Cli::parse();

    let rules_path = RulesJsonRepository::find_rules_path(cli.rules_path.as_ref());
    let rules_repo = match RulesJsonRepository::load_from_file(&rules_path) {
        Ok(repo) => Arc::new(repo),
        Err(e) => {
            eprintln!("{} {}", "❌ Error loading rules:".red().bold(), e);
            exit(1);
        }
    };

    if cli.validate_rules {
        let known_rules = [
            "ARCH-001", "ARCH-002", "ARCH-005", "ASYNC-001", "SEC-001", "VUE-001", "VUE-002",
            "CSS-001", "CSS-004", "LEAK-001",
        ];
        match rules_repo.validate_registered_rules(&known_rules) {
            Ok(_) => {
                println!(
                    "{}",
                    "✅ All emitted rule IDs match rules.json registry."
                        .green()
                        .bold()
                );
                return;
            }
            Err(errors) => {
                for err in errors {
                    eprintln!("{} {}", "❌ Rule mismatch:".red().bold(), err);
                }
                exit(1);
            }
        }
    }

    match cli.command.unwrap_or(Commands::Check {
        path: PathBuf::from("."),
        sarif: None,
        json: None,
        expanded: false,
        ci: false,
        frontend_only: false,
        backend_only: false,
    }) {
        Commands::Check {
            path,
            sarif,
            json,
            expanded,
            ci,
            frontend_only,
            backend_only,
        } => {
            run_check(
                rules_repo,
                &path,
                sarif.as_deref(),
                json.as_deref(),
                expanded,
                ci,
                frontend_only,
                backend_only,
            );
        }
        Commands::Baseline { action } => match action {
            BaselineCommands::Reconcile { file } => match ReconcileBaselineUseCase::execute(&file) {
                Ok(count) => {
                    println!(
                        "{} Reconciled baseline file {} ({} entries)",
                        "✅".green().bold(),
                        file.display(),
                        count
                    );
                }
                Err(e) => {
                    eprintln!("{} {}", "❌ Failed to reconcile baseline:".red().bold(), e);
                    exit(1);
                }
            },
        },
    }
}

fn run_check(
    rules_repo: Arc<RulesJsonRepository>,
    path: &Path,
    sarif_path: Option<&Path>,
    json_path: Option<&Path>,
    _expanded: bool,
    ci: bool,
    frontend_only: bool,
    backend_only: bool,
) {
    let scope = if frontend_only {
        ScanScope::FrontendOnly
    } else if backend_only {
        ScanScope::BackendOnly
    } else {
        ScanScope::All
    };

    let parsers: Vec<Arc<dyn AstParserPort>> = vec![
        Arc::new(RustSynParserAdapter),
        Arc::new(VueSfcParserAdapter),
    ];

    let use_case = ScanWorkspaceUseCase::new(parsers, rules_repo, scope);
    let scan_result = use_case.execute(path);

    // Print parse errors
    for parse_err in &scan_result.parse_errors {
        eprintln!("{} {}", "⚠️".yellow(), parse_err);
    }

    // Check parse error tolerance
    if scan_result.total_files_scanned > 0 {
        let error_rate =
            (scan_result.parse_errors.len() as f64) / (scan_result.total_files_scanned as f64);
        let max_tolerated = if ci { 0.02 } else { 0.05 };
        if error_rate > max_tolerated {
            eprintln!(
                "{} Parse error rate ({:.1}%) exceeds limit ({:.1}%). Failing build.",
                "❌ [PARSE-ERROR-LIMIT]".red().bold(),
                error_rate * 100.0,
                max_tolerated * 100.0
            );
            exit(1);
        }
    }

    // Console output
    ConsoleReportAdapter::print_violations(&scan_result.violations);

    // Export reports if requested
    if let Some(sp) = sarif_path {
        if let Err(e) = SarifReportAdapter::write_report(sp, &scan_result.violations) {
            eprintln!("{} {}", "Failed to write SARIF report:".red(), e);
        }
    }

    if let Some(jp) = json_path {
        if let Err(e) = JsonReportAdapter::write_report(jp, &scan_result.violations) {
            eprintln!("{} {}", "Failed to write JSON report:".red(), e);
        }
    }

    let has_deny = scan_result
        .violations
        .iter()
        .any(|v| v.severity == Severity::Deny);
    if has_deny {
        exit(1);
    }
}
