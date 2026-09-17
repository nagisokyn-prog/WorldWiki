use colored::Colorize;
use crate::domain::score::{TestabilityTier, WorkspaceTestabilityReport};

pub struct ConsoleTestabilityRenderer;

impl ConsoleTestabilityRenderer {
    #[must_use]
    pub fn render_report(report: &WorkspaceTestabilityReport) -> String {
        let mut out = String::new();

        out.push_str(&format!(
            "\n{}\n",
            "CERBERUS ARCHITECTURAL FIREWALL: TESTABILITY INDEX REPORT"
                .bold()
                .cyan()
        ));
        out.push_str(&"=".repeat(100));
        out.push('\n');

        out.push_str(&format!(
            "{:<48} {:<10} {:>6} {:>10} {:>8} {:>8} {:>8} {:>6}\n",
            "File", "Layer", "SLOC", "Frictions", "T_unit", "T_int", "Score", "Tier"
        ));
        out.push_str(&"-".repeat(100));
        out.push('\n');

        for file in &report.files {
            let tier_str = match file.tier {
                TestabilityTier::S => "[S]".green().bold(),
                TestabilityTier::A => "[A]".cyan().bold(),
                TestabilityTier::B => "[B]".yellow().bold(),
                TestabilityTier::C => "[C]".yellow(),
                TestabilityTier::D => "[D]".red(),
                TestabilityTier::F => "[F]".red().bold(),
            };

            let frictions_count = if file.frictions.is_empty() {
                "0".normal()
            } else {
                format!("{}", file.frictions.len()).yellow().bold()
            };

            let file_display = if file.file_path.len() > 46 {
                format!("...{}", &file.file_path[file.file_path.len() - 43..])
            } else {
                file.file_path.clone()
            };

            out.push_str(&format!(
                "{:<48} {:<10} {:>6} {:>10} {:>8.1} {:>8.1} {:>8.1} {:>6}\n",
                file_display,
                file.layer.as_str(),
                file.sloc,
                frictions_count,
                file.t_unit,
                file.t_integration,
                file.t_composite,
                tier_str
            ));
        }

        out.push_str(&"-".repeat(100));
        out.push('\n');

        let total_frictions: usize = report.files.iter().map(|f| f.frictions.len()).sum();
        let ws_tier_str = match report.workspace_tier {
            TestabilityTier::S => "Tier S - Production Ready (Clean)".green().bold(),
            TestabilityTier::A => "Tier A - High Testability".cyan().bold(),
            TestabilityTier::B => "Tier B - Moderate Test Friction".yellow().bold(),
            TestabilityTier::C => "Tier C - Significant Test Friction".yellow(),
            TestabilityTier::D => "Tier D - High Mutation / Concurrency Risk".red(),
            TestabilityTier::F => "Tier F - Critical Untestable Spaghetti".red().bold(),
        };

        out.push_str(&format!(
            "WORKSPACE TESTABILITY HEALTH: {:.1} / 100 ({})\n",
            report.workspace_score, ws_tier_str
        ));
        out.push_str(&format!(
            "Evaluated Files: {} | Total Friction Points: {} | Tier Breakdown: S:{}, A:{}, B:{}, C:{}, D:{}, F:{}\n",
            report.total_files,
            total_frictions,
            report.tier_counts.get(&TestabilityTier::S).unwrap_or(&0),
            report.tier_counts.get(&TestabilityTier::A).unwrap_or(&0),
            report.tier_counts.get(&TestabilityTier::B).unwrap_or(&0),
            report.tier_counts.get(&TestabilityTier::C).unwrap_or(&0),
            report.tier_counts.get(&TestabilityTier::D).unwrap_or(&0),
            report.tier_counts.get(&TestabilityTier::F).unwrap_or(&0),
        ));
        out.push_str(&"=".repeat(100));
        out.push('\n');

        out
    }

    pub fn render_json(report: &WorkspaceTestabilityReport) -> Result<String, serde_json::Error> {
        serde_json::to_string_pretty(report)
    }
}
