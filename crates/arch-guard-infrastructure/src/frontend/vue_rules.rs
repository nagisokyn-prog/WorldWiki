use crate::domain::rules::{Category, Severity, Violation, compute_fingerprint};
use crate::frontend::sfc_parser::VueSfc;
use std::path::Path;

pub struct VueRuleChecker;

impl VueRuleChecker {
    pub fn check(sfc: &VueSfc, file_path: &Path) -> Vec<Violation> {
        let mut violations = Vec::new();
        let file_stem = file_path.file_stem().map_or("Component", |s| s.to_str().unwrap_or("Component"));
        let file_dir = file_path.parent();

        // 1. VUE-002: Tauri API isolation (no direct IPC in .vue)
        let full_script = format!(
            "{}\n{}",
            sfc.script.as_deref().unwrap_or(""),
            sfc.script_setup.as_deref().unwrap_or("")
        );

        if full_script.contains("@tauri-apps/api")
            || full_script.contains("@tauri-apps/plugin-shell")
            || full_script.contains("invoke(")
        {
            let snippet = full_script
                .lines()
                .filter(|l| l.contains("@tauri-apps/api") || l.contains("invoke("))
                .take(3)
                .collect::<Vec<_>>()
                .join("\n");

            let fingerprint = compute_fingerprint("VUE-002", "1.0", file_stem, &snippet);

            violations.push(Violation {
                rule_id: "VUE-002".into(),
                rule_version: "1.0".into(),
                category: Category::Architecture,
                severity: Severity::Deny,
                file: file_path.to_path_buf(),
                line: 1,
                column: 1,
                symbol: file_stem.to_string(),
                snippet,
                message: format!("Vue SFC '{}' directly calls Tauri IPC or imports @tauri-apps/api", file_path.display()),
                remediation: "Isolate Tauri IPC calls into a composable hook (use*.ts) or API Client service.".into(),
                fingerprint,
            });
        }

        // 2. VUE-001: Script Setup Purity & Companion Hook Check
        if let Some(script_setup) = &sfc.script_setup {
            let active_lines: Vec<&str> = script_setup
                .lines()
                .map(|l| l.trim())
                .filter(|l| !l.is_empty() && !l.starts_with("//") && !l.starts_with("/*"))
                .collect();

            if active_lines.len() > 35 {
                let has_heavy_logic = script_setup.contains("ref(")
                    || script_setup.contains("reactive(")
                    || script_setup.contains("computed(")
                    || script_setup.contains("watch(")
                    || script_setup.contains("function ");

                if has_heavy_logic {
                    let has_companion = if let Some(dir) = file_dir {
                        let companion1 = dir.join(format!("use{}.ts", file_stem));
                        let companion2 = dir.join("hooks").join(format!("use{}.ts", file_stem));
                        companion1.exists() || companion2.exists()
                    } else {
                        false
                    };

                    if !has_companion {
                        let snippet = active_lines.iter().take(5).copied().collect::<Vec<_>>().join("\n");
                        let fingerprint = compute_fingerprint("VUE-001", "1.0", file_stem, &snippet);

                        violations.push(Violation {
                            rule_id: "VUE-001".into(),
                            rule_version: "1.0".into(),
                            category: Category::Convention,
                            severity: Severity::Deny,
                            file: file_path.to_path_buf(),
                            line: sfc.script_setup_start_line,
                            column: 1,
                            symbol: file_stem.to_string(),
                            snippet,
                            message: format!(
                                "Vue component '{}' has bloated <script setup> ({} lines) without companion hook use{}.ts",
                                file_path.display(),
                                active_lines.len(),
                                file_stem
                            ),
                            remediation: format!("Extract state and methods into a companion composable use{}.ts.", file_stem),
                            fingerprint,
                        });
                    }
                }
            }
        }

        violations
    }
}
