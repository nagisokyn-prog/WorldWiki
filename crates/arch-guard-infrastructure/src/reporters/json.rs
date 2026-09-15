use arch_guard_domain::Violation;
use arch_guard_ports::ReportPublisherPort;

use serde::Serialize;
use std::fs;
use std::path::Path;

#[derive(Serialize)]
struct JsonReport<'a> {
    version: &'static str,
    total_violations: usize,
    violations: &'a [Violation],
}

pub struct JsonReportAdapter;

impl JsonReportAdapter {
    pub fn write_report(path: &Path, violations: &[Violation]) -> Result<(), String> {
        let report = JsonReport {
            version: "1.0",
            total_violations: violations.len(),
            violations,
        };

        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create report directory: {}", e))?;
        }

        let json_str = serde_json::to_string_pretty(&report)
            .map_err(|e| format!("Failed to serialize report: {}", e))?;

        fs::write(path, json_str)
            .map_err(|e| format!("Failed to write report to {}: {}", path.display(), e))?;

        Ok(())
    }
}

impl ReportPublisherPort for JsonReportAdapter {
    fn publish_violations(&self, _violations: &[Violation]) -> Result<(), String> {
        Ok(())
    }

    fn export_report(&self, target_path: &Path, violations: &[Violation]) -> Result<(), String> {
        Self::write_report(target_path, violations)
    }
}
