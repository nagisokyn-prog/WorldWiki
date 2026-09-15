use crate::domain::suppression::Suppression;
use crate::ports::storage::KeyStoragePort;
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
    if s.len() % 2 != 0 {
        return Err("Odd length hex string".into());
    }
    (0..s.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&s[i..i + 2], 16).map_err(|e| e.to_string()))
        .collect()
}
