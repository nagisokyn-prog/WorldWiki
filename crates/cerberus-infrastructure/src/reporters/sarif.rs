use cerberus_domain::Violation;
use cerberus_ports::ReportPublisherPort;

use serde::Serialize;
use std::fs;
use std::path::Path;

#[derive(Serialize)]
struct SarifLog<'a> {
    #[serde(rename = "$schema")]
    schema: &'static str,
    version: &'static str,
    runs: Vec<SarifRun<'a>>,
}

#[derive(Serialize)]
struct SarifRun<'a> {
    tool: SarifTool,
    results: Vec<SarifResult<'a>>,
}

#[derive(Serialize)]
struct SarifTool {
    driver: SarifDriver,
}

#[derive(Serialize)]
struct SarifDriver {
    name: &'static str,
    version: &'static str,
}

#[derive(Serialize)]
struct SarifResult<'a> {
    #[serde(rename = "ruleId")]
    rule_id: &'a str,
    message: SarifMessage<'a>,
    locations: Vec<SarifLocation<'a>>,
}

#[derive(Serialize)]
struct SarifMessage<'a> {
    text: &'a str,
}

#[derive(Serialize)]
struct SarifLocation<'a> {
    #[serde(rename = "physicalLocation")]
    physical_location: SarifPhysicalLocation<'a>,
}

#[derive(Serialize)]
struct SarifPhysicalLocation<'a> {
    #[serde(rename = "artifactLocation")]
    artifact_location: SarifArtifactLocation<'a>,
    region: SarifRegion,
}

#[derive(Serialize)]
struct SarifArtifactLocation<'a> {
    uri: String,
    #[serde(skip)]
    _phantom: std::marker::PhantomData<&'a ()>,
}

#[derive(Serialize)]
struct SarifRegion {
    #[serde(rename = "startLine")]
    start_line: usize,
    #[serde(rename = "startColumn")]
    start_column: usize,
}

pub struct SarifReportAdapter;

impl SarifReportAdapter {
    pub fn write_report(path: &Path, violations: &[Violation]) -> Result<(), String> {
        let results = violations
            .iter()
            .map(|v| SarifResult {
                rule_id: &v.rule_id,
                message: SarifMessage { text: &v.message },
                locations: vec![SarifLocation {
                    physical_location: SarifPhysicalLocation {
                        artifact_location: SarifArtifactLocation {
                            uri: v.file.to_string_lossy().replace('\\', "/"),
                            _phantom: std::marker::PhantomData,
                        },
                        region: SarifRegion {
                            start_line: v.line,
                            start_column: v.column,
                        },
                    },
                }],
            })
            .collect();

        let log = SarifLog {
            schema: "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
            version: "2.1.0",
            runs: vec![SarifRun {
                tool: SarifTool {
                    driver: SarifDriver {
                        name: "cargo-cerberus",
                        version: "0.1.0",
                    },
                },
                results,
            }],
        };

        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create SARIF dir: {}", e))?;
        }

        let content = serde_json::to_string_pretty(&log).unwrap_or_default();

        fs::write(path, content)
            .map_err(|e| format!("Failed to write SARIF to {}: {}", path.display(), e))?;

        Ok(())
    }
}

impl ReportPublisherPort for SarifReportAdapter {
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
    use cerberus_domain::{Category, Severity};
    use std::path::PathBuf;
    use tempfile::tempdir;

    #[test]
    fn test_sarif_report_export_success() {
        let temp = tempdir().unwrap();
        let report_file = temp.path().join("sub/sarif/report.sarif");

        let violations = vec![Violation {
            rule_id: "ARCH-001".into(),
            rule_version: "1.0".into(),
            category: Category::Architecture,
            severity: Severity::Deny,
            file: PathBuf::from("src/domain/entity.rs"),
            line: 12,
            column: 4,
            symbol: "use_tauri".into(),
            snippet: "use tauri;".into(),
            message: "Domain violation".into(),
            remediation: "Move to ports".into(),
            fingerprint: "fp".into(),
        }];

        let adapter = SarifReportAdapter;
        let port: &dyn ReportPublisherPort = &adapter;
        port.export_report(&report_file, &violations).unwrap();
        assert!(report_file.exists());

        let content = fs::read_to_string(&report_file).unwrap();
        assert!(content.contains("sarif-schema-2.1.0"));
        assert!(content.contains("ARCH-001"));
        assert!(content.contains("src/domain/entity.rs"));

        // Test publish_violations (no-op implementation)
        assert!(port.publish_violations(&violations).is_ok());

        // Direct call
        let direct_file = temp.path().join("sub/sarif/direct.sarif");
        assert!(SarifReportAdapter::write_report(&direct_file, &violations).is_ok());
    }

    #[test]
    fn test_sarif_report_export_failure() {
        let temp = tempdir().unwrap();
        let invalid_path = temp.path().join("dir_exists");
        fs::create_dir_all(&invalid_path).unwrap();

        // Attempting to write a file over an existing directory path should fail
        let adapter = SarifReportAdapter;
        let res = adapter.export_report(&invalid_path, &[]);
        assert!(res.is_err());

        // Parent dir creation failure
        let blocker = temp.path().join("blocker_file");
        fs::write(&blocker, "blocking").unwrap();
        let bad_parent_path = blocker.join("nested/report.sarif");
        assert!(SarifReportAdapter::write_report(&bad_parent_path, &[]).is_err());
    }
}


