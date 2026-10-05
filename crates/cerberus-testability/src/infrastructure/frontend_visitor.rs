use crate::domain::archetype::TestabilityArchetype;
use crate::domain::factor::TestabilityFactor;
use crate::domain::friction::TestFriction;
use crate::domain::layer::LayerContext;

pub struct FrontendScanResult {
    pub archetype: TestabilityArchetype,
    pub frictions: Vec<TestFriction>,
    pub triggers: Vec<String>,
}

pub struct FrontendTestabilityScanner;

impl FrontendTestabilityScanner {
    #[must_use]
    pub fn scan_source(source_code: &str, file_path: &str, layer: LayerContext) -> FrontendScanResult {
        let mut frictions = Vec::new();
        let mut triggers = Vec::new();
        let mut archetype = TestabilityArchetype::Pure;

        let is_vue = file_path.ends_with(".vue");
        let is_ts_or_js = file_path.ends_with(".ts") || file_path.ends_with(".js") || file_path.ends_with(".tsx") || file_path.ends_with(".jsx");

        if !is_vue && !is_ts_or_js {
            return FrontendScanResult {
                archetype,
                frictions,
                triggers,
            };
        }

        // Check if file provides explicit interfaces or mockable contracts
        if source_code.contains("interface ") || source_code.contains("defineProps<") || source_code.contains("defineEmits<") || source_code.contains("export interface") {
            archetype = archetype.combine(TestabilityArchetype::Mockable);
            triggers.push("Interface/Props contract in frontend module".to_string());
        }

        let is_legacy_options = source_code.contains("export default {") || source_code.contains("data()") || source_code.contains("methods:");
        if is_legacy_options {
            archetype = archetype.combine(TestabilityArchetype::Flaky);
            triggers.push("Legacy Options API coupling without composable isolation".to_string());
        }

        for (line_idx, line) in source_code.lines().enumerate() {
            let line_num = line_idx + 1;
            let trimmed = line.trim();

            if trimmed.starts_with("//") || trimmed.starts_with("/*") || trimmed.starts_with('*') {
                continue;
            }

            // F-01: Hidden Ambient I/O in frontend (Flaky / Poisoned if in Domain)
            if trimmed.contains("new Date(")
                || trimmed.contains("Date.now()")
                || trimmed.contains("Math.random()")
                || trimmed.contains("performance.now()")
            {
                frictions.push(TestFriction {
                    factor: TestabilityFactor::F01HiddenAmbientIo,
                    line: line_num,
                    column: 1,
                    snippet: trimmed.to_string(),
                    message: "Ambient non-deterministic time/random call in frontend component".into(),
                });

                if layer == LayerContext::Domain {
                    archetype = archetype.combine(TestabilityArchetype::Poisoned);
                    triggers.push(format!("Domain layer violation: non-deterministic call `{trimmed}`"));
                } else {
                    archetype = archetype.combine(TestabilityArchetype::Flaky);
                    triggers.push(format!("Non-deterministic frontend call `{trimmed}`"));
                }
            }

            // F-02: Direct Network / FS Access in component (IntBound / Poisoned if in Domain)
            if trimmed.contains("fetch(")
                || trimmed.contains("axios.")
                || trimmed.contains("http.")
                || trimmed.contains("XMLHttpRequest")
            {
                frictions.push(TestFriction {
                    factor: TestabilityFactor::F02DirectOsFsAccess,
                    line: line_num,
                    column: 1,
                    snippet: trimmed.to_string(),
                    message: "Direct network I/O in UI component without service/api layer abstraction".into(),
                });

                if layer == LayerContext::Domain {
                    archetype = archetype.combine(TestabilityArchetype::Poisoned);
                    triggers.push(format!("Domain layer violation: direct network I/O `{trimmed}`"));
                } else {
                    archetype = archetype.combine(TestabilityArchetype::IntBound);
                    triggers.push(format!("Direct network I/O call `{trimmed}`"));
                }
            }

            // F-03: Shared Global Mutable State (Flaky / Poisoned in Domain)
            if trimmed.contains("localStorage.")
                || trimmed.contains("sessionStorage.")
                || trimmed.contains("globalThis.")
                || (trimmed.contains("window.") && !trimmed.contains("window.__TAURI__"))
            {
                frictions.push(TestFriction {
                    factor: TestabilityFactor::F03SharedGlobalMutableState,
                    line: line_num,
                    column: 1,
                    snippet: trimmed.to_string(),
                    message: "Shared global mutable state access via window/storage".into(),
                });

                if layer == LayerContext::Domain {
                    archetype = archetype.combine(TestabilityArchetype::Poisoned);
                    triggers.push(format!("Domain layer violation: global state access `{trimmed}`"));
                } else {
                    archetype = archetype.combine(TestabilityArchetype::Flaky);
                    triggers.push(format!("Shared global state access `{trimmed}`"));
                }
            }

            // F-06: Direct concrete Tauri IPC coupling (IntBound)
            if trimmed.contains("__TAURI__")
                || trimmed.contains("window.__TAURI__")
                || (trimmed.contains("invoke(") && !file_path.contains("api.client"))
            {
                frictions.push(TestFriction {
                    factor: TestabilityFactor::F06ConcreteCouplingInBoundary,
                    line: line_num,
                    column: 1,
                    snippet: trimmed.to_string(),
                    message: "Direct coupling to Tauri IPC in UI component without API client boundary".into(),
                });

                archetype = archetype.combine(TestabilityArchetype::IntBound);
                triggers.push("Direct Tauri IPC invocation in frontend component".to_string());
            }

            // F-04: Heavy lifecycle / Options API constructor side-effects (Poisoned)
            if (trimmed.contains("created()") || trimmed.contains("beforeCreate()") || trimmed.contains("mounted() {"))
                && (source_code.contains("fetch(") || source_code.contains("axios.") || source_code.contains("__TAURI__"))
            {
                frictions.push(TestFriction {
                    factor: TestabilityFactor::F04SideEffectingConstructor,
                    line: line_num,
                    column: 1,
                    snippet: trimmed.to_string(),
                    message: "Side-effecting lifecycle hook in UI component".into(),
                });

                archetype = archetype.combine(TestabilityArchetype::Poisoned);
                triggers.push("Side-effecting lifecycle constructor hook with I/O".to_string());
            }

            // F-05: Heavy inline calculation in template / component (Flaky)
            if trimmed.contains("function compute_") || trimmed.contains("function calculate_") {
                frictions.push(TestFriction {
                    factor: TestabilityFactor::F05HeavyMultiLineClosure,
                    line: line_num,
                    column: 1,
                    snippet: trimmed.to_string(),
                    message: "Complex unextracted calculation in UI component; must be extracted to composable".into(),
                });

                archetype = archetype.combine(TestabilityArchetype::Flaky);
                triggers.push("Complex unextracted inline computation in component".to_string());
            }
        }

        FrontendScanResult {
            archetype,
            frictions,
            triggers,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_frontend_scanner_vue_and_ts() {
        let non_fe = FrontendTestabilityScanner::scan_source("fn main() {}", "main.rs", LayerContext::Domain);
        assert_eq!(non_fe.archetype, TestabilityArchetype::Pure);

        let vue_pure = FrontendTestabilityScanner::scan_source(
            "<script setup lang=\"ts\">\ninterface Props { id: string; }\ndefineProps<Props>();\n</script>",
            "Component.vue",
            LayerContext::Infrastructure,
        );
        assert_eq!(vue_pure.archetype, TestabilityArchetype::Mockable);

        let vue_io = FrontendTestabilityScanner::scan_source(
            "<script setup lang=\"ts\">\nconst d = Date.now();\nfetch('https://api.com');\nlocalStorage.setItem('k', 'v');\ncreated() {\nfetch('x');\n}\nfunction compute_val() {}\n</script>",
            "Component.vue",
            LayerContext::Infrastructure,
        );
        assert_eq!(vue_io.archetype, TestabilityArchetype::Poisoned);
        assert!(!vue_io.frictions.is_empty());

        let fe_branches = FrontendTestabilityScanner::scan_source(
            r#"
            const t = performance.now();
            const r = Math.random();
            const ax = axios.get('url');
            const h = http.request();
            const xhr = new XMLHttpRequest();
            const s = sessionStorage.getItem('key');
            const g = globalThis.val;
            const w = window.myProp;
            const ipc = window.__TAURI__.invoke('cmd');
            const inv = invoke('cmd');
            beforeCreate() { axios.get('a'); }
            mounted() { const x = 1; }
            function calculate_total() {}
            "#,
            "views/MyView.vue",
            LayerContext::Infrastructure,
        );
        assert!(!fe_branches.frictions.is_empty());

        let domain_ts = FrontendTestabilityScanner::scan_source(
            "export function test() { return Date.now() + fetch('a') + localStorage.getItem('k'); }",
            "domain.ts",
            LayerContext::Domain,
        );
        assert_eq!(domain_ts.archetype, TestabilityArchetype::Poisoned);
    }
}
