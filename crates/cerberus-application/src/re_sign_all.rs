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

        let content = match std::fs::read_to_string(options.lock_file) {
            Ok(c) => c,
            Err(e) => return Err(format!("Failed to read lock file {}: {}", options.lock_file.display(), e)),
        };

        let mut suppressions: Vec<Suppression> = match serde_json::from_str::<Vec<Suppression>>(&content) {
            Ok(list) => list,
            Err(_) => {
                match serde_json::from_str::<serde_json::Value>(&content) {
                    Ok(val) => {
                        match val.get("suppressions") {
                            Some(arr) => match serde_json::from_value::<Vec<Suppression>>(arr.clone()) {
                                Ok(list) => list,
                                Err(_) => return Err("Failed to parse ledger lock file format".to_string()),
                            },
                            None => return Err("Failed to parse ledger lock file format".to_string()),
                        }
                    }
                    Err(_) => return Err("Failed to parse ledger lock file format".to_string()),
                }
            }
        };

        let mut re_signed_count = 0;
        for item in &mut suppressions {
            if !options.force {
                let old_storage = match options.old_storage {
                    Some(s) => s,
                    None => return Err("Old key storage required unless --force is specified".to_string()),
                };
                if !SignSuppressionUseCase::verify(old_storage, item) {
                    return Err(format!(
                        "Cannot re-sign: existing signature for rule {} (fingerprint {}) is invalid",
                        item.rule_id, item.fingerprint
                    ));
                }
            }

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
        match std::fs::write(options.lock_file, serialized) {
            Ok(_) => Ok(re_signed_count),
            Err(e) => Err(format!("Failed to write updated ledger lock file: {}", e)),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    use tempfile::tempdir;

    struct TestKey(Result<Vec<u8>, String>);
    impl KeyStoragePort for TestKey {
        fn get_key(&self) -> Result<Vec<u8>, String> {
            self.0.clone()
        }
        fn set_key(&self, _key: &[u8]) -> Result<(), String> {
            Ok(())
        }
    }

    #[test]
    fn test_re_sign_all_success_and_force() {
        let temp = tempdir().unwrap();
        let lock_file = temp.path().join("guardian-ledger.lock");

        let old_key = TestKey(Ok(vec![0x11u8; 32]));
        let _ = old_key.set_key(&[0x11; 32]);
        let new_key = TestKey(Ok(vec![0x22u8; 32]));

        let expires = Utc::now() + chrono::Duration::days(15);
        let sig = SignSuppressionUseCase::sign(&old_key, "ARCH-001", "fp1", "Reason", "Alice", &expires).unwrap();

        let initial_supp = vec![Suppression {
            rule_id: "ARCH-001".into(),
            fingerprint: "fp1".into(),
            reason: "Reason".into(),
            author: "Alice".into(),
            expires,
            signature: sig,
        }];

        std::fs::write(&lock_file, serde_json::to_string_pretty(&initial_supp).unwrap()).unwrap();

        // 1. Normal re-sign with old key validation
        let count = ReSignAllUseCase::execute(ReSignOptions {
            lock_file: &lock_file,
            old_storage: Some(&old_key),
            new_storage: &new_key,
            force: false,
        }).unwrap();
        assert_eq!(count, 1);

        // Verify with new key
        let content = std::fs::read_to_string(&lock_file).unwrap();
        let updated: Vec<Suppression> = serde_json::from_str(&content).unwrap();
        assert!(SignSuppressionUseCase::verify(&new_key, &updated[0]));

        // 2. Force re-sign without old key
        let third_key = TestKey(Ok(vec![0x33u8; 32]));
        let force_count = ReSignAllUseCase::execute(ReSignOptions {
            lock_file: &lock_file,
            old_storage: None,
            new_storage: &third_key,
            force: true,
        }).unwrap();
        assert_eq!(force_count, 1);
    }

    #[test]
    fn test_re_sign_all_errors_and_edge_cases() {
        let temp = tempdir().unwrap();
        let non_existent = temp.path().join("missing.lock");
        let new_key = TestKey(Ok(vec![0x22u8; 32]));

        // Missing file
        assert!(ReSignAllUseCase::execute(ReSignOptions {
            lock_file: &non_existent,
            old_storage: None,
            new_storage: &new_key,
            force: true,
        }).is_err());

        // Corrupt file
        let corrupt_file = temp.path().join("corrupt.lock");
        std::fs::write(&corrupt_file, "not-json").unwrap();
        assert!(ReSignAllUseCase::execute(ReSignOptions {
            lock_file: &corrupt_file,
            old_storage: None,
            new_storage: &new_key,
            force: true,
        }).is_err());

        // Missing old key when force is false and non-empty items
        let single_file = temp.path().join("single.lock");
        let expires = Utc::now() + chrono::Duration::days(10);
        let single_supp = vec![Suppression {
            rule_id: "ARCH-001".into(),
            fingerprint: "fp1".into(),
            reason: "Reason".into(),
            author: "Alice".into(),
            expires,
            signature: "sig".into(),
        }];
        std::fs::write(&single_file, serde_json::to_string_pretty(&single_supp).unwrap()).unwrap();
        assert!(ReSignAllUseCase::execute(ReSignOptions {
            lock_file: &single_file,
            old_storage: None,
            new_storage: &new_key,
            force: false,
        }).is_err());

        // Empty file without old key returns Ok(0)
        let valid_file = temp.path().join("valid.lock");
        std::fs::write(&valid_file, "[]").unwrap();
        assert!(ReSignAllUseCase::execute(ReSignOptions {
            lock_file: &valid_file,
            old_storage: None,
            new_storage: &new_key,
            force: false,
        }).is_ok());

        // Invalid old signature error
        let bad_sig_file = temp.path().join("bad_sig.lock");
        std::fs::write(&bad_sig_file, serde_json::to_string_pretty(&single_supp).unwrap()).unwrap();
        let old_key = TestKey(Ok(vec![0x11u8; 32]));
        assert!(ReSignAllUseCase::execute(ReSignOptions {
            lock_file: &bad_sig_file,
            old_storage: Some(&old_key),
            new_storage: &new_key,
            force: false,
        }).is_err());

        // Wrapper format parsing (valid)
        let wrapper_file = temp.path().join("wrapper.lock");
        std::fs::write(&wrapper_file, "{\"suppressions\": []}").unwrap();
        assert!(ReSignAllUseCase::execute(ReSignOptions {
            lock_file: &wrapper_file,
            old_storage: None,
            new_storage: &new_key,
            force: true,
        }).is_ok());

        // Wrapper format with missing/invalid suppressions
        let bad_wrapper1 = temp.path().join("bad_wrapper1.lock");
        std::fs::write(&bad_wrapper1, "{\"foo\": 123}").unwrap();
        assert!(ReSignAllUseCase::execute(ReSignOptions {
            lock_file: &bad_wrapper1,
            old_storage: None,
            new_storage: &new_key,
            force: true,
        }).is_err());

        let bad_wrapper2 = temp.path().join("bad_wrapper2.lock");
        std::fs::write(&bad_wrapper2, "{\"suppressions\": \"invalid_type\"}").unwrap();
        assert!(ReSignAllUseCase::execute(ReSignOptions {
            lock_file: &bad_wrapper2,
            old_storage: None,
            new_storage: &new_key,
            force: true,
        }).is_err());

        // Write error (target is a directory)
        let dir_target = temp.path().join("dir_target");
        std::fs::create_dir_all(&dir_target).unwrap();
        assert!(ReSignAllUseCase::execute(ReSignOptions {
            lock_file: &dir_target,
            old_storage: None,
            new_storage: &new_key,
            force: true,
        }).is_err());
    }
}
