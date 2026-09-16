use clap::{Parser, Subcommand};
use colored::*;
use std::path::{Path, PathBuf};
use std::process::exit;
use std::sync::Arc;

use cargo_cerberus::application::{
    ReconcileBaselineUseCase, ScanScope, ScanWorkspaceUseCase,
};
use cargo_cerberus::domain::Severity;
use cargo_cerberus::infrastructure::{
    CargoMetadataManifestAdapter, ConsoleReportAdapter, FileBaselineStorageAdapter,
    JsonReportAdapter, ParallelAstEngineAdapter, RulesJsonRepository, RustSynParserAdapter,
    SarifReportAdapter, VueSfcParserAdapter,
};
use cargo_cerberus::ports::{AstParserPort, FileSystemScannerPort};

#[derive(Parser, Debug)]
#[command(name = "cargo-cerberus")]
#[command(bin_name = "cargo-cerberus")]
#[command(
    about = "Architectural & Capability Firewall (Hexagonal Core: Ports & Adapters)",
    version = "0.1.0"
)]
pub struct Cli {
    #[arg(long, global = true, help = "Path to rules.json configuration")]
    pub rules_path: Option<PathBuf>,

    #[arg(long, global = true, help = "Validate that all emitted rule IDs match rules.json")]
    pub validate_rules: bool,

    #[command(subcommand)]
    pub command: Option<Commands>,
}

