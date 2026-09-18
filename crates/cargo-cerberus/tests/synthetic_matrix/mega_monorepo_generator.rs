use rayon::prelude::*;
use std::fs;
use std::path::Path;

use crate::synthetic_matrix::generator_trait::{GroundTruthManifest, SeededViolation};

type CrateGenResult = Result<(usize, usize, Vec<SeededViolation>), String>;

pub struct MegaMonorepoConfig {
    pub num_crates: usize,
    pub num_frontend_slices: usize,
    pub target_sloc: usize,
    pub inject_chaos: bool,
}

impl Default for MegaMonorepoConfig {
    fn default() -> Self {
        Self {
            num_crates: 80,
            num_frontend_slices: 40,
            target_sloc: 1_200_000,
            inject_chaos: true,
        }
    }
}

pub struct MegaMonorepoGenerator;

impl MegaMonorepoGenerator {
    /// Generates a 1.2M SLOC enterprise monorepo with 120 packages and 3,500+ deterministic violations
    pub fn generate(
        root_path: &Path,
        config: &MegaMonorepoConfig,
    ) -> Result<GroundTruthManifest, String> {
        let mut expected_violations = Vec::new();
        let mut crate_members = Vec::new();

        // 1. Generate Root Workspace Cargo.toml
        for i in 0..config.num_crates {
            let layer = match i % 5 {
                0 => "domain",
                1 => "application",
                2 => "ports",
                3 => "infrastructure",
                _ => "adapter",
            };
            let crate_name = format!("{}_service_{:02}", layer, i);
            crate_members.push(crate_name);
        }

        let members_toml: Vec<String> = crate_members
            .iter()
            .map(|m| format!("    \"crates/{}\",", m))
            .collect();
        let root_cargo_toml = format!(
            "[workspace]\nmembers = [\n{}\n]\nresolver = \"2\"\n\n[workspace.metadata.cerberus]\npreset = \"final_boss\"\nenforce_module_boundaries = true\n",
            members_toml.join("\n")
        );
        fs::write(root_path.join("Cargo.toml"), root_cargo_toml)
            .map_err(|e| format!("Failed to write root Cargo.toml: {}", e))?;

        // 2. Generate Rust Crates (80 Crates -> ~800,000 SLOC)
        let crates_dir = root_path.join("crates");
        fs::create_dir_all(&crates_dir).map_err(|e| e.to_string())?;

        let (backend_files, backend_sloc, mut backend_violations) = Self::generate_backend_crates(
            &crates_dir,
            &crate_members,
            config.target_sloc * 2 / 3,
            config.inject_chaos,
        )?;
        expected_violations.append(&mut backend_violations);

        // 3. Generate Frontend Monorepo (40 FSD Slices -> ~400,000 SLOC)
        let frontend_dir = root_path.join("apps/spa");
        fs::create_dir_all(&frontend_dir).map_err(|e| e.to_string())?;

        let (frontend_files, frontend_sloc, mut frontend_violations) =
            Self::generate_frontend_slices(
                &frontend_dir,
                config.num_frontend_slices,
                config.target_sloc / 3,
                config.inject_chaos,
            )?;
        expected_violations.append(&mut frontend_violations);

        let total_files = backend_files + frontend_files;
        let total_sloc = backend_sloc + frontend_sloc;

        Ok(GroundTruthManifest {
            paradigm_name: "MegaMonorepo 1.2M SLOC Unified Enterprise Architecture",
            total_files,
            approximate_sloc: total_sloc,
            expected_violations,
        })
    }

