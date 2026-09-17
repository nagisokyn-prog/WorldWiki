use clap::{Parser, Subcommand};
use std::path::PathBuf;

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

    /// Render hierarchical architectural pressure and metrics tree (Martin metrics + AST 4-tuples)
    Tree {
        #[arg(short, long, default_value = ".", help = "Target root directory to scan and render")]
        path: PathBuf,
        #[arg(long, help = "Path to export JSON tree report")]
        json: Option<PathBuf>,
    },

    /// Initialize cerberus.json configuration with frontend presets
    Init {
        #[arg(long, help = "Force overwrite if cerberus.json already exists")]
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
        if first == "cerberus-sfc" {
            args_vec.remove(1);
        }
    }
    Cli::try_parse_from(args_vec).unwrap_or(Cli {
        rules_path: None,
        validate_rules: false,
        command: None,
    })
}
