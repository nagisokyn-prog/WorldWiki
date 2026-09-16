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

        let json_str = serde_json::to_string_pretty(&report).unwrap_or_default();

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

#[cfg(test)]
mod tests {
    use super::*;
    use arch_guard_domain::{Category, Severity};
    use std::path::PathBuf;
    use tempfile::tempdir;

    #[test]
    fn test_json_report_export_success() {
        let temp = tempdir().unwrap();
        let report_file = temp.path().join("sub/dir/report.json");

        let violations = vec![Violation {
            rule_id: "ARCH-001".into(),
            rule_version: "1.0".into(),
            category: Category::Architecture,
            severity: Severity::Deny,
            file: PathBuf::from("src/lib.rs"),
            line: 1,
            column: 1,
            symbol: "use_tauri".into(),
            snippet: "use tauri;".into(),
            message: "msg".into(),
            remediation: "rem".into(),
            fingerprint: "fp".into(),
        }];

        let adapter = JsonReportAdapter;
        let port: &dyn ReportPublisherPort = &adapter;
        port.export_report(&report_file, &violations).unwrap();
        assert!(report_file.exists());

        let content = fs::read_to_string(&report_file).unwrap();
        assert!(content.contains("\"total_violations\": 1"));
        assert!(content.contains("\"rule_id\": \"ARCH-001\""));

        assert!(port.publish_violations(&violations).is_ok());

        // Direct call
        let direct_file = temp.path().join("sub/dir/direct.json");
        assert!(JsonReportAdapter::write_report(&direct_file, &violations).is_ok());
    }

    #[test]
    fn test_json_report_export_failure() {
        let temp = tempdir().unwrap();
        let invalid_path = temp.path().join("dir_exists");
        fs::create_dir_all(&invalid_path).unwrap();

        let adapter = JsonReportAdapter;
        let res = adapter.export_report(&invalid_path, &[]);
        assert!(res.is_err());

        // Parent dir creation failure: create file as parent
        let blocker = temp.path().join("blocker_file");
        fs::write(&blocker, "blocking").unwrap();
        let bad_parent_path = blocker.join("nested/report.json");
        assert!(JsonReportAdapter::write_report(&bad_parent_path, &[]).is_err());
    }
}


