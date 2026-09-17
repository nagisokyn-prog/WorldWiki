use std::process::exit;

pub mod app_runner;
pub mod cli;

pub use app_runner::{run_app, run_check, CheckExecutionOptions};
pub use cli::{parse_cli, parse_cli_from, Cli, Commands};

fn main() {
    let cli = parse_cli();
    if let Err(e) = run_app(cli) {
        eprintln!("{}", e);
        if std::env::var("CERBERUS_TEST_MAIN").is_err() {
            exit(1);
        }
    }
}