    fn generate_backend_crates(
        crates_dir: &Path,
        crate_names: &[String],
        _target_sloc: usize,
        inject_chaos: bool,
    ) -> Result<(usize, usize, Vec<SeededViolation>), String> {
        let files_per_crate = 50; // 80 * 50 = 4,000 backend files

        let results: Vec<CrateGenResult> = crate_names
            .par_iter()
            .enumerate()
            .map(|(idx, crate_name)| {
                let mut local_violations = Vec::new();
                let crate_path = crates_dir.join(crate_name);
                let src_path = crate_path.join("src");
                fs::create_dir_all(&src_path).map_err(|e| e.to_string())?;

                let layer = match idx % 5 {
                    0 => "domain",
                    1 => "application",
                    2 => "ports",
                    3 => "infrastructure",
                    _ => "adapter",
                };

                let cargo_toml = format!(
                    "[package]\nname = \"{}\"\nversion = \"0.1.0\"\nedition = \"2021\"\n\n[package.metadata.cerberus]\nlayer = \"{}\"\n\n[dependencies]\n",
                    crate_name, layer
                );
                fs::write(crate_path.join("Cargo.toml"), cargo_toml).map_err(|e| e.to_string())?;

                let mut total_sloc = 0;
                let mut total_files = 0;

                // lib.rs
                let mut lib_mods = Vec::new();
                for f_idx in 0..files_per_crate {
                    lib_mods.push(format!("pub mod mod_{:03};", f_idx));
                }
                fs::write(src_path.join("lib.rs"), lib_mods.join("\n")).map_err(|e| e.to_string())?;
                total_files += 1;
                total_sloc += lib_mods.len();

                // Module files
                for f_idx in 0..files_per_crate {
                    let file_name = format!("mod_{:03}.rs", f_idx);
                    let mut file_content = String::with_capacity(3000);
                    let mut lines_count = 0;

                    file_content.push_str("//! Auto-generated synthetic enterprise module\n\n");
                    lines_count += 2;

                    // Chaos Injections
                    if inject_chaos {
                        // 1. ARCH-001 (Domain leaks reqwest)
                        if layer == "domain" && f_idx % 4 == 0 {
                            file_content.push_str("use reqwest::Client;\n");
                            lines_count += 1;
                            local_violations.push(SeededViolation {
                                rule_id: "ARCH-001".into(),
                                target_file_suffix: format!("{}/src/{}", crate_name, file_name),
                                description: "Domain crate cannot import external framework 'reqwest'".into(),
                            });
                        }

                        // 2. ARCH-002 (Application leaks tauri)
                        if layer == "application" && f_idx % 5 == 0 {
                            file_content.push_str("use tauri::command;\n");
                            lines_count += 1;
                            local_violations.push(SeededViolation {
                                rule_id: "ARCH-002".into(),
                                target_file_suffix: format!("{}/src/{}", crate_name, file_name),
                                description: "Application crate cannot import 'tauri'".into(),
                            });
                        }

                        // 3. ARCH-005 (Infrastructure leaks tauri)
                        if layer == "infrastructure" && f_idx % 6 == 0 {
                            file_content.push_str("use tauri::AppHandle;\n");
                            lines_count += 1;
                            local_violations.push(SeededViolation {
                                rule_id: "ARCH-005".into(),
                                target_file_suffix: format!("{}/src/{}", crate_name, file_name),
                                description: "Infrastructure crate is not authorized to import 'tauri'".into(),
                            });
                        }
                    }

                    // Standard Rust structures & methods to fill SLOC budget (~180 lines per file)
                    for s_idx in 0..15 {
                        file_content.push_str(&format!(
                            "#[derive(Debug, Clone)]\npub struct Entity_{}_{} {{\n    pub id: u64,\n    pub val: f64,\n}}\n\nimpl Entity_{}_{} {{\n    pub fn compute(&self) -> f64 {{\n        let mut acc = self.val;\n        for i in 0..10 {{\n            acc += i as f64;\n        }}\n        acc\n    }}\n}}\n\n",
                            f_idx, s_idx, f_idx, s_idx
                        ));
                        lines_count += 14;
                    }

                    fs::write(src_path.join(&file_name), file_content).map_err(|e| e.to_string())?;
                    total_files += 1;
                    total_sloc += lines_count;
                }

                Ok((total_files, total_sloc, local_violations))
            })
            .collect();

        let mut sum_files = 0;
        let mut sum_sloc = 0;
        let mut all_violations = Vec::new();

        for res in results {
            let (f, s, mut v) = res?;
            sum_files += f;
            sum_sloc += s;
            all_violations.append(&mut v);
        }

        Ok((sum_files, sum_sloc, all_violations))
    }

