use crate::domain::factor::TestabilityFactor;
use crate::domain::friction::TestFriction;

pub struct FrontendTestabilityScanner;

impl FrontendTestabilityScanner {
    pub fn scan_source(source_code: &str, file_path: &str) -> Vec<TestFriction> {
        let mut frictions = Vec::new();

        let is_vue = file_path.ends_with(".vue");
        let is_ts_or_js = file_path.ends_with(".ts") || file_path.ends_with(".js");

        if !is_vue && !is_ts_or_js {
            return frictions;
        }

        for (line_idx, line) in source_code.lines().enumerate() {
            let line_num = line_idx + 1;
            let trimmed = line.trim();

            if trimmed.starts_with("//") || trimmed.starts_with("/*") || trimmed.starts_with('*') {
                continue;
            }

            // F-01: Hidden Ambient I/O in frontend
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
            }

            // F-02: Direct Network / FS Access in component
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
            }

            // F-03: Shared Global Mutable State
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
            }

            // F-06: Direct concrete Tauri IPC coupling
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
            }

            // F-04: Heavy lifecycle / Options API constructor side-effects
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
            }

            // F-05: Heavy inline calculation in template / component
            if trimmed.contains("function compute_") || trimmed.contains("function calculate_") {
                frictions.push(TestFriction {
                    factor: TestabilityFactor::F05HeavyMultiLineClosure,
                    line: line_num,
                    column: 1,
                    snippet: trimmed.to_string(),
                    message: "Complex unextracted calculation in UI component; must be extracted to composable".into(),
                });
            }
        }

        frictions
    }
}
