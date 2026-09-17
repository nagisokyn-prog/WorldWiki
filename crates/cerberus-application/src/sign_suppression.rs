use cerberus_domain::Suppression;
use cerberus_ports::KeyStoragePort;
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
        let mut mac = match HmacSha256::new_from_slice(&key) {
            Ok(m) => m,
            Err(_) => return Err("Invalid HMAC key".into()),
        };

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

pub fn hex_decode(s: &str) -> Result<Vec<u8>, String> {
    let bytes = s.as_bytes();
    if !bytes.len().is_multiple_of(2) {
        return Err("Odd length hex string".into());
    }

    let mut result = Vec::with_capacity(bytes.len() / 2);
    for chunk in bytes.chunks_exact(2) {
        if let [hi_b, lo_b] = chunk {
            let hi = decode_hex_nibble(*hi_b)?;
            let lo = decode_hex_nibble(*lo_b)?;
            result.push((hi << 4) | lo);
        }
    }
    Ok(result)
}

fn decode_hex_nibble(b: u8) -> Result<u8, String> {
    match b {
        b'0'..=b'9' => Ok(b - b'0'),
        b'a'..=b'f' => Ok(b - b'a' + 10),
        b'A'..=b'F' => Ok(b - b'A' + 10),
        _ => Err("Invalid hex character".into()),
    }
}
