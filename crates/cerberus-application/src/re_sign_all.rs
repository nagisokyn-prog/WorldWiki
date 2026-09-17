use cerberus_domain::Suppression;
use cerberus_ports::KeyStoragePort;
use crate::sign_suppression::SignSuppressionUseCase;
use std::path::Path;

pub struct ReSignOptions<'a> {
    pub lock_file: &'a Path,
    pub old_storage: Option<&'a dyn KeyStoragePort>,
    pub new_storage: &'a dyn KeyStoragePort,
    pub force: bool,
}

pub struct ReSignAllUseCase;

impl ReSignAllUseCase {
    pub fn execute(options: ReSignOptions) -> Result<usize, String> {
        if !options.lock_file.exists() {
            return Err(format!("Ledger lock file not found: {}", options.lock_file.display()));
        }

        let content = std::fs::read_to_string(options.lock_file)
            .map_err(|e| format!("Failed to read lock file {}: {}", options.lock_file.display(), e))?;

        let mut suppressions = parse_suppressions(&content)?;
        let mut re_signed_count = 0;

        for item in &mut suppressions {
            validate_old_signature(&options, item)?;

            let new_sig = SignSuppressionUseCase::sign(
                options.new_storage,
                &item.rule_id,
                &item.fingerprint,
                &item.reason,
                &item.author,
                &item.expires,
            )?;

            item.signature = new_sig;
            re_signed_count += 1;
        }

        let serialized = serde_json::to_string_pretty(&suppressions).unwrap_or_default();
        std::fs::write(options.lock_file, serialized)
            .map_err(|e| format!("Failed to write updated ledger lock file: {}", e))?;

        Ok(re_signed_count)
    }
}

fn parse_suppressions(content: &str) -> Result<Vec<Suppression>, String> {
    if let Ok(list) = serde_json::from_str::<Vec<Suppression>>(content) {
        return Ok(list);
    }
    if let Ok(val) = serde_json::from_str::<serde_json::Value>(content) {
        if let Some(arr) = val.get("suppressions") {
            if let Ok(list) = serde_json::from_value::<Vec<Suppression>>(arr.clone()) {
                return Ok(list);
            }
        }
    }
    Err("Failed to parse ledger lock file format".to_string())
}

fn validate_old_signature(options: &ReSignOptions, item: &Suppression) -> Result<(), String> {
    if options.force {
        return Ok(());
    }
    let old_storage = options
        .old_storage
        .ok_or_else(|| "Old key storage required unless --force is specified".to_string())?;

    if !SignSuppressionUseCase::verify(old_storage, item) {
        return Err(format!(
            "Cannot re-sign: existing signature for rule {} (fingerprint {}) is invalid",
            item.rule_id, item.fingerprint
        ));
    }
    Ok(())
}
