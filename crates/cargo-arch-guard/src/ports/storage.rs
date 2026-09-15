use crate::domain::rules::{RuleDefinition, RulesConfig};

pub trait KeyStoragePort: Send + Sync {
    fn get_key(&self) -> Result<Vec<u8>, String>;
    fn set_key(&self, key: &[u8]) -> Result<(), String>;
}

pub trait RulesRepositoryPort: Send + Sync {
    fn load_config(&self) -> Result<RulesConfig, String>;
    fn get_rule(&self, rule_id: &str) -> Option<RuleDefinition>;
}
