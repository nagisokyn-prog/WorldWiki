use arch_guard_domain::{RuleDefinition, RulesConfig};
use arch_guard_ports::RulesRepositoryPort;

use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

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