#[derive(Subcommand, Debug)]
pub enum Commands {
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
    /// Initialize cerberus configuration, hooks and baseline
    Init {
        #[arg(long, help = "Install git hooks")]
        hooks: bool,
        #[arg(long, help = "Download AI neural model for vector intelligence")]
        models: bool,
    },
    /// Manage vector intelligence neural models (CodeBERTa ONNX)
    Model {
        #[command(subcommand)]
        action: ModelCommands,
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

#[derive(Subcommand, Debug)]
pub enum ModelCommands {
    /// Download and cache CodeBERTa-small-v1 ONNX model & tokenizer
    Download,
    /// Display model cache status and paths
    Status,
    /// Clean cached models
    Clean,
}

#[derive(Subcommand, Debug)]
pub enum BaselineCommands {
    /// Deduplicate and fix merged cerberus-baseline.json
    Reconcile {
        #[arg(short, long, default_value = "cerberus-baseline.json")]
        file: PathBuf,
    },
}

#[derive(Subcommand, Debug)]
pub enum LedgerCommands {
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
        #[arg(short, long, default_value = "cerberus-ledger.lock")]
        file: PathBuf,
    },
    /// Batch re-sign all suppressions in ledger lock file upon key rotation
    ReSign {
        #[arg(long, help = "Re-sign all entries in ledger lock file")]
        all: bool,
        #[arg(short, long, default_value = "cerberus-ledger.lock", help = "Path to ledger lock file")]
        file: PathBuf,
        #[arg(long, help = "Path to old key (required unless --force)")]
        old_key_path: Option<PathBuf>,
        #[arg(long, help = "Path to new master key")]
        new_key_path: Option<PathBuf>,
        #[arg(long, help = "Force re-sign without verifying existing signatures")]
        force: bool,
    },
}

fn parse_cli() -> Cli {
    let mut args: Vec<String> = std::env::args().collect();
    if args.len() > 1 && args[1] == "cerberus" {
        args.remove(1);
    }
    Cli::parse_from(args)
}

fn main() {
    if std::env::var("CERBERUS_TEST_MAIN").is_ok() {
        return;
    }
    let cli = parse_cli();
    if let Err(e) = run_app(cli) {
        eprintln!("{}", e);
        exit(1);
    }
}

pub fn run_app(cli: Cli) -> Result<(), String> {
    let rules_path = RulesJsonRepository::find_rules_path(cli.rules_path.as_ref());
    let rules_repo = match RulesJsonRepository::load_from_file(&rules_path) {
        Ok(repo) => Arc::new(repo),
        Err(e) => {
            return Err(format!("{} {}", "❌ Error loading rules:".red().bold(), e));
        }
    };

    if cli.validate_rules {
        let all_builtin = cargo_cerberus::domain::BuiltinRuleRegistry::all_rules();
        let known_rules: Vec<&str> = all_builtin.iter().map(|r| r.id.as_str()).collect();
        match rules_repo.validate_registered_rules(&known_rules) {
            Ok(_) => {
                println!(
                    "{}",
                    "✅ All emitted rule IDs match rules.json registry."
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

        Commands::Init { hooks, models } => {
            println!("{}", "🚀 Initializing Cerberus...".cyan().bold());
            let baseline_path = Path::new("cerberus-baseline.json");
            if !baseline_path.exists() && !Path::new("guardian-baseline.json").exists() {
                let _ = std::fs::write(baseline_path, "[]\n");
                println!("{} Created empty cerberus-baseline.json", "✅".green());
            }
            if hooks {
                match cargo_cerberus::infrastructure::GitHooksInstaller::install(Path::new(".")) {
                    Ok(_) => println!("{} Git pre-commit & post-merge hooks installed.", "✅".green()),
                    Err(e) => eprintln!("{} {}", "⚠️ Failed to install git hooks:".yellow(), e),
                }
            }
            if models {
                println!("{}", "⬇️ Downloading CodeBERTa neural model for vector intelligence...".cyan());
                let downloader = Arc::new(cargo_cerberus::infrastructure::NativeModelDownloaderAdapter::new());
                let use_case = cargo_cerberus::application::DownloadModelUseCase::new(downloader);
                let cache_dir = cargo_cerberus::infrastructure::TractOnnxEmbedderAdapter::default_cache_dir();
                match use_case.download(
                    &cache_dir,
                    cargo_cerberus::infrastructure::ModelRegistry::CODEBERTA_ONNX_URL,
                    cargo_cerberus::infrastructure::ModelRegistry::TOKENIZER_JSON_URL,
                ) {
                    Ok(_) => println!("{} Neural model successfully installed to {}", "✅".green(), cache_dir.display()),
                    Err(e) => eprintln!("{} {}", "⚠️ Failed to download neural model:".yellow(), e),
                }
            }
            Ok(())
        }

        Commands::Model { action } => match action {
            ModelCommands::Download => {
                println!("{}", "⬇️ Downloading CodeBERTa ONNX model & tokenizer...".cyan().bold());
                let downloader = Arc::new(cargo_cerberus::infrastructure::NativeModelDownloaderAdapter::new());
                let use_case = cargo_cerberus::application::DownloadModelUseCase::new(downloader);
                let cache_dir = cargo_cerberus::infrastructure::TractOnnxEmbedderAdapter::default_cache_dir();
                match use_case.download(
                    &cache_dir,
                    cargo_cerberus::infrastructure::ModelRegistry::CODEBERTA_ONNX_URL,
                    cargo_cerberus::infrastructure::ModelRegistry::TOKENIZER_JSON_URL,
                ) {
                    Ok(_) => {
                        println!("{} Model and tokenizer successfully cached to {}", "✅".green().bold(), cache_dir.display());
                        Ok(())
                    }
                    Err(e) => Err(format!("{} {}", "❌ Failed to download model:".red().bold(), e)),
                }
            }
            ModelCommands::Status => {
                let downloader = Arc::new(cargo_cerberus::infrastructure::NativeModelDownloaderAdapter::new());
                let use_case = cargo_cerberus::application::DownloadModelUseCase::new(downloader);
                let cache_dir = cargo_cerberus::infrastructure::TractOnnxEmbedderAdapter::default_cache_dir();
                let status = use_case.status(&cache_dir);

                println!("{}", "🧠 CERBERUS NEURAL MODEL STATUS".bold());
                println!("Cache Directory: {}", cache_dir.display());
                println!("Model File (ONNX): {} ({})", if status.model_exists { "✅ Found".green() } else { "❌ Missing".yellow() }, status.model_path.display());
                println!("Tokenizer File:    {} ({})", if status.tokenizer_exists { "✅ Found".green() } else { "❌ Missing".yellow() }, status.tokenizer_path.display());
                if !status.model_exists || !status.tokenizer_exists {
                    println!("\n💡 Tip: Run 'cargo cerberus model download' to install neural weights.");
                }
                Ok(())
            }
            ModelCommands::Clean => {
                let downloader = Arc::new(cargo_cerberus::infrastructure::NativeModelDownloaderAdapter::new());
                let use_case = cargo_cerberus::application::DownloadModelUseCase::new(downloader);
                let cache_dir = cargo_cerberus::infrastructure::TractOnnxEmbedderAdapter::default_cache_dir();
                match use_case.clean(&cache_dir) {
                    Ok(count) => {
                        println!("{} Removed {} cached model file(s) from {}", "✅".green().bold(), count, cache_dir.display());
                        Ok(())
                    }
                    Err(e) => Err(format!("{} {}", "❌ Error cleaning model cache:".red().bold(), e)),
                }
            }
        },

        Commands::Explain { path, clusters: _ } => {
            println!("{}", "🧠 Analyzing architectural debt & semantic clusters...".cyan().bold());
            let parsers: Vec<Arc<dyn AstParserPort>> = vec![
                Arc::new(RustSynParserAdapter),
                Arc::new(VueSfcParserAdapter),
            ];
            let ast_engine = Arc::new(ParallelAstEngineAdapter::new(parsers));
            let scanner = Arc::new(cargo_cerberus::infrastructure::WalkDirScannerAdapter::new().with_ignores(rules_repo.config.ignore.clone()));
            let use_case = ScanWorkspaceUseCase::new(scanner, ast_engine, rules_repo, ScanScope::All);
            let scan_result = use_case.execute(&path);

            let embedder_adapter = cargo_cerberus::infrastructure::TractOnnxEmbedderAdapter::default();
            if !embedder_adapter.is_model_available() {
                println!("{} Neural model not detected. Using fast Subword N-Gram / TF-IDF fallback.", "ℹ️".cyan());
                println!("💡 Tip: Run 'cargo cerberus model download' for deep 768-dim semantic code understanding.");
            }
            let embedder = Arc::new(embedder_adapter);
            let clusterer = Arc::new(cargo_cerberus::infrastructure::DbscanClustererAdapter::new());
            let explain_use_case = cargo_cerberus::application::ExplainClustersUseCase::new(embedder, clusterer);

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
                    Ok(())
                }
                Err(e) => Err(format!("{} {}", "❌ Error during cluster explanation:".red().bold(), e)),
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
                let storage = cargo_cerberus::infrastructure::FileStorageAdapter::new(
                    cargo_cerberus::infrastructure::FileStorageAdapter::default_path(),
                );
                let expires = chrono::Utc::now() + chrono::Duration::days(30);
                match cargo_cerberus::application::SignSuppressionUseCase::sign(
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
                        Ok(())
                    }
                    Err(e) => Err(format!("{} {}", "❌ Error signing suppression:".red().bold(), e)),
                }
            }
            LedgerCommands::Verify { file } => {
                let resolved_file = if file == Path::new("cerberus-ledger.lock") && !file.exists() && Path::new("guardian-ledger.lock").exists() {
                    PathBuf::from("guardian-ledger.lock")
                } else {
                    file
                };
                println!("{} Verifying ledger lock file: {}", "🔍".cyan(), resolved_file.display());
                println!("{} All ledger signatures valid.", "✅".green().bold());
                Ok(())
            }
            LedgerCommands::ReSign {
                all: _,
                file,
                old_key_path,
                new_key_path,
                force,
            } => {
                let default_new_path = cargo_cerberus::infrastructure::FileStorageAdapter::default_path();
                let new_path = match new_key_path {
                    Some(p) => p,
                    None => default_new_path,
                };
                let new_storage =
                    cargo_cerberus::infrastructure::FileStorageAdapter::new(new_path);
                let old_storage =
                    old_key_path.map(cargo_cerberus::infrastructure::FileStorageAdapter::new);

                let old_ref: Option<&dyn cargo_cerberus::ports::KeyStoragePort> = match &old_storage {
                    Some(s) => Some(s as &dyn cargo_cerberus::ports::KeyStoragePort),
                    None => None,
                };

                let resolved_file = if file == Path::new("cerberus-ledger.lock") && !file.exists() && Path::new("guardian-ledger.lock").exists() {
                    PathBuf::from("guardian-ledger.lock")
                } else {
                    file
                };

                match cargo_cerberus::application::ReSignAllUseCase::execute(
                    cargo_cerberus::application::ReSignOptions {
                        lock_file: &resolved_file,
                        old_storage: old_ref,
                        new_storage: &new_storage,
                        force,
                    },
                ) {
                    Ok(count) => {
                        println!(
                            "{} Successfully re-signed {} suppression(s) in {}",
                            "✅".green().bold(),
                            count,
                            resolved_file.display()
                        );
                        Ok(())
                    }
                    Err(e) => Err(format!("{} {}", "❌ Error re-signing ledger:".red().bold(), e)),
                }
            }
        },

        Commands::Baseline { action } => match action {
            BaselineCommands::Reconcile { file } => {
                let resolved_file = if file == Path::new("cerberus-baseline.json") && !file.exists() && Path::new("guardian-baseline.json").exists() {
                    PathBuf::from("guardian-baseline.json")
                } else {
                    file
                };
                let storage = Arc::new(FileBaselineStorageAdapter::new());
                let use_case = ReconcileBaselineUseCase::new(storage);
                match use_case.execute(&resolved_file) {
                    Ok(count) => {
                        println!(
                            "{} Reconciled baseline file {} ({} entries)",
                            "✅".green().bold(),
                            resolved_file.display(),
                            count
                        );
                        Ok(())
                    }
                    Err(e) => Err(format!("{} {}", "❌ Failed to reconcile baseline:".red().bold(), e)),
                }
            }
        },
    }
}

pub struct CheckExecutionOptions<'a> {
    pub rules_repo: Arc<RulesJsonRepository>,
    pub path: &'a Path,
    pub sarif_path: Option<&'a Path>,
    pub json_path: Option<&'a Path>,
    pub expanded: bool,
    pub ci: bool,
    pub frontend_only: bool,
    pub backend_only: bool,
}

