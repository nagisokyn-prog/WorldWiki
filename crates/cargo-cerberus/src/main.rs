use cargo_cerberus::cli::{parse_cli, run_app};
use std::process::exit;

fn main() {
    let cli = parse_cli();
    if let Err(e) = run_app(cli) {
        eprintln!("{}", e);
        if std::env::var("CERBERUS_TEST_MAIN").is_err() {
            exit(1);
        }
    }
}
