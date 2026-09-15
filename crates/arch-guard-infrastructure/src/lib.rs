pub mod ast;
pub mod frontend;
pub mod hooks;
pub mod parsers;
pub mod reporters;
pub mod storage;
pub mod taint;
pub mod vector;

pub use hooks::GitHooksInstaller;
pub use parsers::{RustSynParserAdapter, VueSfcParserAdapter};
pub use reporters::{ConsoleReportAdapter, JsonReportAdapter, SarifReportAdapter};
pub use storage::{
    FileStorageAdapter, KeyringStorageAdapter, MockStorageAdapter, RulesJsonRepository,
};
pub use vector::{DbscanClustererAdapter, PatternCache, SemanticEmbedderAdapter};

