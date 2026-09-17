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
    #[serde(default)]
    pub ignore: Vec<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ArchLayer {
    Domain,
    Ports,
    Application,
    Infrastructure,
    Adapter,
    Cli,
    Unknown,
}

impl ArchLayer {
    pub fn parse(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "domain" => Self::Domain,
            "ports" | "port" => Self::Ports,
            "application" | "app" | "usecase" | "usecases" => Self::Application,
            "infrastructure" | "infra" => Self::Infrastructure,
            "adapter" | "adapters" | "tauri" => Self::Adapter,
            "cli" | "entrypoint" | "bin" => Self::Cli,
            _ => Self::Unknown,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Domain => "domain",
            Self::Ports => "ports",
            Self::Application => "application",
            Self::Infrastructure => "infrastructure",
            Self::Adapter => "adapter",
            Self::Cli => "cli",
            Self::Unknown => "unknown",
        }
    }

    pub fn can_depend_on(&self, target: ArchLayer) -> bool {
        match self {
            Self::Domain => matches!(target, Self::Domain),
            Self::Ports => matches!(target, Self::Domain | Self::Ports),
            Self::Application => matches!(target, Self::Domain | Self::Ports | Self::Application),
            Self::Infrastructure => matches!(target, Self::Domain | Self::Ports | Self::Infrastructure),
            Self::Adapter | Self::Cli => true,
            Self::Unknown => true,
        }
    }
}
