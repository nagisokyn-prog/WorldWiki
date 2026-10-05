use cerberus_domain::Violation;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone)]
pub struct SurqlScanRequest {
    pub surql_files: Vec<PathBuf>,
    pub rust_files: Vec<PathBuf>,
    pub workspace_root: PathBuf,
}

#[derive(Debug, Clone, Default)]
pub struct SurqlScanResult {
    pub violations: Vec<Violation>,
    pub scanned_surql_count: usize,
    pub scanned_rust_count: usize,
}

pub trait SurqlLinterPort: Send + Sync {
    fn scan(&self, request: &SurqlScanRequest) -> Result<SurqlScanResult, String>;
    fn scan_surql_content(&self, content: &str, file_path: &Path) -> Result<Vec<Violation>, String>;
}
