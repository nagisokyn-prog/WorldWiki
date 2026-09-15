pub mod cluster;
pub mod layer;
pub mod metrics;
pub mod preset;
pub mod rules;
pub mod suppression;

pub use cluster::{ClusterAnalysisReport, ViolationCluster};
pub use layer::{LayerRule, PackageArchMetadata, WorkspaceArchMetadata};

pub use metrics::{PackageMetrics, PressureCalculator};
pub use preset::Preset;
pub use rules::{
    compute_fingerprint, Category, RuleDefinition, RulesConfig, Severity, Violation,
};
pub use suppression::Suppression;

