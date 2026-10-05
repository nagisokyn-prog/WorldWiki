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
