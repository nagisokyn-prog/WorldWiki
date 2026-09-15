use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Suppression {
    pub rule_id: String,
    pub fingerprint: String,
    pub reason: String,
    pub author: String,
    pub expires: DateTime<Utc>,
    pub signature: String,
}

impl Suppression {
    pub fn is_expired(&self) -> bool {
        Utc::now() > self.expires
    }

    pub fn canonical_payload(&self) -> String {
        format!(
            "{}:{}:{}:{}:{}",
            self.rule_id,
            self.fingerprint,
            self.reason,
            self.author,
            self.expires.to_rfc3339()
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_suppression_expiration_and_payload() {
        let future = Utc::now() + chrono::Duration::days(10);
        let s = Suppression {
            rule_id: "ARCH-001".into(),
            fingerprint: "fp123".into(),
            reason: "temporary".into(),
            author: "alice".into(),
            expires: future,
            signature: "sig".into(),
        };

        assert!(!s.is_expired());
        let payload = s.canonical_payload();
        assert!(payload.starts_with("ARCH-001:fp123:temporary:alice:"));

        let past = Utc::now() - chrono::Duration::days(1);
        let expired_s = Suppression {
            rule_id: "ARCH-001".into(),
            fingerprint: "fp123".into(),
            reason: "temporary".into(),
            author: "alice".into(),
            expires: past,
            signature: "sig".into(),
        };
        assert!(expired_s.is_expired());
    }
}

