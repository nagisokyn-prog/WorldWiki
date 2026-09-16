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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_arch_layer_parsing_and_as_str() {
        assert_eq!(ArchLayer::parse("domain"), ArchLayer::Domain);
        assert_eq!(ArchLayer::Domain.as_str(), "domain");
        assert_eq!(ArchLayer::parse("ports"), ArchLayer::Ports);
        assert_eq!(ArchLayer::Ports.as_str(), "ports");
        assert_eq!(ArchLayer::parse("application"), ArchLayer::Application);
        assert_eq!(ArchLayer::Application.as_str(), "application");
        assert_eq!(ArchLayer::parse("infrastructure"), ArchLayer::Infrastructure);
        assert_eq!(ArchLayer::Infrastructure.as_str(), "infrastructure");
        assert_eq!(ArchLayer::parse("tauri"), ArchLayer::Adapter);
        assert_eq!(ArchLayer::Adapter.as_str(), "adapter");
        assert_eq!(ArchLayer::parse("cli"), ArchLayer::Cli);
        assert_eq!(ArchLayer::Cli.as_str(), "cli");
        assert_eq!(ArchLayer::parse("random"), ArchLayer::Unknown);
        assert_eq!(ArchLayer::Unknown.as_str(), "unknown");
    }

    #[test]
    fn test_arch_layer_dependency_matrix_rules() {
        // Domain can ONLY depend on Domain
        assert!(ArchLayer::Domain.can_depend_on(ArchLayer::Domain));
        assert!(!ArchLayer::Domain.can_depend_on(ArchLayer::Ports));
        assert!(!ArchLayer::Domain.can_depend_on(ArchLayer::Application));
        assert!(!ArchLayer::Domain.can_depend_on(ArchLayer::Infrastructure));

        // Ports can depend on Domain & Ports
        assert!(ArchLayer::Ports.can_depend_on(ArchLayer::Domain));
        assert!(ArchLayer::Ports.can_depend_on(ArchLayer::Ports));
        assert!(!ArchLayer::Ports.can_depend_on(ArchLayer::Infrastructure));

        // Application can depend on Domain & Ports & Application
        assert!(ArchLayer::Application.can_depend_on(ArchLayer::Domain));
        assert!(ArchLayer::Application.can_depend_on(ArchLayer::Ports));
        assert!(!ArchLayer::Application.can_depend_on(ArchLayer::Infrastructure));

        // Infrastructure can depend on Domain & Ports & Infrastructure
        assert!(ArchLayer::Infrastructure.can_depend_on(ArchLayer::Domain));
        assert!(ArchLayer::Infrastructure.can_depend_on(ArchLayer::Ports));
        assert!(!ArchLayer::Infrastructure.can_depend_on(ArchLayer::Application));

        // Adapter / CLI / Unknown can depend on anything
        assert!(ArchLayer::Cli.can_depend_on(ArchLayer::Infrastructure));
        assert!(ArchLayer::Adapter.can_depend_on(ArchLayer::Application));
        assert!(ArchLayer::Unknown.can_depend_on(ArchLayer::Domain));
    }

    #[test]
    fn test_layer_metadata_structs_serde() {
        let meta = WorkspaceArchMetadata {
            preset: Some("hexagonal".into()),
            layers: HashMap::from([("domain".into(), LayerRule { allowed_dependencies: vec!["ports".into()] })]),
        };
        let json = serde_json::to_string(&meta).unwrap();
        let parsed: WorkspaceArchMetadata = serde_json::from_str(&json).unwrap();
        assert_eq!(meta, parsed);

        let pkg = PackageArchMetadata {
            layer: Some("domain".into()),
            ignore: vec![],
        };
        let pkg_json = serde_json::to_string(&pkg).unwrap();
        let pkg_parsed: PackageArchMetadata = serde_json::from_str(&pkg_json).unwrap();
        assert_eq!(pkg, pkg_parsed);
    }
}


