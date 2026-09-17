use clap::{Parser, Subcommand};
use std::path::PathBuf;

use crate::commands::{execute_command, validate_rules_registry};

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
    /// Render hierarchical architectural pressure and metrics tree (Martin metrics + AST 4-tuples)
    Tree {
        #[arg(short, long, default_value = ".", help = "Target root directory to scan and render")]
        path: PathBuf,
        #[arg(long, help = "Path to export JSON tree report")]
        json: Option<PathBuf>,
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
    /// Calculate Testability Index (T-Score) and identify structural test friction
    Testability {
        #[arg(short, long, default_value = ".", help = "Target root directory to scan")]
        path: PathBuf,
        #[arg(long, help = "Path to export JSON testability report")]
        json: Option<PathBuf>,
        #[arg(long, help = "Minimum acceptable testability score threshold (0-100)")]
        threshold: Option<f64>,
        #[arg(long, help = "Run calibration suite against synthetic anchors")]
        calibrate: bool,
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

pub fn parse_cli() -> Cli {
    parse_cli_from(std::env::args())
}

pub fn parse_cli_from<I, T>(args: I) -> Cli
where
    I: IntoIterator<Item = T>,
    T: Into<std::ffi::OsString> + Clone,
{
    let mut args_vec: Vec<String> = args
        .into_iter()
        .map(|a| a.into().to_string_lossy().to_string())
        .collect();
    if let Some(first) = args_vec.get(1) {
        if first == "cerberus" {
            args_vec.remove(1);
        }
    }
    Cli::try_parse_from(args_vec).unwrap_or(Cli {
        rules_path: None,
        validate_rules: false,
        command: None,
    })
}

pub fn run_app(cli: Cli) -> Result<(), String> {
    if cli.validate_rules {
        return validate_rules_registry(cli.rules_path.as_ref());
    }

    let default_command = Commands::Check {
        path: PathBuf::from("."),
        sarif: None,
        json: None,
        expanded: false,
        ci: false,
        frontend_only: false,
        backend_only: false,
    };

    execute_command(cli.command.unwrap_or(default_command), cli.rules_path.as_ref())
}
