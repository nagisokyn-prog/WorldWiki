use arch_guard_domain::Violation;
use arch_guard_ports::ReportPublisherPort;

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
                        name: "cargo-arch-guard",
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

        let content = serde_json::to_string_pretty(&log)
            .map_err(|e| format!("Failed to serialize SARIF log: {}", e))?;

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
