use cerberus_domain::{BuiltinRuleRegistry, CerberusConfig, RuleDefinition, RulesConfig};
use cerberus_ports::RulesRepositoryPort;

use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone)]
pub struct RulesJsonRepository {
    pub config: RulesConfig,
    pub cerberus_config: Option<CerberusConfig>,
    pub rules_by_id: HashMap<String, RuleDefinition>,
}

impl RulesJsonRepository {
    pub fn load_from_file(path: &Path) -> Result<Self, String> {
        let content = fs::read_to_string(path)
            .map_err(|e| format!("Failed to read rules file at {}: {}", path.display(), e))?;

        // 1. Try parsing modern cerberus.json format (rules as HashMap<String, Severity>)
        if let Ok(cerberus_cfg) = serde_json::from_str::<CerberusConfig>(&content) {
            let builtin_map = BuiltinRuleRegistry::rule_map();
            let mut rules_by_id = HashMap::new();

            // Populate all built-ins first
            for rule in BuiltinRuleRegistry::all_rules() {
                rules_by_id.insert(rule.id.clone(), rule);
            }

            // Apply severity overrides
            for (rule_key, &severity) in &cerberus_cfg.rules {
                let canonical_id = BuiltinRuleRegistry::canonical_rule_id(rule_key);
                if let Some(def) = builtin_map.get(&canonical_id) {
                    let mut overridden = def.clone();
                    overridden.severity = severity;
                    rules_by_id.insert(canonical_id, overridden);
                } else {
                    // Custom rule declaration
                    rules_by_id.insert(
                        canonical_id.clone(),
                        RuleDefinition {
                            id: canonical_id,
                            version: "1.0".into(),
                            category: cerberus_domain::Category::Convention,
                            severity,
                            title: rule_key.clone(),
                            description: format!("Configured rule {}", rule_key),
                            remediation: "Follow project architecture guidelines.".into(),
                        },
                    );
                }
            }

            let rules_vec = rules_by_id.values().cloned().collect();
            let config = RulesConfig {
                schema: cerberus_cfg.schema.clone(),
                version: cerberus_cfg.version.clone(),
                ignore: cerberus_cfg.ignore.clone(),
                rules: rules_vec,
            };

            return Ok(Self {
                config,
                cerberus_config: Some(cerberus_cfg),
                rules_by_id,
            });
        }

        // 2. Fallback to legacy RulesConfig format (rules as Vec<RuleDefinition>)
        let config: RulesConfig = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse rules JSON at {}: {}", path.display(), e))?;

        let mut rules_by_id = HashMap::new();
        for rule in &config.rules {
            if rules_by_id.contains_key(&rule.id) {
                return Err(format!(
                    "Duplicate rule id '{}' in {}",
                    rule.id,
                    path.display()
                ));
            }
            rules_by_id.insert(rule.id.clone(), rule.clone());
        }

        Ok(Self {
            config,
            cerberus_config: None,
            rules_by_id,
        })
    }

    pub fn load_from_file_or_default(path: &Path) -> Self {
        if path.exists() {
            Self::load_from_file(path).unwrap_or_default()
        } else {
            Self::default()
        }
    }

    pub fn limits(&self) -> cerberus_domain::LimitsConfig {
        self.cerberus_config
            .as_ref()
            .map(|c| c.limits.clone())
            .unwrap_or_default()
    }

    pub fn find_rules_path(custom_path: Option<&PathBuf>) -> PathBuf {
        if let Some(p) = custom_path {
            return p.clone();
        }

        let candidates = [
            PathBuf::from("cerberus.json"),
            PathBuf::from("../cerberus.json"),
            PathBuf::from("../../cerberus.json"),
            PathBuf::from(".cerberusrc"),
            PathBuf::from("firewall/rules.json"),
            PathBuf::from("../firewall/rules.json"),
            PathBuf::from("../../firewall/rules.json"),
            PathBuf::from(".cerberus/rules.json"),
            PathBuf::from(".archguard/rules.json"),
        ];

        for candidate in &candidates {
            if candidate.exists() {
                return candidate.clone();
            }
        }

        PathBuf::from("cerberus.json")
    }

    pub fn validate_registered_rules(&self, used_rule_ids: &[&str]) -> Result<(), Vec<String>> {
        let mut errors = Vec::new();
        for &id in used_rule_ids {
            let canonical = BuiltinRuleRegistry::canonical_rule_id(id);
            if !self.rules_by_id.contains_key(id) && !self.rules_by_id.contains_key(&canonical) {
                errors.push(format!(
                    "Analyzer emitted rule '{}' which is not declared in configuration",
                    id
                ));
            }
        }
        if !errors.is_empty() {
            Err(errors)
        } else {
            Ok(())
        }
    }
}

impl Default for RulesJsonRepository {
    fn default() -> Self {
        let mut rules_by_id = HashMap::new();
        for rule in BuiltinRuleRegistry::all_rules() {
            rules_by_id.insert(rule.id.clone(), rule);
        }
        let rules_vec = rules_by_id.values().cloned().collect();
        let config = RulesConfig {
            schema: None,
            version: "2.0".into(),
            ignore: Vec::new(),
            rules: rules_vec,
        };
        Self {
            config,
            cerberus_config: None,
            rules_by_id,
        }
    }
}

impl RulesRepositoryPort for RulesJsonRepository {
    fn load_config(&self) -> Result<RulesConfig, String> {
        Ok(self.config.clone())
    }

