use cerberus_domain::{compute_fingerprint, Category, Severity, Violation};
use std::path::Path;

pub struct PerfRulesChecker;

impl PerfRulesChecker {
    pub fn check_source(source: &str, file_path: &Path) -> Vec<Violation> {
        let mut violations = Vec::new();
        let is_vue_file = file_path.extension().and_then(|e| e.to_str()) == Some("vue");

        let mut in_raf_block = false;
        let mut in_v_for_template = false;

        for (line_idx, line) in source.lines().enumerate() {
            let trimmed = line.trim();
            let line_num = line_idx + 1;

            // 1. Vue SFC Type Definition in .vue (VUE-003)
            if is_vue_file
                && (trimmed.starts_with("interface Props")
                    || trimmed.starts_with("interface Emits")
                    || trimmed.starts_with("export interface")
                    || trimmed.starts_with("type Props =")
                    || trimmed.starts_with("type Emits ="))
                && !trimmed.contains("import")
            {
                let fingerprint = compute_fingerprint(
                    "VUE-003",
                    "1.0",
                    "interface_in_sfc",
                    trimmed,
                );
                violations.push(Violation {
                    rule_id: "VUE-003".into(),
                    rule_version: "1.0".into(),
                    category: Category::Convention,
                    severity: Severity::Deny,
                    file: file_path.to_path_buf(),
                    line: line_num,
                    column: 1,
                    symbol: "interface".into(),
                    snippet: trimmed.to_string(),
                    message: "Declaring TypeScript interfaces inside .vue SFC is forbidden".into(),
                    remediation: "Move interface declarations to <Component>.model.ts or <Component>.types.ts.".into(),
                    fingerprint,
                });
            }

            // 2. Heavy AST / Data Structure in deep ref()/reactive() (PERF-001)
            if (trimmed.contains("ref<Large")
                || trimmed.contains("ref<SemanticDocument")
                || trimmed.contains("ref<AST")
                || trimmed.contains("ref<Ast")
                || trimmed.contains("reactive<Large")
                || trimmed.contains("reactive<SemanticDocument"))
                && !trimmed.contains("shallowRef")
            {
                let fingerprint = compute_fingerprint(
                    "PERF-001",
                    "1.0",
                    "deep_ref_heavy_ast",
                    trimmed,
                );
                violations.push(Violation {
                    rule_id: "PERF-001".into(),
                    rule_version: "1.0".into(),
                    category: Category::Performance,
                    severity: Severity::Deny,
                    file: file_path.to_path_buf(),
                    line: line_num,
                    column: 1,
                    symbol: "shallowRef".into(),
                    snippet: trimmed.to_string(),
                    message: "Deep reactivity on large AST / heavy data structure causes severe CPU degradation".into(),
                    remediation: "Use shallowRef() + triggerRef(), markRaw(), or Object.freeze() for heavy AST nodes.".into(),
                    fingerprint,
                });
            }

            // 3. Three.js / Canvas / Editor instance in reactive() without markRaw (PERF-002)
            if (trimmed.contains("reactive(new Scene")
                || trimmed.contains("ref(new Scene")
                || trimmed.contains("ref(new Editor")
                || trimmed.contains("reactive(new Editor")
                || trimmed.contains("ref(new Canvas")
                || trimmed.contains("reactive(new Canvas"))
                && !trimmed.contains("markRaw")
            {
                let fingerprint = compute_fingerprint(
                    "PERF-002",
                    "1.0",
                    "reactive_canvas_three",
                    trimmed,
                );
                violations.push(Violation {
                    rule_id: "PERF-002".into(),
                    rule_version: "1.0".into(),
                    category: Category::Performance,
                    severity: Severity::Deny,
                    file: file_path.to_path_buf(),
                    line: line_num,
                    column: 1,
                    symbol: "markRaw".into(),
                    snippet: trimmed.to_string(),
                    message: "Wrapping Three.js, Canvas, or Editor instance in Vue Proxy causes memory leaks and performance drop".into(),
                    remediation: "Wrap external classes in markRaw(new Scene()) or markRaw(new Editor()).".into(),
                    fingerprint,
                });
            }

            // 4. Memory Allocations inside requestAnimationFrame (PERF-003)
            if trimmed.contains("requestAnimationFrame(") || trimmed.contains("function renderLoop") {
                in_raf_block = true;
            }
            if in_raf_block {
                if trimmed.contains("new Array(")
                    || trimmed.contains("new Object(")
                    || trimmed.contains("new Vector3(")
                    || trimmed.contains("new THREE.")
                    || (trimmed.contains(".map(") && !trimmed.contains("const "))
                    || (trimmed.contains(".filter(") && !trimmed.contains("const "))
                {
                    let fingerprint = compute_fingerprint(
                        "PERF-003",
                        "1.0",
                        "raf_allocation",
                        trimmed,
                    );
                    violations.push(Violation {
                        rule_id: "PERF-003".into(),
                        rule_version: "1.0".into(),
                        category: Category::Performance,
                        severity: Severity::Deny,
                        file: file_path.to_path_buf(),
                        line: line_num,
                        column: 1,
                        symbol: "renderLoop".into(),
                        snippet: trimmed.to_string(),
                        message: "Dynamic memory allocation inside requestAnimationFrame render loop triggers GC frame drops".into(),
                        remediation: "Preallocate reusable objects, vectors and arrays outside the render loop.".into(),
                        fingerprint,
                    });
                }
                if trimmed.contains("}") && (trimmed.ends_with("});") || trimmed == "}") {
                    in_raf_block = false;
                }
            }

            // 5. Uncached function call inside v-for template loop (PERF-004)
            if trimmed.contains("v-for=") {
                in_v_for_template = true;
            }
            if in_v_for_template
                && is_vue_file
                && trimmed.contains("{{")
                && trimmed.contains("(")
                && trimmed.contains(")")
                && !trimmed.contains("v-for=")
            {
                let fingerprint = compute_fingerprint(
                    "PERF-004",
                    "1.0",
                    "uncached_template_call",
                    trimmed,
                );
                violations.push(Violation {
                    rule_id: "PERF-004".into(),
                    rule_version: "1.0".into(),
                    category: Category::Performance,
                    severity: Severity::Deny,
                    file: file_path.to_path_buf(),
                    line: line_num,
                    column: 1,
                    symbol: "template_method".into(),
                    snippet: trimmed.to_string(),
                    message: "Uncached function call inside v-for template re-executes on every render frame".into(),
                    remediation: "Precompute mapped values using a typed computed() property or Map.".into(),
                    fingerprint,
                });
            }
            if in_v_for_template && (trimmed.contains("</template>") || trimmed.contains("</div>")) {
                in_v_for_template = false;
            }

            // 6. Cascading deep watch without depth limiter (PERF-005)
            if trimmed.contains("deep: true") && trimmed.contains("watch(") {
                let fingerprint = compute_fingerprint(
                    "PERF-005",
                    "1.0",
                    "deep_watch_cascade",
                    trimmed,
                );
                violations.push(Violation {
                    rule_id: "PERF-005".into(),
                    rule_version: "1.0".into(),
                    category: Category::Performance,
                    severity: Severity::Deny,
                    file: file_path.to_path_buf(),
                    line: line_num,
                    column: 1,
                    symbol: "watch".into(),
                    snippet: trimmed.to_string(),
                    message: "Unrestricted watch(..., { deep: true }) causes recursive reactive storm".into(),
                    remediation: "Use specific scalar getters in watch(() => [x.a, x.b]) or Vue 3.5+ depth limit { deep: 1 }.".into(),
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
    fn test_perf_heavy_ast_and_canvas_reactivity() {
        let code = r#"
            const doc = ref<LargeSemanticDocument>(raw);
            const scene = reactive(new Scene());
        "#;
        let file = Path::new("src/editor/useEditor.ts");
        let violations = PerfRulesChecker::check_source(code, file);
        assert_eq!(violations.len(), 2);
        assert!(violations.iter().any(|v| v.rule_id == "PERF-001"));
        assert!(violations.iter().any(|v| v.rule_id == "PERF-002"));
    }

    #[test]
    fn test_perf_raf_allocation_check() {
        let code = r#"
            requestAnimationFrame(() => {
                const vec = new Vector3(1, 2, 3);
            });
        "#;
        let file = Path::new("src/render/loop.ts");
        let violations = PerfRulesChecker::check_source(code, file);
        assert_eq!(violations.len(), 1);
        assert_eq!(violations[0].rule_id, "PERF-003");
    }

    #[test]
    fn test_vue_types_in_sfc_and_v_for_method() {
        let code = r#"
            <template>
                <div v-for="item in items" :key="item.id">
                    <span>{{ computeStatus(item) }}</span>
                </div>
            </template>
            <script setup lang="ts">
                interface Props {
                    title: string;
                }
            </script>
        "#;
        let file = Path::new("src/components/Card.vue");
        let violations = PerfRulesChecker::check_source(code, file);
        assert_eq!(violations.len(), 2);
        assert!(violations.iter().any(|v| v.rule_id == "VUE-003"));
        assert!(violations.iter().any(|v| v.rule_id == "PERF-004"));
    }

    #[test]
    fn test_deep_watch_cascade_check() {
        let code = "watch(props.modelValue, (val) => {}, { deep: true });";
        let file = Path::new("src/useForm.ts");
        let violations = PerfRulesChecker::check_source(code, file);
        assert_eq!(violations.len(), 1);
        assert_eq!(violations[0].rule_id, "PERF-005");
    }
}
