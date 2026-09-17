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

            if is_vue_file {
                check_vue_types(trimmed, file_path, line_num, &mut violations);
            }

            check_heavy_ast(trimmed, file_path, line_num, &mut violations);
            check_canvas_reactivity(trimmed, file_path, line_num, &mut violations);
            check_deep_watch(trimmed, file_path, line_num, &mut violations);

            // RAF state & checks
            if trimmed.contains("requestAnimationFrame(") || trimmed.contains("function renderLoop") {
                in_raf_block = true;
            }
            if in_raf_block {
                check_raf_allocation(trimmed, file_path, line_num, &mut violations);
                if trimmed.contains('}') && (trimmed.ends_with("});") || trimmed == "}") {
                    in_raf_block = false;
                }
            }

            // V-For template method calls
            if trimmed.contains("v-for=") {
                in_v_for_template = true;
            }
            if in_v_for_template {
                if is_vue_file && trimmed.contains("{{") && trimmed.contains('(') && trimmed.contains(')') && !trimmed.contains("v-for=") {
                    check_v_for_template_call(trimmed, file_path, line_num, &mut violations);
                }
                if trimmed.contains("</template>") || trimmed.contains("</div>") {
                    in_v_for_template = false;
                }
            }
        }

        violations
    }
}

fn check_vue_types(trimmed: &str, file_path: &Path, line: usize, out: &mut Vec<Violation>) {
    if (trimmed.starts_with("interface Props")
        || trimmed.starts_with("interface Emits")
        || trimmed.starts_with("export interface")
        || trimmed.starts_with("type Props =")
        || trimmed.starts_with("type Emits ="))
        && !trimmed.contains("import")
    {
        out.push(Violation {
            rule_id: "VUE-003".into(),
            rule_version: "1.0".into(),
            category: Category::Convention,
            severity: Severity::Deny,
            file: file_path.to_path_buf(),
            line,
            column: 1,
            symbol: "interface".into(),
            snippet: trimmed.to_string(),
            message: "Declaring TypeScript interfaces inside .vue SFC is forbidden".into(),
            remediation: "Move interface declarations to <Component>.model.ts or <Component>.types.ts.".into(),
            fingerprint: compute_fingerprint("VUE-003", "1.0", "interface_in_sfc", trimmed),
        });
    }
}

fn check_heavy_ast(trimmed: &str, file_path: &Path, line: usize, out: &mut Vec<Violation>) {
    if (trimmed.contains("ref<Large")
        || trimmed.contains("ref<SemanticDocument")
        || trimmed.contains("ref<AST")
        || trimmed.contains("ref<Ast")
        || trimmed.contains("reactive<Large")
        || trimmed.contains("reactive<SemanticDocument"))
        && !trimmed.contains("shallowRef")
    {
        out.push(Violation {
            rule_id: "PERF-001".into(),
            rule_version: "1.0".into(),
            category: Category::Performance,
            severity: Severity::Deny,
            file: file_path.to_path_buf(),
            line,
            column: 1,
            symbol: "shallowRef".into(),
            snippet: trimmed.to_string(),
            message: "Deep reactivity on large AST / heavy data structure causes severe CPU degradation".into(),
            remediation: "Use shallowRef() + triggerRef(), markRaw(), or Object.freeze() for heavy AST nodes.".into(),
            fingerprint: compute_fingerprint("PERF-001", "1.0", "deep_ref_heavy_ast", trimmed),
        });
    }
}

fn check_canvas_reactivity(trimmed: &str, file_path: &Path, line: usize, out: &mut Vec<Violation>) {
    if (trimmed.contains("reactive(new Scene")
        || trimmed.contains("ref(new Scene")
        || trimmed.contains("ref(new Editor")
        || trimmed.contains("reactive(new Editor")
        || trimmed.contains("ref(new Canvas")
        || trimmed.contains("reactive(new Canvas"))
        && !trimmed.contains("markRaw")
    {
        out.push(Violation {
            rule_id: "PERF-002".into(),
            rule_version: "1.0".into(),
            category: Category::Performance,
            severity: Severity::Deny,
            file: file_path.to_path_buf(),
            line,
            column: 1,
            symbol: "markRaw".into(),
            snippet: trimmed.to_string(),
            message: "Wrapping Three.js, Canvas, or Editor instance in Vue Proxy causes memory leaks and performance drop".into(),
            remediation: "Wrap external classes in markRaw(new Scene()) or markRaw(new Editor()).".into(),
            fingerprint: compute_fingerprint("PERF-002", "1.0", "reactive_canvas_three", trimmed),
        });
    }
}

fn check_raf_allocation(trimmed: &str, file_path: &Path, line: usize, out: &mut Vec<Violation>) {
    if trimmed.contains("new Array(")
        || trimmed.contains("new Object(")
        || trimmed.contains("new Vector3(")
        || trimmed.contains("new THREE.")
        || (trimmed.contains(".map(") && !trimmed.contains("const "))
        || (trimmed.contains(".filter(") && !trimmed.contains("const "))
    {
        out.push(Violation {
            rule_id: "PERF-003".into(),
            rule_version: "1.0".into(),
            category: Category::Performance,
            severity: Severity::Deny,
            file: file_path.to_path_buf(),
            line,
            column: 1,
            symbol: "renderLoop".into(),
            snippet: trimmed.to_string(),
            message: "Dynamic memory allocation inside requestAnimationFrame render loop triggers GC frame drops".into(),
            remediation: "Preallocate reusable objects, vectors and arrays outside the render loop.".into(),
            fingerprint: compute_fingerprint("PERF-003", "1.0", "raf_allocation", trimmed),
        });
    }
}

fn check_v_for_template_call(trimmed: &str, file_path: &Path, line: usize, out: &mut Vec<Violation>) {
    out.push(Violation {
        rule_id: "PERF-004".into(),
        rule_version: "1.0".into(),
        category: Category::Performance,
        severity: Severity::Deny,
        file: file_path.to_path_buf(),
        line,
        column: 1,
        symbol: "template_method".into(),
        snippet: trimmed.to_string(),
        message: "Uncached function call inside v-for template re-executes on every render frame".into(),
        remediation: "Precompute mapped values using a typed computed() property or Map.".into(),
        fingerprint: compute_fingerprint("PERF-004", "1.0", "uncached_template_call", trimmed),
    });
}

fn check_deep_watch(trimmed: &str, file_path: &Path, line: usize, out: &mut Vec<Violation>) {
    if trimmed.contains("deep: true") && trimmed.contains("watch(") {
        out.push(Violation {
            rule_id: "PERF-005".into(),
            rule_version: "1.0".into(),
            category: Category::Performance,
            severity: Severity::Deny,
            file: file_path.to_path_buf(),
            line,
            column: 1,
            symbol: "watch".into(),
            snippet: trimmed.to_string(),
            message: "Unrestricted watch(..., { deep: true }) causes recursive reactive storm".into(),
            remediation: "Use specific scalar getters in watch(() => [x.a, x.b]) or Vue 3.5+ depth limit { deep: 1 }.".into(),
            fingerprint: compute_fingerprint("PERF-005", "1.0", "deep_watch_cascade", trimmed),
        });
    }
}
