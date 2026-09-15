use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ScanScope {
    All,
    FrontendOnly,
    BackendOnly,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ScannedSourceFile {
    pub path: PathBuf,
    pub crate_name: String,
}

pub trait FileSystemScannerPort: Send + Sync {
    fn scan_files(&self, root_dir: &Path, scope: ScanScope) -> Vec<ScannedSourceFile>;
}