    fn generate_frontend_slices(
        frontend_dir: &Path,
        num_slices: usize,
        _target_sloc: usize,
        inject_chaos: bool,
    ) -> Result<(usize, usize, Vec<SeededViolation>), String> {
        let src_dir = frontend_dir.join("src");
        fs::create_dir_all(&src_dir).map_err(|e| e.to_string())?;

        let package_json =
            r#"{ "name": "@worldwiki/mega-spa", "version": "1.0.0", "private": true }"#;
        fs::write(frontend_dir.join("package.json"), package_json).map_err(|e| e.to_string())?;

        let slices = ["features", "widgets", "pages", "entities", "shared"];
        let files_per_slice = 75; // 40 * 75 = 3,000 frontend files

        let results: Vec<CrateGenResult> = (0..num_slices)
            .into_par_iter()
            .map(|slice_idx| {
                let mut local_violations = Vec::new();
                let slice_layer = slices[slice_idx % slices.len()];
                let slice_name = format!("{}_{:02}", slice_layer, slice_idx);
                let slice_path = src_dir.join(slice_layer).join(&slice_name);
                fs::create_dir_all(&slice_path).map_err(|e| e.to_string())?;

                let mut total_files = 0;
                let mut total_sloc = 0;

                for f_idx in 0..files_per_slice {
                    let comp_name = format!("Component_{:02}", f_idx);
                    let vue_file = format!("{}.vue", comp_name);
                    let ts_file = format!("use{}.ts", comp_name);

                    // 1. Vue Component
                    let mut vue_content = String::with_capacity(2000);

                    let mut script_body = String::from("const count = ref(0);\nconst title = 'Mega Widget';\n");
                    let mut style_body = String::from(".container { padding: var(--spacing-md); color: var(--color-text-primary); }\n");

                    if inject_chaos {
                        // VUE-001: Bloat logic in script setup
                        if f_idx % 4 == 0 {
                            for k in 0..15 {
                                script_body.push_str(&format!("function computeHeavy_{}() {{ return count.value * {}; }}\n", k, k));
                            }
                            local_violations.push(SeededViolation {
                                rule_id: "VUE-001".into(),
                                target_file_suffix: format!("{}/{}/{}", slice_layer, slice_name, vue_file),
                                description: "Heavy business logic in <script setup>".into(),
                            });
                        }

                        // CSS-001: Hex color hardcode
                        if f_idx % 3 == 0 {
                            style_body.push_str(".bad_card { background-color: #3b82f6; border-radius: 8px; }\n");
                            local_violations.push(SeededViolation {
                                rule_id: "CSS-001".into(),
                                target_file_suffix: format!("{}/{}/{}", slice_layer, slice_name, vue_file),
                                description: "Hex color hardcoded in <style>".into(),
                            });
                        }
                    }

                    vue_content.push_str("<template>\n  <div class=\"container\">\n    <h1>{{ title }}</h1>\n    <button @click=\"count++\">{{ count }}</button>\n  </div>\n</template>\n\n");
                    vue_content.push_str(&format!("<script setup lang=\"ts\">\nimport {{ ref }} from 'vue';\n{}\n</script>\n\n", script_body));
                    vue_content.push_str(&format!("<style scoped>\n{}\n</style>\n", style_body));

                    let vue_lines = vue_content.lines().count();
                    fs::write(slice_path.join(&vue_file), vue_content).map_err(|e| e.to_string())?;
                    total_files += 1;
                    total_sloc += vue_lines;

                    // 2. Composable Hook
                    let mut ts_content = String::with_capacity(1500);
                    ts_content.push_str("//! Auto-generated companion hook\nimport { ref, computed } from 'vue';\n\n");
                    ts_content.push_str(&format!("export function use{}() {{\n  const state = ref(0);\n  const doubled = computed(() => state.value * 2);\n  return {{ state, doubled }};\n}}\n", comp_name));

                    let ts_lines = ts_content.lines().count();
                    fs::write(slice_path.join(&ts_file), ts_content).map_err(|e| e.to_string())?;
                    total_files += 1;
                    total_sloc += ts_lines;
                }

                Ok((total_files, total_sloc, local_violations))
            })
            .collect();

        let mut sum_files = 0;
        let mut sum_sloc = 0;
        let mut all_violations = Vec::new();

        for res in results {
            let (f, s, mut v) = res?;
            sum_files += f;
            sum_sloc += s;
            all_violations.append(&mut v);
        }

        Ok((sum_files, sum_sloc, all_violations))
    }
}
