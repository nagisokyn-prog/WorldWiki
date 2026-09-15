// 🦀 Hexagonal Core: Ports & Adapters Architecture
pub use arch_guard_domain as domain;
pub use arch_guard_ports as ports;
pub use arch_guard_application as application;
pub use arch_guard_infrastructure as infrastructure;

// Re-exports for convenience and backwards-compatibility
pub use application::{
    ExplainClustersUseCase, ReconcileBaselineUseCase, ScanResult, ScanScope,
    ScanWorkspaceUseCase, SignSuppressionUseCase,
};
pub use domain::{
    compute_fingerprint, Category, ClusterAnalysisReport, LayerRule, PackageArchMetadata,
    PackageMetrics, PressureCalculator, RuleDefinition, RulesConfig, Severity, Suppression,
    Violation, ViolationCluster, WorkspaceArchMetadata,
};
pub use infrastructure::{
    ConsoleReportAdapter, DbscanClustererAdapter, FileStorageAdapter, GitHooksInstaller,
    JsonReportAdapter, KeyringStorageAdapter, MockStorageAdapter, PatternCache,
    RulesJsonRepository, RustSynParserAdapter, SarifReportAdapter, SemanticEmbedderAdapter,
    VueSfcParserAdapter,
};
pub use ports::{
    AstParserPort, ClustererPort, KeyStoragePort, ReportPublisherPort, RulesRepositoryPort,
    VectorEmbedderPort,
};

