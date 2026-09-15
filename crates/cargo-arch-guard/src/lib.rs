// 🦀 Hexagonal Core: Ports & Adapters Architecture
pub mod domain;
pub mod ports;
pub mod application;
pub mod infrastructure;

// Internal AST & Frontend rule sub-engines
pub mod ast;
pub mod frontend;
pub mod taint;

// Convenience re-exports
pub use application::{
    ReconcileBaselineUseCase, ScanResult, ScanScope, ScanWorkspaceUseCase, SignSuppressionUseCase,
};
pub use domain::{
    compute_fingerprint, Category, PackageMetrics, PressureCalculator, RuleDefinition, RulesConfig,
    Severity, Suppression, Violation,
};
pub use infrastructure::{
    ConsoleReportAdapter, FileStorageAdapter, JsonReportAdapter, KeyringStorageAdapter,
    MockStorageAdapter, RulesJsonRepository, RustSynParserAdapter, SarifReportAdapter,
    VueSfcParserAdapter,
};
pub use ports::{AstParserPort, KeyStoragePort, ReportPublisherPort, RulesRepositoryPort};
