use crate::domain::rules::{Severity, Violation};
use crate::ports::reporter::ReportPublisherPort;
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
