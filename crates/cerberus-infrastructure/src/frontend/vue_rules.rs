use cerberus_domain::{compute_fingerprint, Category, Severity, Violation};

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

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_vue_rule_checker_tauri_import_vue002() {
        let sfc = VueSfc {
            script_setup: Some("import { invoke } from '@tauri-apps/api/core';".into()),
            ..Default::default()
        };
        let violations = VueRuleChecker::check(&sfc, Path::new("src/Component.vue"));
        assert_eq!(violations.len(), 1);
        assert_eq!(violations[0].rule_id, "VUE-002");
    }

    #[test]
    fn test_vue_rule_checker_bloated_script_setup_vue001() {
        let temp = tempdir().unwrap();
        let comp_path = temp.path().join("MyComponent.vue");

        // Bloated script setup > 35 lines with ref / computed and NO companion hook
        let mut heavy_lines = vec!["const a = ref(1);", "const b = computed(() => 2);"];
        heavy_lines.extend(vec!["console.log('line');"; 40]);
        let sfc = VueSfc {
            script_setup: Some(heavy_lines.join("\n")),
            script_setup_start_line: 1,
            ..Default::default()
        };

        let violations = VueRuleChecker::check(&sfc, &comp_path);
        assert_eq!(violations.len(), 1);
        assert_eq!(violations[0].rule_id, "VUE-001");

        // Now add companion hook: useMyComponent.ts
        std::fs::write(temp.path().join("useMyComponent.ts"), "export const useMyComponent = () => {};").unwrap();
        let violations_with_hook = VueRuleChecker::check(&sfc, &comp_path);
        assert!(violations_with_hook.is_empty(), "Companion hook should satisfy VUE-001");

        // Test companion hook in hooks/ subdirectory
        std::fs::remove_file(temp.path().join("useMyComponent.ts")).unwrap();
        let hooks_dir = temp.path().join("hooks");
        std::fs::create_dir_all(&hooks_dir).unwrap();
        std::fs::write(hooks_dir.join("useMyComponent.ts"), "export const useMyComponent = () => {};").unwrap();
        assert!(VueRuleChecker::check(&sfc, &comp_path).is_empty(), "hooks/ companion hook should satisfy VUE-001");

        // Test plugin-shell Tauri violation
        let shell_sfc = VueSfc {
            script_setup: Some("import '@tauri-apps/plugin-shell';".into()),
            ..Default::default()
        };
        assert_eq!(VueRuleChecker::check(&shell_sfc, Path::new("MyComponent.vue")).len(), 1);
    }
}

