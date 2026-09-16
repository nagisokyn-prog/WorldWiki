use cerberus_domain::{
    compute_fingerprint, Category, Severity, Violation,
};
use std::collections::{HashMap, HashSet};
use std::path::PathBuf;

#[derive(Default)]
pub struct BlastRadiusAnalyzer;

impl BlastRadiusAnalyzer {
    pub fn new() -> Self {
        Self
    }

    /// Analyze module fan-in blast radius and detect God Objects
    /// `file_imports`: file_path -> set of imported module names or file paths
    pub fn analyze_blast_radius(
        all_files: &[PathBuf],
        file_imports: &HashMap<PathBuf, HashSet<String>>,
    ) -> Vec<Violation> {
        let total_files = all_files.len();
        if total_files < 5 {
            return Vec::new();
        }

        let mut fan_in_counts: HashMap<String, usize> = HashMap::new();

        for imports in file_imports.values() {
            for imp in imports {
                let count = fan_in_counts.entry(imp.clone()).or_insert(0);
                *count += 1;
            }
        }

        let mut violations = Vec::new();

        for file in all_files {
            let file_stem = file
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .to_string();

            let fan_in = *fan_in_counts.get(&file_stem).unwrap_or(&0);
            let fan_in_pct = (fan_in as f64) / (total_files as f64) * 100.0;

            if fan_in_pct >= 80.0 {
                let snippet = format!(
                    "Module '{}' is imported by {} of {} files ({:.1}% Fan-In)",
                    file_stem, fan_in, total_files, fan_in_pct
                );
                let fingerprint = compute_fingerprint("ARCH-040", "1.0", &file_stem, &snippet);

                violations.push(Violation {
                    rule_id: "ARCH-040".into(),
                    rule_version: "1.0".into(),
                    category: Category::Architecture,
                    severity: Severity::Warn,
                    file: file.clone(),
                    line: 1,
                    column: 1,
                    symbol: file_stem,
                    snippet,
                    message: format!(
                        "God Object Detected: Architectural Blast Radius is {:.1}% (imported by {}/{} files). Any change risks system-wide regression.",
                        fan_in_pct, fan_in, total_files
                    ),
                    remediation: "Split God Object into cohesive submodules and domain event contracts to reduce blast radius.".into(),
                    fingerprint,
                });
            }
        }

        violations
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_blast_radius_analyzer_god_object() {
        let files = vec![
            PathBuf::from("src/god.rs"),
            PathBuf::from("src/f1.rs"),
            PathBuf::from("src/f2.rs"),
            PathBuf::from("src/f3.rs"),
            PathBuf::from("src/f4.rs"),
            PathBuf::from("src/f5.rs"),
        ];

        let mut imports = HashMap::new();
        let mut god_set = HashSet::new();
        god_set.insert("god".to_string());

        for f in &files[1..] {
            imports.insert(f.clone(), god_set.clone());
        }

        let violations = BlastRadiusAnalyzer::analyze_blast_radius(&files, &imports);
        assert_eq!(violations.len(), 1);
        assert_eq!(violations[0].rule_id, "ARCH-040");
        assert_eq!(violations[0].symbol, "god");

        // Test with too few files (less than 5)
        let small_files = vec![PathBuf::from("src/god.rs"), PathBuf::from("src/f1.rs")];
        assert!(BlastRadiusAnalyzer::analyze_blast_radius(&small_files, &imports).is_empty());

        // Test new & default
        let _analyzer = BlastRadiusAnalyzer::new();
        let _def_analyzer = BlastRadiusAnalyzer;
    }
}
