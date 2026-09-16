pub mod ast;
pub mod frontend;
pub mod hooks;
pub mod manifest;
pub mod parsers;
pub mod reporters;
pub mod scanner;
pub mod storage;
pub mod taint;
pub mod vector;

pub use ast::MacroVisitor;
pub use hooks::GitHooksInstaller;
pub use manifest::CargoMetadataManifestAdapter;
pub use parsers::{ParallelAstEngineAdapter, RustSynParserAdapter, VueSfcParserAdapter};

pub use reporters::{ConsoleReportAdapter, JsonReportAdapter, SarifReportAdapter};

pub use scanner::WalkDirScannerAdapter;
pub use storage::{
    FileBaselineStorageAdapter, FileStorageAdapter, KeyringStorageAdapter, MockStorageAdapter,
    RulesJsonRepository,
};

pub use vector::{
    DbscanClustererAdapter, ModelRegistry, NativeModelDownloaderAdapter, PatternCache,
    SemanticEmbedderAdapter, TractOnnxEmbedderAdapter,
};
