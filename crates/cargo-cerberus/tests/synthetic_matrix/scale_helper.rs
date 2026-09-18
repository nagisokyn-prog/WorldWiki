use crate::synthetic_matrix::generator_trait::SeededViolation;

pub struct ScaleHelper;

impl ScaleHelper {
    /// Generates structured Rust modules for a given crate and layer
    pub fn generate_rust_modules(
        crate_name: &str,
        layer: &str,
        target_sloc: usize,
        inject_violations: bool,
    ) -> (Vec<(String, String)>, Vec<SeededViolation>) {
        let lines_per_file = 150;
        let num_files = (target_sloc / lines_per_file).max(10);
        let mut files = Vec::with_capacity(num_files + 1);
        let mut violations = Vec::new();

        let group_size = 50;
        let num_groups = num_files.div_ceil(group_size);
        let mut lib_mods = Vec::with_capacity(num_groups);
        for g_idx in 0..num_groups {
            lib_mods.push(format!("pub mod group_{:02};", g_idx));
        }
        files.push((
            format!("{}/src/lib.rs", crate_name),
            format!("//! Crate '{}' layer '{}'\n{}\n", crate_name, layer, lib_mods.join("\n")),
        ));

        for g_idx in 0..num_groups {
            let start = g_idx * group_size;
            let end = (start + group_size).min(num_files);
            let mut group_mods = Vec::new();
            for f_idx in start..end {
                group_mods.push(format!("pub mod mod_{:03};", f_idx));
            }
            files.push((
                format!("{}/src/group_{:02}/mod.rs", crate_name, g_idx),
                format!("//! Group {:02}\n{}\n", g_idx, group_mods.join("\n")),
            ));
        }

        for f_idx in 0..num_files {
            let g_idx = f_idx / group_size;
            let file_name = format!("mod_{:03}.rs", f_idx);
            let mut content = String::with_capacity(3500);
            content.push_str("//! Auto-generated synthetic enterprise module\n\n");

            // Seeded violations
            if inject_violations {
                match layer {
                    "domain" | "core" | "entities" | "domain_core" => {
                        if f_idx % 8 == 0 {
                            content.push_str("use reqwest::Client;\n");
                            violations.push(SeededViolation {
                                rule_id: "ARCH-001".into(),
                                target_file_suffix: format!("{}/src/group_{:02}/{}", crate_name, g_idx, file_name),
                                description: format!("Domain crate '{}' cannot import 'reqwest'", crate_name),
                            });
                        }
                    }
                    "application" | "app" | "usecases" => {
                        if f_idx % 8 == 0 {
                            content.push_str("use tauri::command;\n");
                            violations.push(SeededViolation {
                                rule_id: "ARCH-002".into(),
                                target_file_suffix: format!("{}/src/group_{:02}/{}", crate_name, g_idx, file_name),
                                description: format!("Application crate '{}' cannot import 'tauri'", crate_name),
                            });
                        }
                    }
                    "infrastructure" | "infra" | "repository" => {
                        if f_idx % 10 == 0 {
                            content.push_str("use tauri::AppHandle;\n");
                            violations.push(SeededViolation {
                                rule_id: "ARCH-005".into(),
                                target_file_suffix: format!("{}/src/group_{:02}/{}", crate_name, g_idx, file_name),
                                description: format!("Infrastructure crate '{}' is not authorized to import 'tauri'", crate_name),
                            });
                        }
                    }
                    "commands" | "write" => {
                        if f_idx % 8 == 0 {
                            content.push_str("use crate::read_db::UserProjection;\n");
                            violations.push(SeededViolation {
                                rule_id: "CQRS-001".into(),
                                target_file_suffix: format!("{}/src/group_{:02}/{}", crate_name, g_idx, file_name),
                                description: "Write pipeline cannot import Read projection".into(),
                            });
                        }
                    }
                    "producer" if f_idx % 8 == 0 => {
                        content.push_str("use crate::consumer::on_order_event;\n");
                        violations.push(SeededViolation {
                            rule_id: "EVT-001".into(),
                            target_file_suffix: format!("{}/src/group_{:02}/{}", crate_name, g_idx, file_name),
                            description: "Event Producer cannot directly import Consumer".into(),
                        });
                    }
                    _ => {}
                }
            }

            // High-quality domain models, traits and business logic (~150 SLOC)
            content.push_str(&format!(
                "pub trait ServicePort_{} {{\n    fn process(&self, input: u64) -> Result<f64, String>;\n}}\n\n",
                f_idx
            ));

            for s_idx in 0..10 {
                content.push_str(&format!(
                    "#[derive(Debug, Clone)]\npub struct Record_{}_{} {{\n    pub id: u64,\n    pub score: f64,\n}}\n\nimpl Record_{}_{} {{\n    pub fn compute(&self) -> f64 {{\n        let mut acc = self.score;\n        for i in 0..5 {{\n            acc += (i as f64) * 1.5;\n        }}\n        acc\n    }}\n}}\n\n",
                    f_idx, s_idx, f_idx, s_idx
                ));
            }

            files.push((format!("{}/src/group_{:02}/{}", crate_name, g_idx, file_name), content));
        }

        (files, violations)
    }

