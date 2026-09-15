use arch_guard_domain::{Severity, Violation};
use arch_guard_ports::ReportPublisherPort;

use colored::*;
use std::path::Path;

pub struct ConsoleReportAdapter;

impl ConsoleReportAdapter {
    pub fn print_violations(violations: &[Violation]) {
        if violations.is_empty() {
            println!("{}", "✅ [cargo-arch-guard] 0 architectural violations found. Clean build!".green().bold());
            return;
        }

        println!("{}", format!("⚠️  [cargo-arch-guard] Found {} architectural violation(s):", violations.len()).yellow().bold());
        println!("{}", "=".repeat(70));

        for (idx, v) in violations.iter().enumerate() {
            let severity_badge = match v.severity {
                Severity::Deny => "[DENY]".red().bold(),
                Severity::Warn => "[WARN]".yellow().bold(),
            };

            println!(
                "{} {} {} (v{})",
                format!("{}.", idx + 1).bold(),
                severity_badge,
                v.rule_id.cyan().bold(),
                v.rule_version
            );
            println!("  📍 File: {}:{}:{}", v.file.display().to_string().underline(), v.line, v.column);
            println!("  📌 Symbol: {}", v.symbol.bold());
            println!("  💬 Message: {}", v.message);
            if !v.snippet.is_empty() {
                println!("  📝 Code: {}", v.snippet.dimmed());
            }
            println!("  💡 Remediation: {}", v.remediation.green());
            println!("  🔑 Fingerprint: {}", v.fingerprint.dimmed());
            println!("{}", "-".repeat(70));
        }
    }
}

impl ReportPublisherPort for ConsoleReportAdapter {
    fn publish_violations(&self, violations: &[Violation]) -> Result<(), String> {
        Self::print_violations(violations);
        Ok(())
    }

    fn export_report(&self, _target_path: &Path, violations: &[Violation]) -> Result<(), String> {
        Self::print_violations(violations);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use arch_guard_domain::Category;
    use std::path::PathBuf;

    #[test]
    fn test_console_reporter_empty_and_with_violations() {
        let adapter = ConsoleReportAdapter;
        // 1. Empty
        assert!(adapter.publish_violations(&[]).is_ok());

        // 2. With violations
        let violations = vec![
            Violation {
                rule_id: "ARCH-001".into(),
                rule_version: "1.0".into(),
                category: Category::Architecture,
                severity: Severity::Deny,
                file: PathBuf::from("src/lib.rs"),
                line: 1,
                column: 1,
                symbol: "sym".into(),
                snippet: "use tauri;".into(),
                message: "msg".into(),
                remediation: "rem".into(),
                fingerprint: "fp".into(),
            },
            Violation {
                rule_id: "ARCH-021".into(),
                rule_version: "1.0".into(),
                category: Category::Architecture,
                severity: Severity::Warn,
                file: PathBuf::from("Cargo.toml"),
                line: 1,
                column: 1,
                symbol: "sym2".into(),
                snippet: "".into(),
                message: "warn".into(),
                remediation: "rem".into(),
                fingerprint: "fp2".into(),
            },
        ];
        assert!(adapter.publish_violations(&violations).is_ok());
        assert!(adapter.export_report(Path::new("dummy"), &violations).is_ok());
    }
}

