// 🦀 Hexagonal Core: Ports & Adapters Architecture
pub use arch_guard_domain as domain;
pub use arch_guard_ports as ports;
pub use arch_guard_application as application;
pub use arch_guard_infrastructure as infrastructure;

// Re-exports for convenience and backwards-compatibility
pub use application::{
    ReconcileBaselineUseCase, ScanResult, ScanScope, ScanWorkspaceUseCase, SignSuppressionUseCase,
};
pub use domain::{
    compute_fingerprint, Category, LayerRule, PackageArchMetadata, PackageMetrics,
    PressureCalculator, RuleDefinition, RulesConfig, Severity, Suppression, Violation,
    WorkspaceArchMetadata,
};
pub use infrastructure::{
    ConsoleReportAdapter, FileStorageAdapter, JsonReportAdapter, KeyringStorageAdapter,
    MockStorageAdapter, RulesJsonRepository, RustSynParserAdapter, SarifReportAdapter,
    VueSfcParserAdapter,
};
pub use ports::{AstParserPort, KeyStoragePort, ReportPublisherPort, RulesRepositoryPort};
