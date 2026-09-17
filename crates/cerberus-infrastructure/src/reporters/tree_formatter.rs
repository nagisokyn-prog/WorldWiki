use cerberus_domain::{
    FileMetricsNode, HealthLevel, PackageNode, TreeItemNode, TreeReport,
};


use colored::*;

pub struct TreeFormatterAdapter;

impl TreeFormatterAdapter {
    pub fn render_console(report: &TreeReport) {
        println!("{}", Self::render_string(report));
    }

    pub fn render_string(report: &TreeReport) -> String {
        let mut out = String::new();

        out.push_str(&format!(
            "\n{}\n",
            "🏛️ ARCHITECTURAL TOPOLOGY & PRESSURE TREE".cyan().bold()
        ));
        out.push_str(&format!(
            "{}\n\n",
            "========================================================================================"
                .cyan()
        ));

        for pkg in &report.packages {
            out.push_str(&Self::format_package(pkg));
            out.push('\n');
        }

        // Summary
        out.push_str(&format!(
            "{}\n",
            "========================================================================================"
                .cyan()
        ));
        out.push_str(&format!("{}\n", "📊 TOTAL ARCHITECTURAL HEALTH SUMMARY:".green().bold()));

        let healthy_pct = if report.total_files > 0 {
            (report.healthy_count as f64 / report.total_files as f64) * 100.0
        } else {
            100.0
        };
        let warning_pct = if report.total_files > 0 {
            (report.warning_count as f64 / report.total_files as f64) * 100.0
        } else {
            0.0
        };
        let critical_pct = if report.total_files > 0 {
            (report.critical_count as f64 / report.total_files as f64) * 100.0
        } else {
            0.0
        };

        out.push_str(&format!("  • 📁 Total Files Scanned: {}\n", report.total_files));
        out.push_str(&format!(
            "  • ✅ Healthy Files:       {} ({:.1}%)\n",
            report.healthy_count.to_string().green(),
            healthy_pct
        ));
        out.push_str(&format!(
            "  • ⚠️  Warning Files:       {} ({:.1}%)\n",
            report.warning_count.to_string().yellow(),
            warning_pct
        ));
        out.push_str(&format!(
            "  • 🚨 Critical Hotspots:   {} ({:.1}%)\n",
            report.critical_count.to_string().red(),
            critical_pct
        ));
        out.push_str(&format!(
            "  • 📐 Avg Martin Distance: D_avg = {:.2} {}\n",
            report.avg_distance,
            if report.avg_distance < 0.35 {
                "(Optimal Architecture)".green()
            } else if report.avg_distance < 0.6 {
                "(Acceptable)".yellow()
            } else {
                "(Zone of Pain / High Instability)".red()
            }
        ));

        if !report.hotspots.is_empty() {
            out.push_str("\n🔥 Top Architectural Hotspots (High Pressure):\n");
            for (idx, hotspot) in report.hotspots.iter().take(5).enumerate() {

                out.push_str(&format!(
                    "   {}. 📄 {} (SLOC: {}, CC: {}, S_arch: {:.1})\n",
                    idx + 1,
                    hotspot.path.display().to_string().red().bold(),
                    hotspot.sloc,
                    hotspot.cyclomatic,
                    hotspot.pressure
                ));
            }
        }

        out
    }

    fn format_package(pkg: &PackageNode) -> String {
        let mut out = String::new();
        let zone_str = if pkg.is_zone_of_pain {
            "🚨 Zone of Pain".red().bold()
        } else if pkg.distance < 0.3 {
            "✅ Main Sequence".green()
        } else {
            "⚠️ Balanced".yellow()
        };

        out.push_str(&format!(
            "📦 crate: {} [Ca: {}, Ce: {} | I: {:.2}, A: {:.2} | D: {:.2} {}]\n",
            pkg.name.yellow().bold(),
            pkg.ca,
            pkg.ce,
            pkg.instability,
            pkg.abstractness,
            pkg.distance,
            zone_str
        ));

        let total_children = pkg.children.len();
        for (idx, child) in pkg.children.iter().enumerate() {
            let is_last = idx + 1 == total_children;
            let prefix = if is_last { "└── " } else { "├── " };
            let sub_prefix = if is_last { "    " } else { "│   " };
            out.push_str(&Self::format_item(child, prefix, sub_prefix));
        }

        out
    }

