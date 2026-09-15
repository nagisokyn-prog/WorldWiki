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
