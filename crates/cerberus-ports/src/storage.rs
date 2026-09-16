use cerberus_domain::{RuleDefinition, RulesConfig};
use std::path::Path;

pub trait KeyStoragePort: Send + Sync {
    fn get_key(&self) -> Result<Vec<u8>, String>;
    fn set_key(&self, key: &[u8]) -> Result<(), String>;
}

pub trait RulesRepositoryPort: Send + Sync {
    fn load_config(&self) -> Result<RulesConfig, String>;
    fn get_rule(&self, rule_id: &str) -> Option<RuleDefinition>;
}

pub trait BaselineStoragePort: Send + Sync {
    fn read(&self, path: &Path) -> Result<Option<String>, String>;
    fn write(&self, path: &Path, content: &str) -> Result<(), String>;
}

