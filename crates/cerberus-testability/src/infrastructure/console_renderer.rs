use colored::Colorize;
use crate::domain::archetype::TestabilityArchetype;
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
        out.push_str(&"=".repeat(110));
        out.push('\n');

        out.push_str(&format!(
            "{:<42} {:<10} {:<10} {:>5} {:>7} {:>7} {:>7} {:>6}\n",
            "File", "Layer", "Archetype", "SLOC", "T_unit", "T_int", "Score", "Tier"
        ));
        out.push_str(&"-".repeat(110));
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

            let arch_str = match file.archetype {
                TestabilityArchetype::Pure => "Pure".green(),
                TestabilityArchetype::Mockable => "Mockable".cyan(),
                TestabilityArchetype::IntBound => "IntBound".yellow(),
                TestabilityArchetype::Flaky => "Flaky".magenta(),
                TestabilityArchetype::Poisoned => "Poisoned".red().bold(),
            };

            let file_display = if file.file_path.len() > 40 {
                format!("...{}", &file.file_path[file.file_path.len() - 37..])
            } else {
                file.file_path.clone()
            };

            out.push_str(&format!(
                "{:<42} {:<10} {:<10} {:>5} {:>7.1} {:>7.1} {:>7.1} {:>6}\n",
                file_display,
                file.layer.as_str(),
                arch_str,
                file.sloc,
                file.t_unit,
                file.t_integration,
                file.t_composite,
                tier_str
            ));
        }

        out.push_str(&"-".repeat(110));
        out.push('\n');

        let ws_tier_str = match report.workspace_tier {
            TestabilityTier::S => "Tier S - Production Ready (Clean)".green().bold(),
            TestabilityTier::A => "Tier A - High Testability".cyan().bold(),
            TestabilityTier::B => "Tier B - Moderate Test Friction".yellow().bold(),
            TestabilityTier::C => "Tier C - Significant Test Friction".yellow(),
            TestabilityTier::D => "Tier D - High Mutation / Concurrency Risk".red(),
            TestabilityTier::F => "Tier F - Critical Untestable Spaghetti".red().bold(),
        };

        let p_pure = report.archetype_percentages.get(&TestabilityArchetype::Pure).unwrap_or(&0.0);
        let p_mock = report.archetype_percentages.get(&TestabilityArchetype::Mockable).unwrap_or(&0.0);
        let p_int = report.archetype_percentages.get(&TestabilityArchetype::IntBound).unwrap_or(&0.0);
        let p_flaky = report.archetype_percentages.get(&TestabilityArchetype::Flaky).unwrap_or(&0.0);
        let p_poison = report.archetype_percentages.get(&TestabilityArchetype::Poisoned).unwrap_or(&0.0);

        out.push_str(&format!(
            "WORKSPACE TESTABILITY HEALTH: {:.1} / 100 ({}) [T_unit: {:.1}, T_int: {:.1}]\n",
            report.workspace_score, ws_tier_str, report.workspace_t_unit, report.workspace_t_integration
        ));
        out.push_str(&format!(
            "Archetype Distribution: Pure: {:.1}% | Mockable: {:.1}% | IntBound: {:.1}% | Flaky: {:.1}% | Poisoned: {:.1}%\n",
            p_pure, p_mock, p_int, p_flaky, p_poison
        ));
        out.push_str(&format!(
            "Evaluated Files: {} | Tier Breakdown: S:{}, A:{}, B:{}, C:{}, D:{}, F:{}\n",
            report.total_files,
            report.tier_counts.get(&TestabilityTier::S).unwrap_or(&0),
            report.tier_counts.get(&TestabilityTier::A).unwrap_or(&0),
            report.tier_counts.get(&TestabilityTier::B).unwrap_or(&0),
            report.tier_counts.get(&TestabilityTier::C).unwrap_or(&0),
            report.tier_counts.get(&TestabilityTier::D).unwrap_or(&0),
            report.tier_counts.get(&TestabilityTier::F).unwrap_or(&0),
        ));
        out.push_str(&"=".repeat(110));
        out.push('\n');

        out
    }

    pub fn render_json(report: &WorkspaceTestabilityReport) -> Result<String, serde_json::Error> {
        serde_json::to_string_pretty(report)
    }
}
