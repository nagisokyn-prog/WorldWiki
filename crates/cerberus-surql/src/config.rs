use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SurqlConfig {
    #[serde(default = "default_true")]
    pub enabled: bool,

    #[serde(default = "default_target_version")]
    pub target_version: String,

    #[serde(default = "default_true")]
    pub strict_schema: bool,

    #[serde(default = "default_true")]
    pub require_ddl_overwrite: bool,

    #[serde(default)]
    pub dml: SurqlDmlConfig,

    #[serde(default)]
    pub types: SurqlTypesConfig,

    #[serde(default)]
    pub fts: SurqlFtsConfig,

    #[serde(default)]
    pub heavy_data: SurqlHeavyDataConfig,
}

fn default_true() -> bool {
    true
}

fn default_target_version() -> String {
    "3".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SurqlDmlConfig {
    #[serde(default = "default_true")]
    pub warn_on_select_star: bool,

    #[serde(default = "default_true")]
    pub disallow_select_star_in_functions: bool,

    #[serde(default = "default_true")]
    pub require_limit_in_functions: bool,
}

impl Default for SurqlDmlConfig {
    fn default() -> Self {
        Self {
            warn_on_select_star: true,
            disallow_select_star_in_functions: true,
            require_limit_in_functions: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SurqlTypesConfig {
    #[serde(default = "default_true")]
    pub disallow_three_valued_booleans: bool,

    #[serde(default = "default_true")]
    pub disallow_nullable_collections: bool,

    #[serde(default = "default_true")]
    pub warn_on_naked_option: bool,
}

impl Default for SurqlTypesConfig {
    fn default() -> Self {
        Self {
            disallow_three_valued_booleans: true,
            disallow_nullable_collections: true,
            warn_on_naked_option: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SurqlFtsConfig {
    #[serde(default = "default_true")]
    pub require_score_on_predicate: bool,

    #[serde(default = "default_true")]
    pub warn_on_split_index_or: bool,
}

impl Default for SurqlFtsConfig {
    fn default() -> Self {
        Self {
            require_score_on_predicate: true,
            warn_on_split_index_or: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SurqlHeavyDataConfig {
    #[serde(default = "default_historical_patterns")]
    pub historical_table_patterns: Vec<String>,

    #[serde(default)]
    pub historical_tables: Vec<String>,

    #[serde(default)]
    pub exempt_tables: Vec<String>,

    #[serde(default = "default_heavy_field_types")]
    pub heavy_field_types: Vec<String>,
}

fn default_historical_patterns() -> Vec<String> {
    vec!["^.*_(history|revisions?|snapshots?|audit)$".to_string()]
}

fn default_heavy_field_types() -> Vec<String> {
    vec![
        "array<float>".to_string(),
        "vector".to_string(),
        "bytes".to_string(),
    ]
}

impl Default for SurqlHeavyDataConfig {
    fn default() -> Self {
        Self {
            historical_table_patterns: default_historical_patterns(),
            historical_tables: Vec::new(),
            exempt_tables: Vec::new(),
            heavy_field_types: default_heavy_field_types(),
        }
    }
}

impl Default for SurqlConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            target_version: default_target_version(),
            strict_schema: true,
            require_ddl_overwrite: true,
            dml: SurqlDmlConfig::default(),
            types: SurqlTypesConfig::default(),
            fts: SurqlFtsConfig::default(),
            heavy_data: SurqlHeavyDataConfig::default(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_defaults_and_serde() {
        let default_cfg = SurqlConfig::default();
        assert!(default_cfg.enabled);
        assert_eq!(default_cfg.target_version, "3");
        assert!(default_cfg.strict_schema);
        assert!(default_cfg.require_ddl_overwrite);
        assert!(default_cfg.dml.warn_on_select_star);
        assert!(default_cfg.types.disallow_three_valued_booleans);
        assert!(default_cfg.fts.require_score_on_predicate);
        assert_eq!(default_cfg.heavy_data.historical_table_patterns.len(), 1);
        assert_eq!(default_cfg.heavy_data.heavy_field_types.len(), 3);

        let dml_def = SurqlDmlConfig::default();
        assert!(dml_def.disallow_select_star_in_functions);

        let types_def = SurqlTypesConfig::default();
        assert!(types_def.disallow_nullable_collections);

        let fts_def = SurqlFtsConfig::default();
        assert!(fts_def.warn_on_split_index_or);

        let heavy_def = SurqlHeavyDataConfig::default();
        assert!(heavy_def.historical_tables.is_empty());

        assert!(default_true());
        assert_eq!(default_target_version(), "3");
        assert!(!default_historical_patterns().is_empty());
        assert!(!default_heavy_field_types().is_empty());

        let json = serde_json::to_string(&default_cfg).unwrap();
        let deserialized: SurqlConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.target_version, "3");
    }
}

