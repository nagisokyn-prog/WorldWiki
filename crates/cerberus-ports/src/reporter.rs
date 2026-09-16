use arch_guard_domain::Violation;
use std::path::Path;

pub trait ReportPublisherPort: Send + Sync {
    fn publish_violations(&self, violations: &[Violation]) -> Result<(), String>;
    fn export_report(&self, target_path: &Path, violations: &[Violation]) -> Result<(), String>;
}
