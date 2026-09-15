use arch_guard_domain::Suppression;
use arch_guard_ports::KeyStoragePort;
use chrono::{DateTime, Utc};
use hmac::{Hmac, KeyInit, Mac};
use sha2::Sha256;

type HmacSha256 = Hmac<Sha256>;

pub struct SignSuppressionUseCase;

impl SignSuppressionUseCase {
    pub fn sign(
        storage: &dyn KeyStoragePort,
        rule_id: &str,
        fingerprint: &str,
        reason: &str,
        author: &str,
        expires: &DateTime<Utc>,
    ) -> Result<String, String> {
        let key = storage.get_key()?;
        let mut mac = HmacSha256::new_from_slice(&key)
            .map_err(|e| format!("Invalid HMAC key: {}", e))?;

        let expires_str = expires.to_rfc3339();
        let payload = format!("{}:{}:{}:{}:{}", rule_id, fingerprint, reason, author, expires_str);
        mac.update(payload.as_bytes());
        let result = mac.finalize();
        let bytes = result.into_bytes();
        Ok(bytes.iter().map(|b| format!("{:02x}", b)).collect())
    }

    pub fn verify(storage: &dyn KeyStoragePort, suppression: &Suppression) -> bool {
        if suppression.is_expired() {
            return false;
        }

        let key = match storage.get_key() {
            Ok(k) => k,
            Err(_) => return false,
        };

        let mut mac = match HmacSha256::new_from_slice(&key) {
            Ok(m) => m,
            Err(_) => return false,
        };

        let payload = suppression.canonical_payload();
        mac.update(payload.as_bytes());

        let expected_bytes = match hex_decode(&suppression.signature) {
            Ok(b) => b,
            Err(_) => return false,
        };

        mac.verify_slice(&expected_bytes).is_ok()
    }
}

fn hex_decode(s: &str) -> Result<Vec<u8>, String> {
    if !s.len().is_multiple_of(2) {
        return Err("Odd length hex string".into());
    }

    (0..s.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&s[i..i + 2], 16).map_err(|e| e.to_string()))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

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
            expires: expires.to_rfc3339(),
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
            expires: past.to_rfc3339(),
            signature: "001122".into(),
        };
        assert!(!SignSuppressionUseCase::verify(&storage, &supp_expired));

        let supp_corrupted = Suppression {
            rule_id: "ARCH-001".into(),
            fingerprint: "fp123".into(),
            reason: "Valid".into(),
            author: "Alice".into(),
            expires: (Utc::now() + chrono::Duration::days(10)).to_rfc3339(),
            signature: "invalid_hex".into(),
        };
        assert!(!SignSuppressionUseCase::verify(&storage, &supp_corrupted));
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
}

