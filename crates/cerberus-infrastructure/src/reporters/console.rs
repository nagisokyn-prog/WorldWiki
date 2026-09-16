use cerberus_domain::{PackageMetrics, Severity, Violation};
use cerberus_ports::ReportPublisherPort;

use colored::*;
use std::path::Path;

pub struct ConsoleReportAdapter;

impl ConsoleReportAdapter {
    pub fn print_violations(violations: &[Violation]) {
        if violations.is_empty() {
            println!("{}", "✅ [cargo-cerberus] 0 architectural violations found. Clean build!".green().bold());
            return;
        }

        println!("{}", format!("⚠️  [cargo-cerberus] Found {} architectural violation(s):", violations.len()).yellow().bold());
        println!("{}", "=".repeat(70));

        for (idx, v) in violations.iter().enumerate() {
            let severity_badge = match v.severity {
                Severity::Deny => "[DENY]".red().bold(),
                Severity::Warn => "[WARN]".yellow().bold(),
                Severity::Off => "[OFF]".dimmed(),
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

    pub fn print_martin_metrics(metrics: &[PackageMetrics]) {
        if metrics.is_empty() {
            return;
        }

        println!("\n{}", "──────────────────────────────────────────────────────────────────────────".dimmed());
        println!("{}", "📊 MARTIN PACKAGE METRICS (I, A, D) & ARCHITECTURAL TOPOLOGY".bold());
        println!("{}", "──────────────────────────────────────────────────────────────────────────".dimmed());
        println!(
            "{:<24} {:>4} {:>4} {:>10} {:>10} {:>12} {:>14}",
            "Package", "Ca", "Ce", "I (Instab)", "A (Abstr)", "D (Distance)", "Zone of Pain"
        );
        println!("{}", "-".repeat(82));

        for m in metrics {
            let status = if m.in_zone_of_pain {
                "⚠️ PAIN".red().bold()
            } else if m.distance_from_main_sequence > 0.7 {
                "🟡 High D".yellow()
            } else {
                "✅ Clean".green()
            };

            println!(
                "{:<24} {:>4} {:>4} {:>10.2} {:>10.2} {:>12.2} {:>14}",
                m.package_name.bold(),
                m.afferent_coupling,
                m.efferent_coupling,
                m.instability,
                m.abstractness,
                m.distance_from_main_sequence,
                status
            );
        }
        println!("{}\n", "──────────────────────────────────────────────────────────────────────────".dimmed());
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
    use cerberus_domain::Category;
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

    #[test]
    fn test_console_reporter_martin_metrics() {
        let metrics = vec![
            PackageMetrics::compute("worldwiki-domain".into(), 4, 0, 8, 10),
            PackageMetrics::compute("worldwiki-god".into(), 5, 0, 0, 10),
        ];
        ConsoleReportAdapter::print_martin_metrics(&metrics);
        ConsoleReportAdapter::print_martin_metrics(&[]);
    }
}
