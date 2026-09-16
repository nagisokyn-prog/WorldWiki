pub mod cluster;
pub mod layer;
pub mod metrics;
pub mod preset;
pub mod registry;
pub mod rules;
pub mod suppression;

pub use cluster::{ClusterAnalysisReport, ViolationCluster};
pub use layer::{ArchLayer, LayerRule, PackageArchMetadata, WorkspaceArchMetadata};
pub use metrics::{FileMetrics, PackageMetrics, PressureCalculator, PressureWeights};
pub use preset::Preset;
pub use registry::BuiltinRuleRegistry;
pub use rules::{
    compute_fingerprint, Category, CerberusConfig, LimitsConfig, RuleDefinition, RuleOverride,
    RulesConfig, Severity, Violation,
};
pub use suppression::Suppression;

