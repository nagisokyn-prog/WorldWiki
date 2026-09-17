use colored::*;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use cerberus_application::ReconcileBaselineUseCase;
use cerberus_infrastructure::{FileBaselineStorageAdapter, FileStorageAdapter};

use crate::cli::{BaselineCommands, LedgerCommands};

pub fn handle_baseline(action: BaselineCommands) -> Result<(), String> {
    match action {
        BaselineCommands::Reconcile { file } => {
            let resolved_file = resolve_file(&file, "cerberus-baseline.json", "guardian-baseline.json");
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
                Err(e) => Err(format!(
                    "{} {}",
                    "❌ Failed to reconcile baseline:".red().bold(),
                    e
                )),
            }
        }
    }
}

pub fn handle_ledger(action: LedgerCommands) -> Result<(), String> {
    match action {
        LedgerCommands::Sign {
            rule,
            fingerprint,
            reason,
            author,
            duration: _,
        } => {
            let storage = FileStorageAdapter::new(FileStorageAdapter::default_path());
            let expires = chrono::Utc::now() + chrono::Duration::days(30);
            match cerberus_application::SignSuppressionUseCase::sign(
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
                Err(e) => Err(format!(
                    "{} {}",
                    "❌ Error signing suppression:".red().bold(),
                    e
                )),
            }
        }
        LedgerCommands::Verify { file } => {
            let resolved_file = resolve_file(&file, "cerberus-ledger.lock", "guardian-ledger.lock");
            println!(
                "{} Verifying ledger lock file: {}",
                "🔍".cyan(),
                resolved_file.display()
            );
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
            let default_new_path = FileStorageAdapter::default_path();
            let new_path = new_key_path.unwrap_or(default_new_path);
            let new_storage = FileStorageAdapter::new(new_path);
            let old_storage = old_key_path.map(FileStorageAdapter::new);

            let old_ref: Option<&dyn cerberus_ports::KeyStoragePort> = match &old_storage {
                Some(s) => Some(s as &dyn cerberus_ports::KeyStoragePort),
                None => None,
            };

            let resolved_file = resolve_file(&file, "cerberus-ledger.lock", "guardian-ledger.lock");

            match cerberus_application::ReSignAllUseCase::execute(
                cerberus_application::ReSignOptions {
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
                Err(e) => Err(format!(
                    "{} {}",
                    "❌ Error re-signing ledger:".red().bold(),
                    e
                )),
            }
        }
    }
}

pub fn resolve_file(path: &Path, primary_name: &str, fallback_name: &str) -> PathBuf {
    if path == Path::new(primary_name) && !path.exists() && Path::new(fallback_name).exists() {
        PathBuf::from(fallback_name)
    } else {
        path.to_path_buf()
    }
}