    fn get_rule(&self, rule_id: &str) -> Option<RuleDefinition> {
        let canonical = BuiltinRuleRegistry::canonical_rule_id(rule_id);
        self.rules_by_id
            .get(rule_id)
            .or_else(|| self.rules_by_id.get(&canonical))
            .cloned()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use cerberus_domain::Severity;
    use tempfile::tempdir;

    #[test]
    fn test_rules_json_load_modern_cerberus_json() {
        let temp = tempdir().unwrap();
        let file_path = temp.path().join("cerberus.json");
        let json_content = r#"{
            "version": "1.0",
            "ignore": [".logic_legacy", "target"],
            "limits": {
                "max_sloc_warn": 600,
                "max_sloc_deny": 900
            },
            "rules": {
                "arch/domain-purity": "deny",
                "vue/no-monolith-script-setup": "warn",
                "css/no-hardcoded-colors": "off",
                "custom/team-rule": "deny"
            }
        }"#;
        fs::write(&file_path, json_content).unwrap();

        let repo = RulesJsonRepository::load_from_file(&file_path).unwrap();
        assert_eq!(repo.config.ignore.len(), 2);

        let limits = repo.limits();
        assert_eq!(limits.max_sloc_warn, 600);
        assert_eq!(limits.max_sloc_deny, 900);

        let arch001 = repo.get_rule("ARCH-001").unwrap();
        assert_eq!(arch001.severity, Severity::Deny);

        let vue001 = repo.get_rule("VUE-001").unwrap();
        assert_eq!(vue001.severity, Severity::Warn);

        let css001 = repo.get_rule("CSS-001").unwrap();
        assert_eq!(css001.severity, Severity::Off);

        let custom = repo.get_rule("custom/team-rule").unwrap();
        assert_eq!(custom.severity, Severity::Deny);

        assert!(repo
            .validate_registered_rules(&["ARCH-001", "VUE-001", "custom/team-rule"])
            .is_ok());
    }

    #[test]
    fn test_rules_json_load_legacy_success() {
        let temp = tempdir().unwrap();
        let file_path = temp.path().join("rules.json");
        let json_content = r#"{
            "version": "1.0",
            "rules": [
                {
                    "id": "ARCH-001",
                    "version": "1.0",
                    "category": "Architecture",
                    "severity": "Deny",
                    "title": "Domain purity",
                    "description": "desc",
                    "remediation": "rem"
                }
            ]
        }"#;
        fs::write(&file_path, json_content).unwrap();

        let repo = RulesJsonRepository::load_from_file(&file_path).unwrap();
        let port: &dyn RulesRepositoryPort = &repo;
        let rule = port.get_rule("ARCH-001").unwrap();
        assert_eq!(rule.id, "ARCH-001");
        assert!(port.get_rule("NON_EXISTENT").is_none());
        assert!(port.load_config().is_ok());

        assert!(repo.validate_registered_rules(&["ARCH-001"]).is_ok());
        assert!(repo.validate_registered_rules(&["NON_EXISTENT"]).is_err());
    }

    #[test]
    fn test_rules_json_duplicate_id_error() {
        let temp = tempdir().unwrap();
        let file_path = temp.path().join("rules_dup.json");
        let json_content = r#"{
            "version": "1.0",
            "rules": [
                {
                    "id": "ARCH-001",
                    "version": "1.0",
                    "category": "Architecture",
                    "severity": "Deny",
                    "title": "Rule 1",
                    "description": "desc",
                    "remediation": "rem"
                },
                {
                    "id": "ARCH-001",
                    "version": "1.0",
                    "category": "Architecture",
                    "severity": "Deny",
                    "title": "Rule 1 duplicate",
                    "description": "desc",
                    "remediation": "rem"
                }
            ]
        }"#;
        fs::write(&file_path, json_content).unwrap();

        let err = RulesJsonRepository::load_from_file(&file_path).unwrap_err();
        assert!(err.contains("Duplicate rule id 'ARCH-001'"));
    }

    #[test]
    fn test_rules_json_missing_or_corrupted_file() {
        let temp = tempdir().unwrap();
        let non_existent = temp.path().join("does_not_exist.json");
        assert!(RulesJsonRepository::load_from_file(&non_existent).is_err());

        let corrupted = temp.path().join("corrupted.json");
        fs::write(&corrupted, "{ not valid json").unwrap();
        assert!(RulesJsonRepository::load_from_file(&corrupted).is_err());
    }

    #[test]
    fn test_find_rules_path_fallback() {
        let temp = tempdir().unwrap();
        let custom = temp.path().join("custom_rules.json");
        fs::write(&custom, "{}").unwrap();

        let resolved = RulesJsonRepository::find_rules_path(Some(&custom));
        assert_eq!(resolved, custom);

        let default_path = RulesJsonRepository::find_rules_path(None);
        assert!(!default_path.as_os_str().is_empty());

        let default_repo = RulesJsonRepository::default();
        assert!(!default_repo.rules_by_id.is_empty());

        let loaded_or_default = RulesJsonRepository::load_from_file_or_default(&custom);
        assert!(!loaded_or_default.rules_by_id.is_empty());

        let missing_path = temp.path().join("missing.json");
        let fallback_default = RulesJsonRepository::load_from_file_or_default(&missing_path);
        assert!(!fallback_default.rules_by_id.is_empty());
    }
}