    /// Generates structured Vue SFCs and TypeScript companion composables
    pub fn generate_vue_modules(
        app_dir: &str,
        target_sloc: usize,
        inject_violations: bool,
    ) -> (Vec<(String, String)>, Vec<SeededViolation>) {
        let lines_per_comp = 150;
        let num_comps = (target_sloc / lines_per_comp).max(10);
        let mut files = Vec::with_capacity(num_comps * 2 + 1);
        let mut violations = Vec::new();

        let slices = ["features", "widgets", "pages", "entities", "shared"];

        for idx in 0..num_comps {
            let slice = slices[idx % slices.len()];
            let comp_name = format!("Component_{:03}", idx);
            let vue_file = format!("{}.vue", comp_name);
            let ts_file = format!("use{}.ts", comp_name);
            let rel_vue = format!("{}/src/{}/{}/{}", app_dir, slice, comp_name, vue_file);
            let rel_ts = format!("{}/src/{}/{}/{}", app_dir, slice, comp_name, ts_file);

            let mut script_body = format!("import {{ use{} }} from './use{}';\n\nconst {{ count, label }} = use{}();\n", comp_name, comp_name, comp_name);
            let mut style_body = String::from(".box { padding: var(--spacing-md); color: var(--color-text-primary); }\n");

            if inject_violations {
                // VUE-001: Raw business logic functions inside <script setup>
                if idx % 6 == 0 {
                    for k in 0..10 {
                        script_body.push_str(&format!("function calc_{}() {{ return count.value * {}; }}\n", k, k));
                    }
                    violations.push(SeededViolation {
                        rule_id: "VUE-001".into(),
                        target_file_suffix: format!("{}/{}/{}", slice, comp_name, vue_file),
                        description: "Raw business logic functions in <script setup>".into(),
                    });
                }

                // CSS-004: Hex color hardcoding
                if idx % 7 == 0 {
                    style_body.push_str(".card_error { background: #ef4444; border: 1px solid #000000; }\n");
                    violations.push(SeededViolation {
                        rule_id: "CSS-004".into(),
                        target_file_suffix: format!("{}/{}/{}", slice, comp_name, vue_file),
                        description: "Hex color hardcoded in <style>".into(),
                    });
                }
            }

            let vue_content = format!(
                "<template>\n  <div class=\"box\">\n    <h2>{{ label }}</h2>\n    <button @click=\"count++\">{{ count }}</button>\n  </div>\n</template>\n\n<script setup lang=\"ts\">\n{}\n</script>\n\n<style scoped>\n{}\n</style>\n",
                script_body, style_body
            );

            let ts_content = format!(
                "//! Composable hook for {}\nimport {{ ref, computed }} from 'vue';\n\nexport function use{}() {{\n  const count = ref(0);\n  const label = 'Metric';\n  const doubled = computed(() => count.value * 2);\n  return {{ count, label, doubled }};\n}}\n",
                comp_name, comp_name
            );

            files.push((rel_vue, vue_content));
            files.push((rel_ts, ts_content));
        }

        (files, violations)
    }
}
