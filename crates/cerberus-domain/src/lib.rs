pub mod catalog;
pub mod cluster;
pub mod layer;
pub mod metrics;
pub mod path_utils;
pub mod preset;
pub mod registry;
pub mod rules;
pub mod sla;
pub mod suppression;
pub mod traits;
pub mod tree;

pub use catalog::{RuleCatalog, RuleDocEntry};
pub use cluster::{ClusterAnalysisReport, ViolationCluster};
pub use layer::{ArchLayer, LayerRule, LayerTopologyMatrix, PackageArchMetadata, WorkspaceArchMetadata};
pub use metrics::{FileMetrics, PackageMetrics, PressureCalculator, PressureWeights};
pub use path_utils::{
    is_path_ignored, matches_ignore_pattern, normalize_path, normalize_path_str, path_contains,
    path_ends_with, path_starts_with,
};
pub use preset::Preset;
pub use registry::BuiltinRuleRegistry;
pub use rules::{
    compute_fingerprint, Category, CerberusConfig, LimitsConfig, RuleDefinition, RuleOverride,
    RulesConfig, Severity, Violation,
};
pub use sla::SlaConfig;
pub use suppression::Suppression;
pub use traits::{
    ArchitecturalEntity, DiagnosticReporter, DomainModel, Fingerprintable, MetricsProvider,
    RuleEvaluator,
};
pub use tree::{DirNode, FileMetricsNode, HealthLevel, PackageNode, TreeItemNode, TreeReport};

