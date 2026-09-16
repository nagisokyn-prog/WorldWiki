use crate::scanner::ScannedSourceFile;
use arch_guard_domain::Violation;
use std::path::Path;

pub trait AstParserPort: Send + Sync {
    fn can_parse(&self, path: &Path) -> bool;
    fn parse_file(&self, path: &Path, crate_name: &str) -> Result<Vec<Violation>, String>;
}

pub trait AstEnginePort: Send + Sync {
    fn parse_batch(&self, files: &[ScannedSourceFile]) -> (Vec<Violation>, Vec<String>);
}

