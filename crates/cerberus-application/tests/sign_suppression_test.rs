use cerberus_application::{hex_decode, SignSuppressionUseCase};
use cerberus_domain::Suppression;
use cerberus_ports::KeyStoragePort;
use chrono::Utc;

struct MockKey(Result<Vec<u8>, String>);
impl KeyStoragePort for MockKey {
    fn get_key(&self) -> Result<Vec<u8>, String> {
        self.0.clone()
    }
    fn set_key(&self, _key: &[u8]) -> Result<(), String> {
        Ok(())
    }
}

#[test]
fn test_mock_key_set_key() {
    let storage = MockKey(Ok(vec![0x42; 32]));
    assert!(storage.set_key(&[0x11, 0x22]).is_ok());
}

#[test]
fn test_sign_and_verify_success() {
    let storage = MockKey(Ok(vec![0x42; 32]));
    let expires = Utc::now() + chrono::Duration::days(10);
    let sig = SignSuppressionUseCase::sign(
        &storage,
        "ARCH-001",
        "fp123",
        "Temporary refactor",
        "Alice",
        &expires,
    )
    .unwrap();

    let supp = Suppression {
        rule_id: "ARCH-001".into(),
        fingerprint: "fp123".into(),
        reason: "Temporary refactor".into(),
        author: "Alice".into(),
        expires,
        signature: sig,
    };

    assert!(SignSuppressionUseCase::verify(&storage, &supp));
}

#[test]
fn test_verify_expired_or_corrupted() {
    let storage = MockKey(Ok(vec![0x42; 32]));
    let past = Utc::now() - chrono::Duration::days(10);
    let supp_expired = Suppression {
        rule_id: "ARCH-001".into(),
        fingerprint: "fp123".into(),
        reason: "Old".into(),
        author: "Alice".into(),
        expires: past,
        signature: "001122".into(),
    };
    assert!(!SignSuppressionUseCase::verify(&storage, &supp_expired));

    let supp_corrupted = Suppression {
        rule_id: "ARCH-001".into(),
        fingerprint: "fp123".into(),
        reason: "Valid".into(),
        author: "Alice".into(),
        expires: Utc::now() + chrono::Duration::days(10),
        signature: "invalid_hex".into(),
    };
    assert!(!SignSuppressionUseCase::verify(&storage, &supp_corrupted));

    let supp_invalid_chars = Suppression {
        rule_id: "ARCH-001".into(),
        fingerprint: "fp123".into(),
        reason: "Valid".into(),
        author: "Alice".into(),
        expires: Utc::now() + chrono::Duration::days(10),
        signature: "zzzz".into(),
    };
    assert!(!SignSuppressionUseCase::verify(&storage, &supp_invalid_chars));

    let supp_wrong_sig = Suppression {
        rule_id: "ARCH-001".into(),
        fingerprint: "fp123".into(),
        reason: "Valid".into(),
        author: "Alice".into(),
        expires: Utc::now() + chrono::Duration::days(10),
        signature: "00".repeat(32),
    };
    assert!(!SignSuppressionUseCase::verify(&storage, &supp_wrong_sig));
}

#[test]
fn test_verify_storage_error() {
    let storage = MockKey(Err("Storage read failure".into()));
    let supp = Suppression {
        rule_id: "ARCH-001".into(),
        fingerprint: "fp123".into(),
        reason: "Valid".into(),
        author: "Alice".into(),
        expires: Utc::now() + chrono::Duration::days(10),
        signature: "aabbcc".into(),
    };
    assert!(!SignSuppressionUseCase::verify(&storage, &supp));
}

#[test]
fn test_sign_with_storage_error() {
    let storage = MockKey(Err("Storage unavailable".into()));
    let expires = Utc::now() + chrono::Duration::days(10);
    let res = SignSuppressionUseCase::sign(
        &storage,
        "ARCH-001",
        "fp",
        "reason",
        "Alice",
        &expires,
    );
    assert!(res.is_err());
}

#[test]
fn test_hex_decode_branches() {
    assert_eq!(hex_decode("0123456789abcdef").unwrap(), vec![0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef]);
    assert_eq!(hex_decode("ABCDEF").unwrap(), vec![0xab, 0xcd, 0xef]);
    assert_eq!(hex_decode("").unwrap(), Vec::<u8>::new());
    assert!(hex_decode("1").is_err());
    assert!(hex_decode("gh").is_err());
}
