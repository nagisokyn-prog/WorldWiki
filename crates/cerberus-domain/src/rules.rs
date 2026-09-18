use serde::de::Visitor;
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fmt;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum Category {
    Architecture,
    Security,
    Robustness,
    Convention,
    Performance,
    Concurrency,
    ErrorHandling,
    Observability,
    DataIntegrity,
    SupplyChain,
    AiDefense,
    Testability,
    Frontend,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Severity {
    Deny,
    Warn,
    Off,
}

impl Serialize for Severity {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        match self {
            Self::Deny => serializer.serialize_str("deny"),
            Self::Warn => serializer.serialize_str("warn"),
            Self::Off => serializer.serialize_str("off"),
        }
    }
}

impl<'de> Deserialize<'de> for Severity {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        struct SeverityVisitor;

        impl<'de> Visitor<'de> for SeverityVisitor {
            type Value = Severity;

            fn expecting(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
                formatter.write_str("a string representing severity ('deny'|'error', 'warn'|'warning', 'off'|'ignore')")
            }

            fn visit_str<E>(self, value: &str) -> Result<Severity, E>
            where
                E: serde::de::Error,
            {
                match value.to_lowercase().as_str() {
                    "deny" | "error" => Ok(Severity::Deny),
                    "warn" | "warning" => Ok(Severity::Warn),
                    "off" | "ignore" => Ok(Severity::Off),
                    _ => Err(E::custom(format!("Unknown severity level: '{}'", value))),
                }
            }
        }

