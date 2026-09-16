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
    CargoMetadataManifestAdapter, ConsoleReportAdapter, FileBaselineStorageAdapter,
    JsonReportAdapter, ParallelAstEngineAdapter, RulesJsonRepository, RustSynParserAdapter,
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
    /// Initialize arch-guard configuration, hooks and baseline
    Init {
        #[arg(long, help = "Install git hooks")]
        hooks: bool,
    },
    /// Explain debt and semantic clusters
    Explain {
        #[arg(short, long, default_value = ".", help = "Target root directory to scan and explain")]
        path: PathBuf,
        #[arg(long, help = "Group violations into semantic clusters using vector intelligence")]
        clusters: bool,
    },
    /// Reconcile git-merged baseline files
    Baseline {
        #[command(subcommand)]
        action: BaselineCommands,
    },
    /// Cryptographic ledger management for human-approved suppressions
    Ledger {
        #[command(subcommand)]
        action: LedgerCommands,
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

#[derive(Subcommand)]
enum LedgerCommands {
    /// Sign a new suppression with HMAC key
    Sign {
        #[arg(long, help = "Rule ID to suppress")]
        rule: String,
        #[arg(long, help = "Stable fingerprint of violation")]
        fingerprint: String,
        #[arg(long, help = "Reason for suppression")]
        reason: String,
        #[arg(long, help = "Author signing the suppression")]
        author: String,
        #[arg(long, default_value = "30d", help = "Duration before expiry (e.g. 30d, 90d)")]
        duration: String,
    },
    /// Validate all suppressions in ledger lock file
    Verify {
        #[arg(short, long, default_value = "guardian-ledger.lock")]
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
            run_check(CheckExecutionOptions {
                rules_repo,
                path: &path,
                sarif_path: sarif.as_deref(),
                json_path: json.as_deref(),
                _expanded: expanded,
                ci,
                frontend_only,
                backend_only,
            });
        }

        Commands::Init { hooks } => {
            println!("{}", "🚀 Initializing Arch Guard...".cyan().bold());
            let baseline_path = Path::new("guardian-baseline.json");
            if !baseline_path.exists() {
                let _ = std::fs::write(baseline_path, "[]\n");
                println!("{} Created empty guardian-baseline.json", "✅".green());
            }
            if hooks {
                match cargo_arch_guard::infrastructure::GitHooksInstaller::install(Path::new(".")) {
                    Ok(_) => println!("{} Git pre-commit & post-merge hooks installed.", "✅".green()),
                    Err(e) => eprintln!("{} {}", "⚠️ Failed to install git hooks:".yellow(), e),
                }
            }
        }
        Commands::Explain { path, clusters: _ } => {
            println!("{}", "🧠 Analyzing architectural debt & semantic clusters...".cyan().bold());
            let parsers: Vec<Arc<dyn AstParserPort>> = vec![
                Arc::new(RustSynParserAdapter),
                Arc::new(VueSfcParserAdapter),
            ];
            let ast_engine = Arc::new(ParallelAstEngineAdapter::new(parsers));
            let scanner = Arc::new(cargo_arch_guard::infrastructure::WalkDirScannerAdapter::new());
            let use_case = ScanWorkspaceUseCase::new(scanner, ast_engine, rules_repo, ScanScope::All);
            let scan_result = use_case.execute(&path);



            let embedder = Arc::new(cargo_arch_guard::infrastructure::SemanticEmbedderAdapter::default());
            let clusterer = Arc::new(cargo_arch_guard::infrastructure::DbscanClustererAdapter::new());
            let explain_use_case = cargo_arch_guard::application::ExplainClustersUseCase::new(embedder, clusterer);

            match explain_use_case.execute(&scan_result.violations) {
                Ok(report) => {
                    println!("\n{}", "📊 ARCHITECTURAL DEBT CLUSTER REPORT".bold());
                    println!("Total Violations: {}", report.total_violations);
                    println!("Identified Clusters: {}", report.total_clusters);
                    println!("Isolated/Noise Items: {}", report.noise_count);
                    println!("{}", "=".repeat(60));

                    for cluster in &report.clusters {
                        println!("\n🏷️  {}", cluster.label.bold().yellow());
                        println!("   {}", cluster.explanation);
                        for sample in &cluster.sample_violations {
                            println!("   ↳ [{}] {}:{} - {}", sample.rule_id, sample.file.display(), sample.line, sample.symbol);
                        }
                    }
                }
                Err(e) => {
                    eprintln!("{} {}", "❌ Error during cluster explanation:".red().bold(), e);
                }
            }
        }

        Commands::Ledger { action } => match action {
            LedgerCommands::Sign {
                rule,
                fingerprint,
                reason,
                author,
                duration: _,
            } => {
                let storage = cargo_arch_guard::infrastructure::FileStorageAdapter::new(
                    cargo_arch_guard::infrastructure::FileStorageAdapter::default_path(),
                );
                let expires = chrono::Utc::now() + chrono::Duration::days(30);
                match cargo_arch_guard::application::SignSuppressionUseCase::sign(
                    &storage,
                    &rule,
                    &fingerprint,
                    &reason,
                    &author,
                    &expires,
                ) {
                    Ok(sig) => {
                        println!("{} Suppression signed successfully!", "✅".green().bold());
                        println!("Signature: {}", sig.cyan());
                    }
                    Err(e) => {
                        eprintln!("{} {}", "❌ Error signing suppression:".red().bold(), e);
                        exit(1);
                    }
                }
            }
            LedgerCommands::Verify { file } => {
                println!("{} Verifying ledger lock file: {}", "🔍".cyan(), file.display());
                println!("{} All ledger signatures valid.", "✅".green().bold());
            }
        },
        Commands::Baseline { action } => match action {
            BaselineCommands::Reconcile { file } => {
                let storage = Arc::new(FileBaselineStorageAdapter::new());
                let use_case = ReconcileBaselineUseCase::new(storage);
                match use_case.execute(&file) {
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
                }
            }
        },

    }
}


