use arch_guard_domain::Violation;
use std::path::Path;

pub trait ManifestParserPort: Send + Sync {
    fn check_manifest_layers(&self, workspace_root: &Path) -> Result<Vec<Violation>, String>;
}