        deserializer.deserialize_str(SeverityVisitor)
    }
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

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RuleOverride {
    #[serde(default)]
    pub files: Vec<String>,
    #[serde(default)]
    pub rules: HashMap<String, Severity>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LimitsConfig {
    #[serde(default = "default_max_sloc_warn")]
    pub max_sloc_warn: usize,
    #[serde(default = "default_max_sloc_deny")]
    pub max_sloc_deny: usize,
    #[serde(default = "default_max_pressure_warn")]
    pub max_pressure_warn: f64,
    #[serde(default = "default_max_pressure_deny")]
    pub max_pressure_deny: f64,
    #[serde(default = "default_max_style_lines")]
    pub max_style_lines: usize,
    #[serde(default = "default_max_script_setup_lines")]
    pub max_script_setup_lines: usize,
}

fn default_max_sloc_warn() -> usize {
    500
}
fn default_max_sloc_deny() -> usize {
    800
}
fn default_max_pressure_warn() -> f64 {
    200.0
}
fn default_max_pressure_deny() -> f64 {
    400.0
}
fn default_max_style_lines() -> usize {
    25
}
fn default_max_script_setup_lines() -> usize {
    35
}

impl Default for LimitsConfig {
    fn default() -> Self {
        Self {
            max_sloc_warn: default_max_sloc_warn(),
            max_sloc_deny: default_max_sloc_deny(),
            max_pressure_warn: default_max_pressure_warn(),
            max_pressure_deny: default_max_pressure_deny(),
            max_style_lines: default_max_style_lines(),
            max_script_setup_lines: default_max_script_setup_lines(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CerberusConfig {
    #[serde(rename = "$schema", default)]
    pub schema: Option<String>,
    #[serde(default = "default_version")]
    pub version: String,
    #[serde(default)]
    pub ignore: Vec<String>,
    #[serde(default)]
    pub extends: Vec<String>,
    #[serde(default)]
    pub limits: LimitsConfig,
    #[serde(default)]
    pub rules: HashMap<String, Severity>,
    #[serde(default)]
    pub overrides: Vec<RuleOverride>,
}

impl Default for CerberusConfig {
    fn default() -> Self {
        Self {
            schema: None,
            version: default_version(),
            ignore: Vec::new(),
            extends: Vec::new(),
            limits: LimitsConfig::default(),
            rules: HashMap::new(),
            overrides: Vec::new(),
        }
    }
}

fn default_version() -> String {
    "1.0".into()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RulesConfig {
    #[serde(rename = "$schema", default)]
    pub schema: Option<String>,
    pub version: String,
    #[serde(default)]
    pub ignore: Vec<String>,
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_severity_serde_and_aliases() {
        let deny_json = "\"deny\"";
        let error_json = "\"error\"";
        let warn_json = "\"warn\"";
        let warning_json = "\"warning\"";
        let off_json = "\"off\"";
        let ignore_json = "\"ignore\"";

        assert_eq!(serde_json::from_str::<Severity>(deny_json).unwrap(), Severity::Deny);
        assert_eq!(serde_json::from_str::<Severity>(error_json).unwrap(), Severity::Deny);
        assert_eq!(serde_json::from_str::<Severity>(warn_json).unwrap(), Severity::Warn);
        assert_eq!(serde_json::from_str::<Severity>(warning_json).unwrap(), Severity::Warn);
        assert_eq!(serde_json::from_str::<Severity>(off_json).unwrap(), Severity::Off);
        assert_eq!(serde_json::from_str::<Severity>(ignore_json).unwrap(), Severity::Off);

        assert!(serde_json::from_str::<Severity>("\"unknown\"").is_err());
        assert!(serde_json::from_str::<Severity>("123").is_err());
        assert!(serde_json::from_str::<Severity>("[]").is_err());
        assert!(serde_json::from_str::<Severity>("{}").is_err());

        let serialized_deny = serde_json::to_string(&Severity::Deny).unwrap();
        assert_eq!(serialized_deny, "\"deny\"");
        let serialized_warn = serde_json::to_string(&Severity::Warn).unwrap();
        assert_eq!(serialized_warn, "\"warn\"");
        let serialized_off = serde_json::to_string(&Severity::Off).unwrap();
        assert_eq!(serialized_off, "\"off\"");
    }

    #[test]
    fn test_cerberus_config_serde() {
        let json = r#"{
            "version": "1.0",
            "ignore": ["target", ".logic_legacy"],
            "extends": ["cerberus:rust-hexagonal"],
            "rules": {
                "ARCH-001": "deny",
                "VUE-001": "warn",
                "CSS-001": "off"
            },
            "overrides": [
                {
                    "files": ["src-tauri/**/*.rs"],
                    "rules": {
                        "ARCH-001": "deny"
                    }
                }
            ]
        }"#;

        let cfg: CerberusConfig = serde_json::from_str(json).unwrap();
        assert_eq!(cfg.version, "1.0");
        assert_eq!(cfg.ignore.len(), 2);
        assert_eq!(cfg.rules.get("ARCH-001"), Some(&Severity::Deny));
        assert_eq!(cfg.rules.get("VUE-001"), Some(&Severity::Warn));
        assert_eq!(cfg.rules.get("CSS-001"), Some(&Severity::Off));
        assert_eq!(cfg.overrides.len(), 1);
        assert_eq!(cfg.overrides[0].files[0], "src-tauri/**/*.rs");

        let default_cfg = CerberusConfig::default();
        assert_eq!(default_cfg.version, "1.0");
        assert!(default_cfg.ignore.is_empty());
        assert!(default_cfg.rules.is_empty());
        assert!(default_cfg.overrides.is_empty());

        let default_override = RuleOverride::default();
        assert!(default_override.files.is_empty());
        assert!(default_override.rules.is_empty());
    }

    #[test]
    fn test_rules_config_and_violation_and_categories() {
        let categories = vec![
            Category::Architecture,
            Category::Security,
            Category::Robustness,
            Category::Convention,
            Category::Performance,
        ];
        for cat in categories {
            let json = serde_json::to_string(&cat).unwrap();
            let parsed: Category = serde_json::from_str(&json).unwrap();
            assert_eq!(parsed, cat);
        }

        let rule_def = RuleDefinition {
            id: "ARCH-001".into(),
            version: "1.0".into(),
            category: Category::Architecture,
            severity: Severity::Deny,
            title: "Domain Purity".into(),
            description: "No external frameworks in domain".into(),
            remediation: "Remove framework import".into(),
        };
        let rule_json = serde_json::to_string(&rule_def).unwrap();
        let parsed_rule: RuleDefinition = serde_json::from_str(&rule_json).unwrap();
        assert_eq!(parsed_rule.id, "ARCH-001");

        let rules_cfg = RulesConfig {
            schema: Some("schema.json".into()),
            version: "1.0".into(),
            ignore: vec!["target".into()],
            rules: vec![rule_def],
        };
        let cfg_json = serde_json::to_string(&rules_cfg).unwrap();
        let parsed_cfg: RulesConfig = serde_json::from_str(&cfg_json).unwrap();
        assert_eq!(parsed_cfg.version, "1.0");
        assert_eq!(parsed_cfg.rules.len(), 1);

        let fp1 = compute_fingerprint("ARCH-001", "1.0", "tauri::*", "use tauri::State;");
        let fp2 = compute_fingerprint("ARCH-001", "1.0", "tauri::*", "use   tauri::State;");
        assert_eq!(fp1, fp2);
        assert!(!fp1.is_empty());

        let violation = Violation {
            rule_id: "ARCH-001".into(),
            rule_version: "1.0".into(),
            category: Category::Architecture,
            severity: Severity::Deny,
            file: PathBuf::from("src/domain/test.rs"),
            line: 10,
            column: 1,
            symbol: "tauri".into(),
            snippet: "use tauri;".into(),
            message: "Domain purity violation".into(),
            remediation: "Remove tauri".into(),
            fingerprint: fp1,
        };
        let v_json = serde_json::to_string(&violation).unwrap();
        let parsed_v: Violation = serde_json::from_str(&v_json).unwrap();
        assert_eq!(parsed_v.rule_id, "ARCH-001");
        assert_eq!(parsed_v.line, 10);

        // Test LimitsConfig defaults and serde deserialization
        let default_limits = LimitsConfig::default();
        assert_eq!(default_limits.max_sloc_warn, 500);
        assert_eq!(default_limits.max_sloc_deny, 800);
        assert_eq!(default_limits.max_pressure_warn, 200.0);
        assert_eq!(default_limits.max_pressure_deny, 400.0);
        assert_eq!(default_limits.max_style_lines, 25);
        assert_eq!(default_limits.max_script_setup_lines, 35);

        let from_empty_json: LimitsConfig = serde_json::from_str("{}").unwrap();
        assert_eq!(from_empty_json.max_sloc_warn, 500);
        assert_eq!(from_empty_json.max_sloc_deny, 800);
        assert_eq!(from_empty_json.max_pressure_warn, 200.0);
        assert_eq!(from_empty_json.max_pressure_deny, 400.0);
        assert_eq!(from_empty_json.max_style_lines, 25);
        assert_eq!(from_empty_json.max_script_setup_lines, 35);

        // Test Severity deserialization error message
        let invalid_sev_err = serde_json::from_str::<Severity>("\"invalid_level\"").unwrap_err();
        assert!(invalid_sev_err.to_string().contains("severity"));

        // Test compute_fingerprint
        let fp_sha = compute_fingerprint("AI-001", "1.0", "sym", "snippet");
        assert_ne!(fp_sha, "xyzzy");
        assert_eq!(fp_sha.len(), 64);

        // Exercise Debug trait implementations
        let _ = format!("{:?}", Category::Architecture);
        let _ = format!("{:?}", Severity::Deny);
        let _ = format!("{:?}", parsed_rule);
        let _ = format!("{:?}", RuleOverride::default());
        let _ = format!("{:?}", CerberusConfig::default());
        let _ = format!("{:?}", parsed_cfg);
        let _ = format!("{:?}", parsed_v);
    }
}

