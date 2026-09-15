use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
pub struct LayerRule {
    #[serde(default)]
    pub allowed_dependencies: Vec<String>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct WorkspaceArchMetadata {
    #[serde(default)]
    pub preset: Option<String>,
    #[serde(default)]
    pub layers: HashMap<String, LayerRule>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct PackageArchMetadata {
    #[serde(default)]
    pub layer: Option<String>,
}
