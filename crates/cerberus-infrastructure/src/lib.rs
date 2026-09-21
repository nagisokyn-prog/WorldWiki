pub mod ast;
pub mod frontend;
pub mod hooks;
pub mod manifest;
pub mod metrics;
pub mod parsers;
pub mod reporters;
pub mod scanner;
pub mod storage;
pub mod taint;
pub mod vector;

pub use ast::MacroVisitor;
pub use frontend::{
    CssPerfRuleChecker, CssRuleChecker, DesignSystemRuleChecker, FsdLayer, FsdRulesChecker,
    PerfRulesChecker,
};
pub use hooks::GitHooksInstaller;
pub use manifest::{CargoMetadataManifestAdapter, TransitiveCapabilityChecker};
pub use metrics::{
    AstComplexityAnalyzer, BlastRadiusAnalyzer, PackageTopologyAnalyzer, RustAstComplexityVisitor,
    SlocCalculator,
};
pub use parsers::{ParallelAstEngineAdapter, RustSynParserAdapter, VueSfcParserAdapter};

pub use reporters::{ConsoleReportAdapter, JsonReportAdapter, SarifReportAdapter, TreeFormatterAdapter};

pub use scanner::WalkDirScannerAdapter;
pub use storage::{
    FileBaselineStorageAdapter, FileStorageAdapter, KeyringStorageAdapter, MockStorageAdapter,
    RulesJsonRepository,
};

pub use vector::{
    DbscanClustererAdapter, ModelRegistry, NativeModelDownloaderAdapter, PatternCache,
    SemanticEmbedderAdapter, TractOnnxEmbedderAdapter,
};
