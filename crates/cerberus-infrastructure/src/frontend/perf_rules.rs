use cerberus_domain::{compute_fingerprint, Category, Severity, Violation};
use std::path::Path;

pub struct PerfRulesChecker;

impl PerfRulesChecker {
    pub fn check_source(source: &str, file_path: &Path) -> Vec<Violation> {
        let mut violations = Vec::new();
        let is_vue_file = file_path.extension().and_then(|e| e.to_str()) == Some("vue");

        let mut in_raf_block = false;
        let mut in_v_for_template = false;
        let mut in_loop_block = false;
        let mut loop_has_read = false;

        for (line_idx, line) in source.lines().enumerate() {
            let trimmed = line.trim();
            let line_num = line_idx + 1;

            if is_vue_file {
                check_vue_types(trimmed, file_path, line_num, &mut violations);
            }

            check_heavy_ast(trimmed, file_path, line_num, &mut violations);
            check_canvas_reactivity(trimmed, file_path, line_num, &mut violations);
            check_deep_watch(trimmed, file_path, line_num, &mut violations);

            // Loop tracking for Layout Thrashing
            if trimmed.contains(".forEach(")
                || trimmed.contains("for (")
                || trimmed.contains("for(")
                || trimmed.contains("while (")
                || trimmed.contains("while(")
            {
                in_loop_block = true;
                loop_has_read = false;
            }

            let has_read = trimmed.contains(".offsetHeight")
                || trimmed.contains(".offsetWidth")
                || trimmed.contains(".scrollTop")
                || trimmed.contains(".clientHeight")
                || trimmed.contains(".clientWidth")
                || trimmed.contains(".getBoundingClientRect()");

            let has_write = trimmed.contains(".style.")
                || trimmed.contains(".style[")
                || trimmed.contains(".classList.add(")
                || trimmed.contains(".classList.remove(")
                || trimmed.contains(".setAttribute('style'");

            if in_loop_block {
                if has_read {
                    loop_has_read = true;
                }
                if loop_has_read && has_write {
                    let fingerprint = compute_fingerprint("PERF-DOM-001", "1.0", "layout_thrashing", trimmed);
                    violations.push(Violation {
                        rule_id: "PERF-DOM-001".into(),
                        rule_version: "1.0".into(),
                        category: Category::Performance,
                        severity: Severity::Warn,
                        file: file_path.to_path_buf(),
                        line: line_num,
                        column: 1,
                        symbol: "layout_thrashing".into(),
                        snippet: trimmed.to_string(),
                        message: "Interleaving DOM geometry reads and style writes inside loop causes forced synchronous reflow (Layout Thrashing).".into(),
                        remediation: "Batch all DOM geometry measurements outside the loop, then schedule style writes inside requestAnimationFrame().".into(),
                        fingerprint,
                    });
                    loop_has_read = false;
                }
                if trimmed.contains("});") || trimmed == "}" {
                    in_loop_block = false;
                    loop_has_read = false;
                }
            } else if has_read && has_write {
                // Same line Layout Thrashing
                check_layout_thrashing(trimmed, file_path, line_num, &mut violations);
            }

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

            // V-For template method calls (VUE-009 / PERF-004)
            if trimmed.contains("v-for=") {
                in_v_for_template = true;
            }
            if in_v_for_template {
                if is_vue_file && has_call_in_interpolation(trimmed) {
                    check_v_for_template_call(trimmed, file_path, line_num, &mut violations);
                }
                if trimmed.contains("</template>")
                    || trimmed.contains("</div>")
                    || trimmed.contains("</option>")
                    || trimmed.contains("</span>")
                    || trimmed.contains("</li>")
                    || trimmed.contains("</select>")
                    || trimmed.contains("</ul>")
                    || trimmed.contains("</ol>")
                    || trimmed.contains("</details>")
                    || trimmed.contains("</tr>")
                    || trimmed.contains("</td>")
                    || trimmed.contains("</table>")
                    || (trimmed.starts_with("</") && trimmed.ends_with('>'))
                {
                    in_v_for_template = false;
                }
            }
        }

        violations
    }
}

