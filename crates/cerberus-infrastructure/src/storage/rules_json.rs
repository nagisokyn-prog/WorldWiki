use cerberus_domain::{RuleDefinition, RulesConfig};
use cerberus_ports::RulesRepositoryPort;

use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug)]
pub struct RulesJsonRepository {
    pub config: RulesConfig,
    pub rules_by_id: HashMap<String, RuleDefinition>,
}


impl RulesJsonRepository {
    pub fn load_from_file(path: &Path) -> Result<Self, String> {
        let content = fs::read_to_string(path)
            .map_err(|e| format!("Failed to read rules file at {}: {}", path.display(), e))?;
        let config: RulesConfig = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse rules JSON at {}: {}", path.display(), e))?;

        let mut rules_by_id = HashMap::new();
        for rule in &config.rules {
            if rules_by_id.contains_key(&rule.id) {
                return Err(format!("Duplicate rule id '{}' in {}", rule.id, path.display()));
            }
            rules_by_id.insert(rule.id.clone(), rule.clone());
        }

        Ok(Self { config, rules_by_id })
    }

    pub fn find_rules_path(custom_path: Option<&PathBuf>) -> PathBuf {
        if let Some(p) = custom_path {
            if p.exists() {
                return p.clone();
            }
        }

        let candidates = [
            PathBuf::from("firewall/rules.json"),
            PathBuf::from("../firewall/rules.json"),
            PathBuf::from("../../firewall/rules.json"),
            PathBuf::from(".archguard/rules.json"),
        ];

        for candidate in &candidates {
            if candidate.exists() {
                return candidate.clone();
            }
        }

        PathBuf::from("firewall/rules.json")
    }

    pub fn validate_registered_rules(&self, used_rule_ids: &[&str]) -> Result<(), Vec<String>> {
        let mut errors = Vec::new();
        for &id in used_rule_ids {
            if !self.rules_by_id.contains_key(id) {
                errors.push(format!("Analyzer emitted rule '{}' which is not declared in rules.json", id));
            }
        }
        if !errors.is_empty() {
            Err(errors)
        } else {
            Ok(())
        }
    }
}

impl RulesRepositoryPort for RulesJsonRepository {
    fn load_config(&self) -> Result<RulesConfig, String> {
        Ok(self.config.clone())
    }

    fn get_rule(&self, rule_id: &str) -> Option<RuleDefinition> {
        self.rules_by_id.get(rule_id).cloned()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_rules_json_load_success() {
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
    }
}

