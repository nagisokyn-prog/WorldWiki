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
        if let Err(e) = std::fs::write(options.lock_file, serialized) {
            return Err(format!("Failed to write updated ledger lock file: {}", e));
        }

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

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    struct DummyKeyStorage(std::sync::Mutex<Vec<u8>>);
    impl DummyKeyStorage {
        fn new(key: Vec<u8>) -> Self {
            Self(std::sync::Mutex::new(key))
        }
    }
    impl KeyStoragePort for DummyKeyStorage {
        fn get_key(&self) -> Result<Vec<u8>, String> {
            Ok(self.0.lock().unwrap().clone())
        }
        fn set_key(&self, key: &[u8]) -> Result<(), String> {
            *self.0.lock().unwrap() = key.to_vec();
            Ok(())
        }
    }

    #[test]
    fn test_re_sign_all_use_case() {
        let temp = tempdir().unwrap();
        let lock_file = temp.path().join("suppressions.lock");

        let old_storage = DummyKeyStorage::new(vec![1u8; 32]);
        let new_storage = DummyKeyStorage::new(vec![2u8; 32]);

        let expires = chrono::Utc::now() + chrono::Duration::days(30);
        let sig = SignSuppressionUseCase::sign(&old_storage, "ARCH-001", "fp1", "reason", "author", &expires).unwrap();

        let initial_supp = vec![Suppression {
            rule_id: "ARCH-001".into(),
            fingerprint: "fp1".into(),
            reason: "reason".into(),
            author: "author".into(),
            expires,
            signature: sig,
        }];

        std::fs::write(&lock_file, serde_json::to_string_pretty(&initial_supp).unwrap()).unwrap();

        let count = ReSignAllUseCase::execute(ReSignOptions {
            lock_file: &lock_file,
            old_storage: Some(&old_storage),
            new_storage: &new_storage,
            force: false,
        }).unwrap();

        assert_eq!(count, 1);

        // Verify with new storage
        let updated_content = std::fs::read_to_string(&lock_file).unwrap();
        let updated: Vec<Suppression> = serde_json::from_str(&updated_content).unwrap();
        assert!(SignSuppressionUseCase::verify(&new_storage, &updated[0]));

        // Force re-sign without old storage
        let count2 = ReSignAllUseCase::execute(ReSignOptions {
            lock_file: &lock_file,
            old_storage: None,
            new_storage: &old_storage,
            force: true,
        }).unwrap();
        assert_eq!(count2, 1);

        // Test format with {"suppressions": [...]}
        let wrapper_json = serde_json::json!({
            "suppressions": initial_supp
        });
        std::fs::write(&lock_file, serde_json::to_string_pretty(&wrapper_json).unwrap()).unwrap();
        let count3 = ReSignAllUseCase::execute(ReSignOptions {
            lock_file: &lock_file,
            old_storage: Some(&old_storage),
            new_storage: &new_storage,
            force: false,
        }).unwrap();
        assert_eq!(count3, 1);

        // Non-existent lock file
        assert!(ReSignAllUseCase::execute(ReSignOptions {
            lock_file: Path::new("non_existent_lock_404.lock"),
            old_storage: None,
            new_storage: &new_storage,
            force: true,
        }).is_err());

        // Corrupted JSON
        std::fs::write(&lock_file, "invalid json content").unwrap();
        assert!(ReSignAllUseCase::execute(ReSignOptions {
            lock_file: &lock_file,
            old_storage: None,
            new_storage: &new_storage,
            force: true,
        }).is_err());

        // Invalid signature without force
        let invalid_supp = vec![Suppression {
            rule_id: "ARCH-001".into(),
            fingerprint: "fp1".into(),
            reason: "reason".into(),
            author: "author".into(),
            expires,
            signature: "invalid_sig".into(),
        }];
        std::fs::write(&lock_file, serde_json::to_string_pretty(&invalid_supp).unwrap()).unwrap();
        assert!(ReSignAllUseCase::execute(ReSignOptions {
            lock_file: &lock_file,
            old_storage: Some(&old_storage),
            new_storage: &new_storage,
            force: false,
        }).is_err());

        // Missing old storage without force
        assert!(ReSignAllUseCase::execute(ReSignOptions {
            lock_file: &lock_file,
            old_storage: None,
            new_storage: &new_storage,
            force: false,
        }).is_err());

        // Call set_key for full coverage
        assert!(old_storage.set_key(&[9u8; 32]).is_ok());
    }
}