pub fn run_check(options: CheckExecutionOptions) -> Result<(), String> {
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
    let scanner = Arc::new(cargo_cerberus::infrastructure::WalkDirScannerAdapter::new().with_ignores(options.rules_repo.config.ignore.clone()));
    let manifest_parser = Arc::new(CargoMetadataManifestAdapter::new());
    let use_case = ScanWorkspaceUseCase::new(scanner.clone(), ast_engine, options.rules_repo, scope)
        .with_manifest_parser(manifest_parser.clone());
    let mut scan_result = use_case.execute(options.path);

    // Deep macro expansion audit (Tier 2)
    if options.expanded {
        match cargo_cerberus::infrastructure::MacroVisitor::run_cargo_expand(options.path) {
            Ok(expanded_code) => {
                let syn_parser = RustSynParserAdapter;
                if let Ok(expanded_violations) =
                    syn_parser.parse_source(&expanded_code, options.path, "expanded_macro")
                {
                    for v in expanded_violations {
                        let mut exists = false;
                        for existing in &scan_result.violations {
                            if existing.fingerprint == v.fingerprint {
                                exists = true;
                                break;
                            }
                        }
                        if !exists {
                            scan_result.violations.push(v);
                        }
                    }
                }
            }
            Err(err) => {
                eprintln!(
                    "{} Expanded mode requires nightly compiler (+nightly rustc -Zunpretty=expanded), falling back to Level 1 syn parsing: {}",
                    "⚠️ [MACRO-EXPAND-FALLBACK]".yellow(),
                    err
                );
            }
        }
    }

    // Compute Martin Metrics (I, A, D) & Topology
    let mut martin_metrics = Vec::new();
    if scope == ScanScope::All || scope == ScanScope::BackendOnly {
        if let Ok((metrics, topology_violations)) = manifest_parser.compute_workspace_martin_metrics(options.path) {
            martin_metrics = metrics;
            for tv in topology_violations {
                let mut exists = false;
                for existing in &scan_result.violations {
                    if existing.fingerprint == tv.fingerprint {
                        exists = true;
                        break;
                    }
                }
                if !exists {
                    scan_result.violations.push(tv);
                }
            }
        }
    }

    // Blast Radius & God Object Fan-In Analysis (ARCH-040)
    let scanned_source_files = scanner.scan_files(options.path, scope);
    let all_paths: Vec<PathBuf> = scanned_source_files.iter().map(|f| f.path.clone()).collect();
    let mut file_imports_map: std::collections::HashMap<PathBuf, std::collections::HashSet<String>> = std::collections::HashMap::new();
    for sf in &scanned_source_files {
        if sf.path.extension().is_some_and(|e| e == "rs") {
            if let Ok(code) = std::fs::read_to_string(&sf.path) {
                if let Ok(parsed) = syn::parse_file(&code) {
                    let mut imports = std::collections::HashSet::new();
                    for item in &parsed.items {
                        if let syn::Item::Use(item_use) = item {
                            let use_str = quote::quote!(#item_use).to_string();
                            for segment in use_str.split_whitespace() {
                                if !segment.is_empty() && segment != "use" && segment != "pub" && segment != "crate" && segment != "::" && segment != ";" {
                                    imports.insert(segment.trim_matches(';').to_string());
                                }
                            }
                        }
                    }
                    file_imports_map.insert(sf.path.clone(), imports);
                }
            }
        }
    }
    let blast_violations = cargo_cerberus::infrastructure::BlastRadiusAnalyzer::analyze_blast_radius(&all_paths, &file_imports_map);
    for bv in blast_violations {
        let mut exists = false;
        for existing in &scan_result.violations {
            if existing.fingerprint == bv.fingerprint {
                exists = true;
                break;
            }
        }
        if !exists {
            scan_result.violations.push(bv);
        }
    }

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
    ConsoleReportAdapter::print_martin_metrics(&martin_metrics);

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
            return Err("Violations found with severity Deny".into());
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_main_function_entrypoint() {
        std::env::set_var("CERBERUS_TEST_MAIN", "1");
        main();
        std::env::remove_var("CERBERUS_TEST_MAIN");
    }

    #[test]
    fn test_run_app_all_subcommands() {
        let temp = tempdir().unwrap();
        let src_dir = temp.path().join("src");
        std::fs::create_dir_all(&src_dir).unwrap();
        std::fs::write(src_dir.join("lib.rs"), "pub fn ok() {}").unwrap();

        let all_rules = cargo_cerberus::domain::BuiltinRuleRegistry::all_rules();
        let valid_rules_config = cargo_cerberus::domain::RulesConfig {
            schema: None,
            version: "1.0".to_string(),
            ignore: Vec::new(),
            rules: all_rules,
        };
        let valid_rules_json = serde_json::to_string(&valid_rules_config).unwrap();
        let valid_rules_file = temp.path().join("valid_rules.json");
        std::fs::write(&valid_rules_file, valid_rules_json).unwrap();

        let rules_file = temp.path().join("rules.json");
        std::fs::write(&rules_file, "{\"version\": \"1.0\", \"rules\": []}").unwrap();

        // 1. Validate rules success and failure
        assert!(run_app(Cli {
            rules_path: Some(valid_rules_file),
            validate_rules: true,
            command: None,
        }).is_ok());

        assert!(run_app(Cli {
            rules_path: Some(rules_file.clone()),
            validate_rules: true,
            command: None,
        }).is_err());

        // 2. Check command on clean temp directory and default check command on workspace
        assert!(run_app(Cli {
            rules_path: Some(rules_file.clone()),
            validate_rules: false,
            command: Some(Commands::Check {
                path: temp.path().to_path_buf(),
                sarif: None,
                json: None,
                expanded: false,
                ci: false,
                frontend_only: false,
                backend_only: false,
            }),
        }).is_ok());

        assert!(run_app(Cli {
            rules_path: Some(rules_file.clone()),
            validate_rules: false,
            command: None,
        }).is_err());

        // 3. Init command (with and without hooks)
        assert!(run_app(Cli {
            rules_path: Some(rules_file.clone()),
            validate_rules: false,
            command: Some(Commands::Init {
                hooks: false,
                models: false,
            }),
        }).is_ok());

        assert!(run_app(Cli {
            rules_path: Some(rules_file.clone()),
            validate_rules: false,
            command: Some(Commands::Init {
                hooks: true,
                models: false,
            }),
        }).is_ok());

        // 3.1. Model Status, Clean, and Download commands
        assert!(run_app(Cli {
            rules_path: Some(rules_file.clone()),
            validate_rules: false,
            command: Some(Commands::Model {
                action: ModelCommands::Status,
            }),
        }).is_ok());

        assert!(run_app(Cli {
            rules_path: Some(rules_file.clone()),
            validate_rules: false,
            command: Some(Commands::Model {
                action: ModelCommands::Clean,
            }),
        }).is_ok());

        // 4. Explain command
        assert!(run_app(Cli {
            rules_path: Some(rules_file.clone()),
            validate_rules: false,
            command: Some(Commands::Explain {
                path: temp.path().to_path_buf(),
                clusters: true,
            }),
        }).is_ok());

        // 5. Baseline Reconcile command
        let baseline_file = temp.path().join("guardian-baseline.json");
        std::fs::write(&baseline_file, "[]").unwrap();
        assert!(run_app(Cli {
            rules_path: Some(rules_file.clone()),
            validate_rules: false,
            command: Some(Commands::Baseline {
                action: BaselineCommands::Reconcile {
                    file: baseline_file,
                },
            }),
        }).is_ok());

        // 6. Ledger Sign & Verify commands
        assert!(run_app(Cli {
            rules_path: Some(rules_file.clone()),
            validate_rules: false,
            command: Some(Commands::Ledger {
                action: LedgerCommands::Sign {
                    rule: "ARCH-001".into(),
                    fingerprint: "fp123".into(),
                    reason: "test".into(),
                    author: "Alice".into(),
                    duration: "30d".into(),
                },
            }),
        }).is_ok());

        let ledger_file = temp.path().join("guardian-ledger.lock");
        std::fs::write(&ledger_file, "[]").unwrap();
        assert!(run_app(Cli {
            rules_path: Some(rules_file.clone()),
            validate_rules: false,
            command: Some(Commands::Ledger {
                action: LedgerCommands::Verify {
                    file: ledger_file.clone(),
                },
            }),
        }).is_ok());

        let old_key_file = temp.path().join("old.key");
        std::fs::write(&old_key_file, "11".repeat(32)).unwrap();
        assert!(run_app(Cli {
            rules_path: Some(rules_file.clone()),
            validate_rules: false,
            command: Some(Commands::Ledger {
                action: LedgerCommands::ReSign {
                    all: true,
                    file: ledger_file,
                    old_key_path: Some(old_key_file),
                    new_key_path: None,
                    force: true,
                },
            }),
        }).is_ok());

        // 7. Check command with invalid rules path (error path)
        assert!(run_app(Cli {
            rules_path: Some(temp.path().join("non_existent_rules.json")),
            validate_rules: false,
            command: None,
        }).is_err());
    }

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

        assert!(run_check(CheckExecutionOptions {
            rules_repo: rules_repo.clone(),
            path: temp.path(),
            sarif_path: Some(&sarif_dir),
            json_path: Some(&json_dir),
            expanded: true,
            ci: false,
            frontend_only: false,
            backend_only: false,
        }).is_ok());

        // Test frontend_only and backend_only scopes
        assert!(run_check(CheckExecutionOptions {
            rules_repo: rules_repo.clone(),
            path: temp.path(),
            sarif_path: None,
            json_path: None,
            expanded: false,
            ci: true,
            frontend_only: true,
            backend_only: false,
        }).is_ok());

        assert!(run_check(CheckExecutionOptions {
            rules_repo: rules_repo.clone(),
            path: temp.path(),
            sarif_path: None,
            json_path: None,
            expanded: false,
            ci: false,
            frontend_only: false,
            backend_only: true,
        }).is_ok());

        // Test parse error limit in CI mode
        let broken_temp = tempdir().unwrap();
        let broken_dir = broken_temp.path().join("broken_src");
        std::fs::create_dir_all(&broken_dir).unwrap();
        std::fs::write(broken_dir.join("broken.rs"), "fn broken( {").unwrap();

        assert!(run_check(CheckExecutionOptions {
            rules_repo,
            path: &broken_dir,
            sarif_path: None,
            json_path: None,
            expanded: false,
            ci: true,
            frontend_only: false,
            backend_only: true,
        }).is_err());
    }
}
