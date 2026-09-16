use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum Category {
    Architecture,
    Security,
    Robustness,
    Convention,
    Performance,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum Severity {
    Deny,
    Warn,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuleDefinition {
    pub id: String,
    pub version: String,
    pub category: Category,
    pub severity: Severity,
    pub title: String,
    pub description: String,
    pub remediation: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RulesConfig {
    #[serde(rename = "$schema", default)]
    pub schema: Option<String>,
    pub version: String,
    pub rules: Vec<RuleDefinition>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Violation {
    pub rule_id: String,
    pub rule_version: String,
    pub category: Category,
    pub severity: Severity,
    pub file: PathBuf,
    pub line: usize,
    pub column: usize,
    pub symbol: String,
    pub snippet: String,
    pub message: String,
    pub remediation: String,
    pub fingerprint: String,
}

pub fn compute_fingerprint(
    rule_id: &str,
    rule_version: &str,
    symbol: &str,
    snippet: &str,
) -> String {
    let mut hasher = Sha256::new();
    hasher.update(rule_id.as_bytes());
    hasher.update(b":");
    hasher.update(rule_version.as_bytes());
    hasher.update(b":");
    hasher.update(symbol.as_bytes());
    hasher.update(b":");
    let normalized = snippet.split_whitespace().collect::<Vec<_>>().join(" ");
    hasher.update(normalized.as_bytes());
    let hash_bytes = hasher.finalize();
    hash_bytes.iter().map(|b| format!("{:02x}", b)).collect()
}