fn check_layout_thrashing(trimmed: &str, file_path: &Path, line: usize, out: &mut Vec<Violation>) {
    let has_read = trimmed.contains(".offsetHeight")
        || trimmed.contains(".offsetWidth")
        || trimmed.contains(".scrollTop")
        || trimmed.contains(".clientHeight")
        || trimmed.contains(".clientWidth")
        || trimmed.contains(".getBoundingClientRect()");

    let has_write = trimmed.contains(".style.")
        || trimmed.contains(".style[")
        || trimmed.contains(".classList.add(")
        || trimmed.contains(".classList.remove(")
        || trimmed.contains(".setAttribute('style'");

    if has_read && has_write {
        let is_unthrottled_scroll = trimmed.contains("scroll") || trimmed.contains("resize");
        let severity = if is_unthrottled_scroll {
            Severity::Deny
        } else {
            Severity::Warn
        };

        out.push(Violation {
            rule_id: "PERF-DOM-001".into(),
            rule_version: "1.0".into(),
            category: Category::Performance,
            severity,
            file: file_path.to_path_buf(),
            line,
            column: 1,
            symbol: "layout_thrashing".into(),
            snippet: trimmed.to_string(),
            message: "Interleaving DOM geometry reads and style writes causes forced synchronous reflow (Layout Thrashing).".into(),
            remediation: "Batch all DOM geometry measurements first, then schedule style writes inside requestAnimationFrame().".into(),
            fingerprint: compute_fingerprint("PERF-DOM-001", "1.0", "layout_thrashing", trimmed),
        });
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

fn has_call_in_interpolation(trimmed: &str) -> bool {
    let mut rest = trimmed;
    while let Some((_, after_open)) = rest.split_once("{{") {
        if let Some((inside, after_close)) = after_open.split_once("}}") {
            let expr = inside.trim();
            if let Some((before_paren, after_paren)) = expr.split_once('(') {
                if after_paren.contains(')') {
                    let ident = before_paren.trim_end();
                    if ident.chars().last().is_some_and(|c| c.is_alphanumeric() || c == '_') {
                        return true;
                    }
                }
            }
            rest = after_close;
        } else {
            break;
        }
    }
    false
}

fn check_v_for_template_call(trimmed: &str, file_path: &Path, line: usize, out: &mut Vec<Violation>) {
    out.push(Violation {
        rule_id: "VUE-009".into(),
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
        fingerprint: compute_fingerprint("VUE-009", "1.0", "uncached_template_call", trimmed),
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_perf_rules_comprehensive() {
        let code = r#"
            interface Props { title: string }
            type Props = { title: string }
            type Emits = { (e: 'save'): void }
            export interface Dto { id: number }
            const doc1 = ref<LargeSemanticDocument>(raw);
            const doc2 = reactive<LargeSemanticDocument>(raw);
            const scene1 = reactive(new Scene());
            const scene2 = ref(new Scene());
            const editor1 = ref(new Editor());
            const editor2 = reactive(new Editor());
            const canvas1 = ref(new Canvas());
            const canvas2 = reactive(new Canvas());
            const w = watch(x, () => {}, { deep: true });

            requestAnimationFrame(() => {
                const arr = new Array(10);
                const obj = new Object();
                const v = new Vector3(1, 2, 3);
                const t = new THREE.Mesh();
                const mapped = raw.map(x => x + 1);
                const filtered = raw.filter(x => x > 0);
            });

            function renderLoop() {
                const arr2 = new Array(5);
            }

            // Same line Layout Thrashing with various DOM properties
            window.onscroll = () => { el.style.height = `${el.offsetHeight}px`; };
            window.onresize = () => { el.style['width'] = `${el.offsetWidth}px`; };
            el.classList.add('active'); let top = el.scrollTop;
            el.classList.remove('hidden'); let h = el.clientHeight;
            el.setAttribute('style', 'color: red'); let w2 = el.clientWidth;
            el.style.width = `${el.getBoundingClientRect().width}px`;

            // Loop Layout Thrashing
            for (let i = 0; i < 10; i++) {
                const top = el.scrollTop;
                el.classList.add('active');
            }
            while (running) {
                const h = el.clientHeight;
                el.classList.remove('hidden');
            }
            elements.forEach(el => {
                const w = el.clientWidth;
                const rect = el.getBoundingClientRect();
                el.style.height = `${rect.height}px`;
                el.setAttribute('style', 'color: red');
            });

            // v-for template method and underscore function name
            <template>
                <div v-for="item in items">
                    {{ compute(item) }}
                    {{ calc_extra_(item) }}
                </div>
                <custom-panel v-for="c in cards">
                    {{ render_card(c) }}
                </custom-panel>
            </template>
        "#;

        let violations = PerfRulesChecker::check_source(code, Path::new("Test.vue"));
        assert!(violations.iter().any(|v| v.rule_id == "VUE-003"));
        assert!(violations.iter().any(|v| v.rule_id == "PERF-001"));
        assert!(violations.iter().any(|v| v.rule_id == "PERF-002"));
        assert!(violations.iter().any(|v| v.rule_id == "PERF-003"));
        assert!(violations.iter().any(|v| v.rule_id == "PERF-005"));
        assert!(violations.iter().any(|v| v.rule_id == "PERF-DOM-001"));
        assert!(violations.iter().any(|v| v.rule_id == "VUE-009"));

        // Check Deny severity for resize/scroll layout thrashing
        assert!(violations.iter().any(|v| v.rule_id == "PERF-DOM-001" && v.severity == Severity::Deny));
        // Check Warn severity for non-scroll layout thrashing
        assert!(violations.iter().any(|v| v.rule_id == "PERF-DOM-001" && v.severity == Severity::Warn));
    }

    #[test]
    fn test_vue_009_positive_and_negative_plain_text() {
        let code_negative = r#"
            <template>
                <div v-for="loc in locations" :key="loc.id">
                    <span>{{ loc.name }} (сущность)</span>
                </div>
            </template>
        "#;
        let v_neg = PerfRulesChecker::check_source(code_negative, Path::new("Negative.vue"));
        assert!(v_neg.is_empty());

        // Positive test ensuring the closure `|v| v.rule_id == "VUE-009"` is executed on non-empty results
        let code_positive = r#"
            <template>
                <div v-for="loc in locations" :key="loc.id">
                    <span>{{ format_name(loc) }}</span>
                </div>
            </template>
        "#;
        let v_pos = PerfRulesChecker::check_source(code_positive, Path::new("Positive.vue"));
        assert_eq!(v_pos.len(), 1);
        assert!(v_pos.iter().any(|v| v.rule_id == "VUE-009"));
    }
}