    fn format_item(item: &TreeItemNode, prefix: &str, sub_prefix: &str) -> String {
        let mut out = String::new();
        match item {
            TreeItemNode::File(file) => {
                out.push_str(&format!("{}{}\n", prefix, Self::format_file(file)));
            }
            TreeItemNode::Dir(dir) => {
                out.push_str(&format!("{}📁 {}\n", prefix, dir.name.blue().bold()));
                let total = dir.children.len();
                for (idx, child) in dir.children.iter().enumerate() {
                    let is_last = idx + 1 == total;
                    let next_prefix = format!("{}{}", sub_prefix, if is_last { "└── " } else { "├── " });
                    let next_sub = format!("{}{}", sub_prefix, if is_last { "    " } else { "│   " });
                    out.push_str(&Self::format_item(child, &next_prefix, &next_sub));
                }
            }
        }
        out
    }

    fn format_file(file: &FileMetricsNode) -> String {
        let badge = match file.health {
            HealthLevel::Healthy => "✅".green(),
            HealthLevel::Warning => "⚠️".yellow(),
            HealthLevel::Critical => "🚨 [HIGH PRESSURE]".red().bold(),
        };

        let metrics_tuple = format!(
            "[SLOC: {:>4} | Fn: {:>3} | CC: {:>3} | Dep: {:>3}]",
            file.sloc, file.functions, file.cyclomatic, file.dependencies
        );

        format!(
            "📄 {:<24} {} ──► S_arch: {:>6.1} {}",
            file.name,
            metrics_tuple.cyan(),
            file.pressure,
            badge
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use cerberus_domain::DirNode;
    use std::path::PathBuf;


    #[test]
    fn test_tree_formatter_render() {
        let file = FileMetricsNode {
            name: "lib.rs".into(),
            path: PathBuf::from("src/lib.rs"),
            sloc: 120,
            functions: 8,
            cyclomatic: 5,
            dependencies: 3,
            ast_depth: 3,
            pressure: 34.5,
            health: HealthLevel::Healthy,
        };

        let pkg = PackageNode {
            name: "test_crate".into(),
            path: PathBuf::from("crates/test_crate"),
            ca: 1,
            ce: 2,
            instability: 0.67,
            abstractness: 0.10,
            distance: 0.23,
            is_zone_of_pain: false,
            children: vec![TreeItemNode::File(file)],
        };

        let report = TreeReport::new(vec![pkg]);
        let output = TreeFormatterAdapter::render_string(&report);

        assert!(output.contains("ARCHITECTURAL TOPOLOGY & PRESSURE TREE"));
        assert!(output.contains("test_crate"));
        assert!(output.contains("lib.rs"));
        assert!(output.contains("S_arch"));

        // Test render_console
        TreeFormatterAdapter::render_console(&report);
    }

    #[test]
    fn test_tree_formatter_zone_of_pain_and_hotspots() {
        let crit_file = FileMetricsNode {
            name: "heavy.rs".into(),
            path: PathBuf::from("src/heavy.rs"),
            sloc: 750,
            functions: 45,
            cyclomatic: 55,
            dependencies: 20,
            ast_depth: 9,
            pressure: 450.0,
            health: HealthLevel::Critical,
        };

        let warn_file = FileMetricsNode {
            name: "warn.rs".into(),
            path: PathBuf::from("src/sub/warn.rs"),
            sloc: 350,
            functions: 18,
            cyclomatic: 15,
            dependencies: 8,
            ast_depth: 4,
            pressure: 180.0,
            health: HealthLevel::Warning,
        };

        let sub_dir = DirNode {
            name: "sub".into(),
            path: PathBuf::from("src/sub"),
            children: vec![TreeItemNode::File(warn_file)],
        };

        // Zone of Pain package
        let pkg1 = PackageNode {
            name: "pain_crate".into(),
            path: PathBuf::from("crates/pain_crate"),
            ca: 10,
            ce: 1,
            instability: 0.09,
            abstractness: 0.05,
            distance: 0.86,
            is_zone_of_pain: true,
            children: vec![
                TreeItemNode::File(crit_file),
                TreeItemNode::Dir(sub_dir),
            ],
        };

        // Acceptable warning distance package
        let pkg2 = PackageNode {
            name: "warn_crate".into(),
            path: PathBuf::from("crates/warn_crate"),
            ca: 2,
            ce: 3,
            instability: 0.60,
            abstractness: 0.10,
            distance: 0.50,
            is_zone_of_pain: false,
            children: vec![],
        };

        let report = TreeReport::new(vec![pkg1, pkg2]);
        let output = TreeFormatterAdapter::render_string(&report);

        assert!(output.contains("Zone of Pain"));
        assert!(output.contains("Top Architectural Hotspots"));
        assert!(output.contains("heavy.rs"));
        assert!(output.contains("sub"));
        assert!(output.contains("warn.rs"));

        // Test completely empty report
        let empty = TreeReport::new(vec![]);
        let empty_output = TreeFormatterAdapter::render_string(&empty);
        assert!(empty_output.contains("Total Files Scanned: 0"));
    }
}

