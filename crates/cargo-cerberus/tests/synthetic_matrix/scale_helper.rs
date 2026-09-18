use crate::synthetic_matrix::generator_trait::SeededViolation;

/// Deterministic, zero-dependency Xorshift64Star PRNG
#[derive(Clone, Copy, Debug)]
pub struct FastRng(u64);

impl FastRng {
    pub const fn new(seed: u64) -> Self {
        Self(if seed == 0 { 0xdead_beef_cafe_babe } else { seed })
    }

    #[inline]
    pub fn next_u64(&mut self) -> u64 {
        let mut x = self.0;
        x ^= x << 13;
        x ^= x >> 7;
        x ^= x << 17;
        self.0 = x;
        x.wrapping_mul(0x2545_f491_4f6c_dd1d)
    }

    #[inline]
    pub fn gen_range(&mut self, min: usize, max: usize) -> usize {
        if min >= max {
            return min;
        }
        min + (self.next_u64() as usize % (max - min))
    }

    #[inline]
    pub fn chance(&mut self, percentage: f64) -> bool {
        (self.next_u64() % 10000) < (percentage * 100.0) as u64
    }
}

pub struct ScaleHelper;

impl ScaleHelper {
    /// Generates structured Rust modules for a given crate and layer
    pub fn generate_rust_modules(
        crate_name: &str,
        layer: &str,
        target_sloc: usize,
        inject_violations: bool,
    ) -> (Vec<(String, String)>, Vec<SeededViolation>) {
        let lines_per_file = 60;
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

        let seed = 0x5a17_e409_cafe_1337
            ^ (target_sloc as u64)
            ^ (layer.as_bytes().iter().map(|b| *b as u64).sum::<u64>() << 16);
        let mut rng = FastRng::new(seed);

        for f_idx in 0..num_files {
            let g_idx = f_idx / group_size;
            let file_name = format!("mod_{:03}.rs", f_idx);
            let mut content = String::with_capacity(2000);
            content.push_str("//! Auto-generated synthetic enterprise module\n\n");

            let mut method_body_extra = String::new();

            // Seeded violations with deterministic PRNG
            if inject_violations && rng.chance(12.5) {
                let style = rng.gen_range(0, 2);
                match layer {
                    "domain" | "core" | "entities" | "domain_core" => {
                        if style == 0 {
                            content.push_str("use reqwest::Client;\n");
                        } else {
                            method_body_extra.push_str("        use reqwest::Client;\n        let _ = Client::new();\n");
                        }
                        violations.push(SeededViolation {
                            rule_id: "ARCH-001".into(),
                            target_file_suffix: format!("{}/src/group_{:02}/{}", crate_name, g_idx, file_name),
                            description: format!("Domain crate '{}' cannot import 'reqwest'", crate_name),
                        });
                    }
                    "application" | "app" | "usecases" => {
                        if style == 0 {
                            content.push_str("use tauri::command;\n");
                        } else {
                            method_body_extra.push_str("        use tauri::AppHandle;\n");
                        }
                        violations.push(SeededViolation {
                            rule_id: "ARCH-002".into(),
                            target_file_suffix: format!("{}/src/group_{:02}/{}", crate_name, g_idx, file_name),
                            description: format!("Application crate '{}' cannot import 'tauri'", crate_name),
                        });
                    }
                    "infrastructure" | "infra" | "repository" => {
                        if style == 0 {
                            content.push_str("use tauri::AppHandle;\n");
                        } else {
                            method_body_extra.push_str("        use tauri::AppHandle;\n");
                        }
                        violations.push(SeededViolation {
                            rule_id: "ARCH-005".into(),
                            target_file_suffix: format!("{}/src/group_{:02}/{}", crate_name, g_idx, file_name),
                            description: format!("Infrastructure crate '{}' is not authorized to import 'tauri'", crate_name),
                        });
                    }
                    "commands" | "write" => {
                        if style == 0 {
                            content.push_str("use crate::read_db::UserProjection;\n");
                        } else {
                            method_body_extra.push_str("        use crate::read_db::UserProjection;\n");
                        }
                        violations.push(SeededViolation {
                            rule_id: "CQRS-001".into(),
                            target_file_suffix: format!("{}/src/group_{:02}/{}", crate_name, g_idx, file_name),
                            description: "Write pipeline cannot import Read projection".into(),
                        });
                    }
                    "producer" => {
                        if style == 0 {
                            content.push_str("use crate::consumer::on_order_event;\n");
                        } else {
                            method_body_extra.push_str("        use crate::consumer::on_order_event;\n");
                        }
                        violations.push(SeededViolation {
                            rule_id: "EVT-001".into(),
                            target_file_suffix: format!("{}/src/group_{:02}/{}", crate_name, g_idx, file_name),
                            description: "Event Producer cannot directly import Consumer".into(),
                        });
                    }
                    _ => {}
                }
            }

            let mut testability_extra = String::new();
            if inject_violations {
                // Paradigms / layers have characteristic testability friction
                match layer {
                    "domain" | "core" | "entities" | "domain_core" => {
                        // Pure domain: 100% deterministic (no TEST-005 violation)
                    }
                    "application" | "app" | "usecases" => {
                        if rng.chance(20.0) {
                            testability_extra.push_str("        let cur_inst = std::time::Instant::now();\n        let _inst_nanos = cur_inst.elapsed().as_nanos();\n");
                        }
                    }
                    "services" | "service" => {
                        if rng.chance(48.0) {
                            let choice = rng.gen_range(0, 3);
                            if choice == 0 {
                                testability_extra.push_str("        let cur_inst = std::time::Instant::now();\n        let _inst_nanos = cur_inst.elapsed().as_nanos();\n");
                            } else if choice == 1 {
                                testability_extra.push_str("        let f_data = std::fs::read_to_string(\"service_cfg.json\").unwrap_or_default();\n        let _data_len = f_data.len();\n");
                            } else {
                                testability_extra.push_str("        let f_data = std::fs::read_to_string(\"service_cfg.json\").unwrap_or_default();\n        let cur_inst = std::time::Instant::now();\n        let _time_ok = cur_inst.elapsed().as_millis();\n");
                            }
                        }
                    }
                    "infrastructure" | "infra" | "repository" | "database" => {
                        if rng.chance(58.0) {
                            let choice = rng.gen_range(0, 3);
                            if choice == 0 {
                                testability_extra.push_str("        let f_data = std::fs::read_to_string(\"db_pool.cfg\").unwrap_or_default();\n        let _data_len = f_data.len();\n");
                            } else if choice == 1 {
                                testability_extra.push_str("        let cur_inst = std::time::Instant::now();\n        let _time_ok = cur_inst.elapsed().as_millis();\n");
                            } else {
                                testability_extra.push_str("        let f_data = std::fs::read_to_string(\"db_pool.cfg\").unwrap_or_default();\n        let cur_inst = std::time::Instant::now();\n        let _time_ok = cur_inst.elapsed().as_millis();\n");
                            }
                        }
                    }
                    "commands" | "write" => {
                        if rng.chance(48.0) {
                            testability_extra.push_str("        let cur_inst = std::time::Instant::now();\n        let _t = cur_inst.elapsed().as_millis();\n");
                        }
                    }
                    "queries" | "read" => {
                        if rng.chance(42.0) {
                            testability_extra.push_str("        let f_data = std::fs::read_to_string(\"read_cache.dat\").unwrap_or_default();\n        let _data_len = f_data.len();\n");
                        }
                    }
                    "plugin" | "plugin_api" => {
                        if rng.chance(65.0) {
                            let choice = rng.gen_range(0, 3);
                            if choice == 0 {
                                testability_extra.push_str("        let _lib = unsafe { libloading::Library::new(\"plugin.dll\") };\n");
                            } else if choice == 1 {
                                testability_extra.push_str("        let cur_inst = std::time::Instant::now();\n        let _time_ok = cur_inst.elapsed().as_millis();\n");
                            } else {
                                testability_extra.push_str("        let f_data = std::fs::read_to_string(\"plugin_manifest.json\").unwrap_or_default();\n        let _data_len = f_data.len();\n");
                            }
                        }
                    }
                    "actor" | "worker" => {
                        if rng.chance(75.0) {
                            let choice = rng.gen_range(0, 4);
                            if choice == 0 {
                                testability_extra.push_str("        let bg_task = tokio::spawn(async {});\n        let _task_done = bg_task.is_finished();\n");
                            } else if choice == 1 {
                                testability_extra.push_str("        let cur_inst = std::time::Instant::now();\n        let _inst_nanos = cur_inst.elapsed().as_nanos();\n");
                            } else if choice == 2 {
                                testability_extra.push_str("        let f_data = std::fs::read_to_string(\"mailbox.dat\").unwrap_or_default();\n        let _data_len = f_data.len();\n");
                            } else {
                                testability_extra.push_str("        let bg_task = tokio::spawn(async {});\n        let cur_inst = std::time::Instant::now();\n        let _t = cur_inst.elapsed().as_millis();\n");
                            }
                        }
                    }
                    "function" | "handler" | "serverless" => {
                        if rng.chance(78.0) {
                            let choice = rng.gen_range(0, 4);
                            if choice == 0 {
                                testability_extra.push_str("        let cur_inst = std::time::Instant::now();\n        let _time_ok = cur_inst.elapsed().as_millis();\n");
                            } else if choice == 1 {
                                testability_extra.push_str("        let f_data = std::fs::read_to_string(\"lambda_context.json\").unwrap_or_default();\n        let _data_len = f_data.len();\n");
                            } else if choice == 2 {
                                testability_extra.push_str("        let http_cli = reqwest::Client::new();\n        let _cli_ref = &http_cli;\n");
                            } else {
                                testability_extra.push_str("        let f_data = std::fs::read_to_string(\"event.json\").unwrap_or_default();\n        let cur_inst = std::time::Instant::now();\n        let _t = cur_inst.elapsed().as_nanos();\n");
                            }
                        }
                    }
                    "producer" | "consumer" | "events" => {
                        if rng.chance(76.0) {
                            let choice = rng.gen_range(0, 3);
                            if choice == 0 {
                                testability_extra.push_str("        let bg_task = tokio::spawn(async {});\n        let _task_done = bg_task.is_finished();\n");
                            } else if choice == 1 {
                                testability_extra.push_str("        let bg_task = tokio::spawn(async {});\n        let cur_inst = std::time::Instant::now();\n        let _t = cur_inst.elapsed().as_millis();\n");
                            } else {
                                testability_extra.push_str("        let f_data = std::fs::read_to_string(\"event_queue.dat\").unwrap_or_default();\n        let _data_len = f_data.len();\n");
                            }
                        }
                    }
                    "gateway" | "bff" | "controller" => {
                        if rng.chance(76.0) {
                            let choice = rng.gen_range(0, 3);
                            if choice == 0 {
                                testability_extra.push_str("        let http_cli = reqwest::Client::new();\n        let _cli_ref = &http_cli;\n");
                            } else if choice == 1 {
                                testability_extra.push_str("        let cur_inst = std::time::Instant::now();\n        let _inst_nanos = cur_inst.elapsed().as_nanos();\n");
                            } else {
                                testability_extra.push_str("        let http_cli = reqwest::Client::new();\n        let cur_inst = std::time::Instant::now();\n        let _t = cur_inst.elapsed().as_millis();\n");
                            }
                        }
                    }
                    _ => {
                        if rng.chance(40.0) {
                            testability_extra.push_str("        let cur_inst = std::time::Instant::now();\n        let _time_ok = cur_inst.elapsed().as_millis();\n");
                        }
                    }
                }
            }

            // High-quality domain models, traits and business logic (~60 SLOC)
            content.push_str(&format!(
                "pub trait ServicePort_{} {{\n    fn process(&self, input: u64) -> Result<u64, &'static str>;\n}}\n\n",
                f_idx
            ));

            let method_inject = format!("{}{}", method_body_extra, testability_extra);

            content.push_str(&format!(
                "#[derive(Debug, Clone, PartialEq, Eq)]\npub struct OrderAggregate_{} {{\n    pub id: u64,\n    pub customer_id: u64,\n    pub items: Vec<(u64, u64, u32)>,\n    pub status: u32,\n    pub discount_cents: u64,\n}}\n\nimpl OrderAggregate_{} {{\n    pub fn calculate_total(&self, tax_rate_bps: u64) -> Result<u64, &'static str> {{\n{}\n        if self.items.is_empty() {{\n            return Err(\"Order cannot be empty\");\n        }}\n        let mut subtotal: u64 = 0;\n        for (_, price, qty) in &self.items {{\n            if *price == 0 || *qty == 0 {{\n                return Err(\"Invalid item price or quantity\");\n            }}\n            subtotal = subtotal.saturating_add(price.saturating_mul(*qty as u64));\n        }}\n        let discounted = subtotal.saturating_sub(self.discount_cents);\n        let tax = (discounted * tax_rate_bps) / 10_000;\n        Ok(discounted.saturating_add(tax))\n    }}\n\n    pub fn transition_to(&mut self, next_status: u32) -> Result<(), &'static str> {{\n        match (self.status, next_status) {{\n            (0, 1) => {{ self.status = 1; Ok(()) }}\n            (1, 2) => {{ self.status = 2; Ok(()) }}\n            (1, 3) => {{ self.status = 3; Ok(()) }}\n            (2, 4) => {{ self.status = 4; Ok(()) }}\n            (_, 5) => {{ self.status = 5; Ok(()) }}\n            _ => Err(\"Invalid state transition\"),\n        }}\n    }}\n}}\n\n",
                f_idx, f_idx, method_inject
            ));

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
        let mut rng = FastRng::new(0x9922_cafe_babe_7788 ^ (target_sloc as u64));

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
                // VUE-001: Raw business logic functions inside <script setup> (~15% density)
                if rng.chance(15.0) {
                    for k in 0..10 {
                        script_body.push_str(&format!("function calc_{}() {{ return count.value * {}; }}\n", k, k));
                    }
                    violations.push(SeededViolation {
                        rule_id: "VUE-001".into(),
                        target_file_suffix: format!("{}/{}/{}", slice, comp_name, vue_file),
                        description: "Raw business logic functions in <script setup>".into(),
                    });
                }

                // CSS-004: Hex color hardcoding (~12% density)
                if rng.chance(12.0) {
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

            let ts_extra = match slice {
                "features" | "pages" => {
                    "  const fetchData = async () => {\n    const res = await fetch('/api/v1/metrics');\n    const data = await res.json();\n    count.value = data.total;\n  };\n"
                }
                _ => "",
            };

            let ts_content = format!(
                "//! Composable hook for {}\nimport {{ ref, computed }} from 'vue';\n\nexport function use{}() {{\n  const count = ref(0);\n  const label = 'Metric';\n  const doubled = computed(() => count.value * 2);\n{}\n  return {{ count, label, doubled }};\n}}\n",
                comp_name, comp_name, ts_extra
            );

            files.push((rel_vue, vue_content));
            files.push((rel_ts, ts_content));
        }

        (files, violations)
    }

    /// Generates legacy Options API monolithic Vue components with realistic legacy distribution
    pub fn generate_vue_legacy_modules(
        app_dir: &str,
        target_sloc: usize,
        inject_violations: bool,
    ) -> (Vec<(String, String)>, Vec<SeededViolation>) {
        let lines_per_comp = 200;
        let num_comps = (target_sloc / lines_per_comp).max(10);
        let mut files = Vec::with_capacity(num_comps + 1);
        let mut violations = Vec::new();

        let mut rng = FastRng::new(0x1337_dead_beef_0042 ^ (target_sloc as u64));

        for idx in 0..num_comps {
            let comp_name = format!("LegacyGodView_{:03}", idx);
            let rel_vue = format!("{}/src/views/{}.vue", app_dir, comp_name);

            let mut script_body = match idx % 4 {
                0 => {
                    // Heavy God component with multiple legacy anti-patterns
                    String::from(
                        "export default {\n  data() {\n    return {\n      items: [],\n      total: 0,\n      lastSync: new Date(),\n      token: localStorage.getItem('auth_token'),\n    };\n  },\n  created() {\n    fetch('/api/v1/orders').then(r => r.json()).then(d => this.items = d);\n    window.addEventListener('resize', this.onResize);\n  },\n  methods: {\n    onResize() {\n      this.total = window.innerWidth * 2;\n    },\n    calculate_tax(val) {\n      return val * 0.20 + Math.random();\n    },\n    save() {\n      localStorage.setItem('cached_orders', JSON.stringify(this.items));\n    }\n  }\n};\n"
                    )
                }
                1 => {
                    // Medium legacy component (lifecycle network side-effects + timers/dates)
                    String::from(
                        "export default {\n  data() {\n    return {\n      status: 'idle',\n      createdDate: new Date(),\n    };\n  },\n  created() {\n    fetch('/api/v1/status').then(r => r.json()).then(d => this.status = d.status);\n  },\n  methods: {\n    refresh() {\n      this.createdDate = new Date();\n    }\n  }\n};\n"
                    )
                }
                2 => {
                    // LocalStorage and window coupling
                    String::from(
                        "export default {\n  data() {\n    return {\n      theme: localStorage.getItem('theme') || 'dark',\n      width: window.innerWidth,\n    };\n  },\n  methods: {\n    toggleTheme() {\n      this.theme = this.theme === 'dark' ? 'light' : 'dark';\n      localStorage.setItem('theme', this.theme);\n    }\n  }\n};\n"
                    )
                }
                _ => {
                    // Presentational legacy component with Options API
                    String::from(
                        "export default {\n  props: ['title'],\n  data() {\n    return {\n      count: 0,\n    };\n  },\n  methods: {\n    increment() {\n      this.count++;\n    }\n  }\n};\n"
                    )
                }
            };

            let mut style_body = String::from(".god_view { padding: 20px; font-size: 14px; }\n");

            if inject_violations && rng.chance(15.0) {
                script_body.push_str("window.__TAURI__.invoke('direct_db_save');\n");
                style_body.push_str(".god_error { background: #ff0055; color: #ffffff; }\n");

                violations.push(SeededViolation {
                    rule_id: "TAURI-002".into(),
                    target_file_suffix: format!("{}.vue", comp_name),
                    description: "Direct Tauri IPC in Vue component".into(),
                });
                violations.push(SeededViolation {
                    rule_id: "CSS-004".into(),
                    target_file_suffix: format!("{}.vue", comp_name),
                    description: "Hex color hardcoded in <style>".into(),
                });
            }

            let vue_content = format!(
                "<template>\n  <div class=\"god_view\">\n    <h1>Legacy God View {}</h1>\n    <ul><li v-for=\"i in items\" :key=\"i\">{{{{ i }}}}</li></ul>\n  </div>\n</template>\n\n<script>\n{}\n</script>\n\n<style scoped>\n{}\n</style>\n",
                idx, script_body, style_body
            );

            files.push((rel_vue, vue_content));
        }

        (files, violations)
    }
}