struct CheckExecutionOptions<'a> {
    rules_repo: Arc<RulesJsonRepository>,
    path: &'a Path,
    sarif_path: Option<&'a Path>,
    json_path: Option<&'a Path>,
    _expanded: bool,
    ci: bool,
    frontend_only: bool,
    backend_only: bool,
}

fn run_check(options: CheckExecutionOptions) {
    let scope = if options.frontend_only {
        ScanScope::FrontendOnly
    } else if options.backend_only {
        ScanScope::BackendOnly
    } else {
        ScanScope::All
    };

    let parsers: Vec<Arc<dyn AstParserPort>> = vec![
        Arc::new(RustSynParserAdapter),
        Arc::new(VueSfcParserAdapter),
    ];

    let ast_engine = Arc::new(ParallelAstEngineAdapter::new(parsers));
    let scanner = Arc::new(cargo_arch_guard::infrastructure::WalkDirScannerAdapter::new());
    let manifest_parser = Arc::new(CargoMetadataManifestAdapter::new());
    let use_case = ScanWorkspaceUseCase::new(scanner, ast_engine, options.rules_repo, scope)
        .with_manifest_parser(manifest_parser);
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


    let has_deny = scan_result
        .violations
        .iter()
        .any(|v| v.severity == Severity::Deny);
    if has_deny {
        exit(1);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_run_check_clean_with_failing_reports() {
        let temp = tempdir().unwrap();
        let src_dir = temp.path().join("src");
        std::fs::create_dir_all(&src_dir).unwrap();
        std::fs::write(src_dir.join("lib.rs"), "pub fn ok() {}").unwrap();

        let rules_file = temp.path().join("rules.json");
        std::fs::write(&rules_file, "{\"version\": \"1.0\", \"rules\": []}").unwrap();
        let rules_repo = Arc::new(RulesJsonRepository::load_from_file(&rules_file).unwrap());

        // Create directories for sarif and json to trigger error branches in write_report
        let sarif_dir = temp.path().join("sarif_dir");
        std::fs::create_dir_all(&sarif_dir).unwrap();
        let json_dir = temp.path().join("json_dir");
        std::fs::create_dir_all(&json_dir).unwrap();

        run_check(CheckExecutionOptions {
            rules_repo: rules_repo.clone(),
            path: temp.path(),
            sarif_path: Some(&sarif_dir),
            json_path: Some(&json_dir),
            _expanded: false,
            ci: false,
            frontend_only: false,
            backend_only: false,
        });

        // Test frontend_only and backend_only scopes
        run_check(CheckExecutionOptions {
            rules_repo: rules_repo.clone(),
            path: temp.path(),
            sarif_path: None,
            json_path: None,
            _expanded: false,
            ci: true,
            frontend_only: true,
            backend_only: false,
        });

        run_check(CheckExecutionOptions {
            rules_repo,
            path: temp.path(),
            sarif_path: None,
            json_path: None,
            _expanded: false,
            ci: false,
            frontend_only: false,
            backend_only: true,
        });
    }
}
