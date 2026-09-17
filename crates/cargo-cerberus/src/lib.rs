// 🦀 Hexagonal Core: Ports & Adapters Architecture
pub use cerberus_domain as domain;
pub use cerberus_ports as ports;
pub use cerberus_application as application;
pub use cerberus_infrastructure as infrastructure;

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
pub mod check_runner;
pub use check_runner::*;

pub mod cli;
pub use cli::*;

pub mod commands;
pub use commands::*;

pub mod ledger_commands;
pub use ledger_commands::*;

pub mod model_commands;
pub use model_commands::*;

pub use ports::{
    AstParserPort, ClustererPort, KeyStoragePort, ModelDownloaderPort, ReportPublisherPort,
    RulesRepositoryPort, VectorEmbedderPort,
};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cargo_cerberus_re_exports() {
        let v = Violation {
            rule_id: "ARCH-001".into(),
            rule_version: "1.0".into(),
            category: Category::Architecture,
            severity: Severity::Deny,
            file: std::path::PathBuf::from("src/lib.rs"),
            line: 1,
            column: 1,
            symbol: "sym".into(),
            snippet: "snip".into(),
            message: "msg".into(),
            remediation: "rem".into(),
            fingerprint: "fp".into(),
        };
        assert_eq!(v.rule_id, "ARCH-001");
        assert_eq!(
            compute_fingerprint("ARCH-001", "1.0", "sym", "snippet"),
            compute_fingerprint("ARCH-001", "1.0", "sym", "snippet")
        );
    }
}
