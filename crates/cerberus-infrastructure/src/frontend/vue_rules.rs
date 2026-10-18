use cerberus_domain::{compute_fingerprint, Category, Severity, Violation};

use crate::frontend::sfc_parser::VueSfc;
use std::path::Path;

pub struct VueRuleChecker;

impl VueRuleChecker {
    pub fn check(sfc: &VueSfc, file_path: &Path) -> Vec<Violation> {
        let mut violations = Vec::new();
        let file_stem = file_path
            .file_stem()
            .map_or("Component", |s| s.to_str().unwrap_or("Component"));
        let file_dir = file_path.parent();

        let full_script = format!(
            "{}\n{}",
            sfc.script.as_deref().unwrap_or(""),
            sfc.script_setup.as_deref().unwrap_or("")
        );

        // 1. TAURI-002: Direct IPC in UI Component
        if full_script.contains("@tauri-apps/api")
            || full_script.contains("@tauri-apps/plugin-shell")
            || full_script.contains("invoke(")
            || full_script.contains("window.__TAURI__")
        {
            let mut snippet_lines = Vec::new();
            for l in full_script.lines() {
                if l.contains("@tauri-apps/api")
                    || l.contains("@tauri-apps/plugin-shell")
                    || l.contains("invoke(")
                    || l.contains("__TAURI__")
                {
                    snippet_lines.push(l.trim());
                    if snippet_lines.len() >= 3 {
                        break;
                    }
                }
            }
            let snippet = snippet_lines.join("\n");

            let fingerprint = compute_fingerprint("TAURI-002", "1.0", file_stem, &snippet);

            let mut line = None;
            if let Some(setup) = &sfc.script_setup {
                for (idx, l) in setup.lines().enumerate() {
                    if l.contains("@tauri-apps/api")
                        || l.contains("@tauri-apps/plugin-shell")
                        || l.contains("invoke(")
                        || l.contains("window.__TAURI__")
                    {
                        line = Some(sfc.script_setup_start_line + idx);
                        break;
                    }
                }
            }
            if line.is_none() {
                if let Some(script) = &sfc.script {
                    for (idx, l) in script.lines().enumerate() {
                        if l.contains("@tauri-apps/api")
                            || l.contains("@tauri-apps/plugin-shell")
                            || l.contains("invoke(")
                            || l.contains("window.__TAURI__")
                        {
                            line = Some(idx + 1);
                            break;
                        }
                    }
                }
            }
            let line = line.unwrap_or(if sfc.script_setup_start_line > 0 {
                sfc.script_setup_start_line
            } else {
                1
            });

            violations.push(Violation {
                rule_id: "TAURI-002".into(),
                rule_version: "1.0".into(),
                category: Category::Architecture,
                severity: Severity::Deny,
                file: file_path.to_path_buf(),
                line,
                column: 1,
                symbol: file_stem.to_string(),
                snippet,
                message: format!("Vue SFC '{}' directly calls Tauri IPC or imports @tauri-apps/api", file_path.display()),
                remediation: "Isolate Tauri IPC calls into a composable hook (use*.ts) or API Client service (@/shared/api/*.ts).".into(),
                fingerprint,
            });
        }

        // 2. VUE-001 & VUE-002: Script Setup Purity & Companion Hook Check
        if let Some(script_setup) = &sfc.script_setup {
            let has_heavy_logic = script_setup.contains("function ")
                || script_setup.contains("reactive(")
                || script_setup.contains("computed(")
                || script_setup.contains("watch(")
                || script_setup.contains("ref(");

            if has_heavy_logic {
                let logic_snippet = script_setup
                    .lines()
                    .map(|l| l.trim())
                    .filter(|l| {
                        l.starts_with("function ")
                            || l.contains("reactive(")
                            || l.contains("computed(")
                            || l.contains("watch(")
                            || l.contains("ref(")
                    })
                    .take(3)
                    .collect::<Vec<_>>()
                    .join("\n");

                let fingerprint = compute_fingerprint("VUE-001", "1.0", file_stem, &logic_snippet);

                violations.push(Violation {
                    rule_id: "VUE-001".into(),
                    rule_version: "1.0".into(),
                    category: Category::Convention,
                    severity: Severity::Deny,
                    file: file_path.to_path_buf(),
                    line: sfc.script_setup_start_line,
                    column: 1,
                    symbol: file_stem.to_string(),
                    snippet: logic_snippet.clone(),
                    message: format!(
                        "Vue component '{}' contains raw business logic (functions, state, computed/watch) in <script setup>. <script setup> must contain only glue code (props, emits, hook calls).",
                        file_path.display()
                    ),
                    remediation: format!("Extract all functions, state, computed properties, and watchers into companion composable use{}.ts.", file_stem),
                    fingerprint,
                });

                let has_companion = if let Some(dir) = file_dir {
                    let companion1 = dir.join(format!("use{}.ts", file_stem));
                    let companion2 = dir.join("hooks").join(format!("use{}.ts", file_stem));
                    companion1.exists() || companion2.exists()
                } else {
                    false
                };

                if !has_companion {
                    let fp2 = compute_fingerprint("VUE-002", "1.0", file_stem, &logic_snippet);
                    violations.push(Violation {
                        rule_id: "VUE-002".into(),
                        rule_version: "1.0".into(),
                        category: Category::Convention,
                        severity: Severity::Deny,
                        file: file_path.to_path_buf(),
                        line: sfc.script_setup_start_line,
                        column: 1,
                        symbol: file_stem.to_string(),
                        snippet: logic_snippet,
                        message: format!(
                            "Vue component '{}' is missing required companion hook use{}.ts",
                            file_path.display(),
                            file_stem
                        ),
                        remediation: format!("Create use{}.ts alongside {}.vue.", file_stem, file_stem),
                        fingerprint: fp2,
                    });
                }
            }
        }

        // Run script-level AST rules across the full script content
        Self::check_script_rules(&full_script, file_path, &mut violations);

        violations
    }

    pub fn check_script_rules(content: &str, file_path: &Path, violations: &mut Vec<Violation>) {
        let file_stem = file_path
            .file_stem()
            .map_or("script", |s| s.to_str().unwrap_or("script"));

        for (idx, line) in content.lines().enumerate() {
            let trimmed = line.trim();
            let line_num = idx + 1;

            if trimmed.is_empty() || trimmed.starts_with("//") || trimmed.starts_with("/*") {
                continue;
            }

            // 3. VUE-007: Reactivity Destructuring Loss
            if (trimmed.starts_with("const {") || trimmed.starts_with("let {"))
                && (trimmed.contains("= props")
                    || trimmed.contains("= defineProps")
                    || trimmed.contains("Store")
                    || (trimmed.contains("= use") && trimmed.contains("Store")))
                && !trimmed.contains("toRefs(")
                && !trimmed.contains("storeToRefs(")
            {
                let fingerprint = compute_fingerprint("VUE-007", "1.0", file_stem, trimmed);
                violations.push(Violation {
                    rule_id: "VUE-007".into(),
                    rule_version: "1.0".into(),
                    category: Category::Robustness,
                    severity: Severity::Deny,
                    file: file_path.to_path_buf(),
                    line: line_num,
                    column: 1,
                    symbol: "props_destructure".into(),
                    snippet: trimmed.to_string(),
                    message: "Destructuring props or store directly breaks Vue 3 reactive Proxy connections.".into(),
                    remediation: "Use toRefs(props) or storeToRefs(store) or access properties directly via props.<name>.".into(),
                    fingerprint,
                });
            }

            // 4. VUE-008: Direct Prop Mutation
            if Self::is_prop_mutation(trimmed) {
                let fingerprint = compute_fingerprint("VUE-008", "1.0", file_stem, trimmed);
                violations.push(Violation {
                    rule_id: "VUE-008".into(),
                    rule_version: "1.0".into(),
                    category: Category::Convention,
                    severity: Severity::Deny,
                    file: file_path.to_path_buf(),
                    line: line_num,
                    column: 1,
                    symbol: "prop_mutation".into(),
                    snippet: trimmed.to_string(),
                    message: "Directly mutating props breaks Vue one-way data flow and parent state isolation.".into(),
                    remediation: "Emit update event to parent (emit('update:...')) instead of directly mutating props.".into(),
                    fingerprint,
                });
            }

            // 5. TS-BORROW-001: Direct Store State Aliasing Mutation
            if !file_path.to_string_lossy().contains(".store.")
                && (trimmed.contains("Store.state.")
                    || (trimmed.contains("store.")
                        && trimmed.contains(".state.")
                        && trimmed.contains(" = ")))
            {
                let fingerprint = compute_fingerprint("TS-BORROW-001", "1.0", file_stem, trimmed);
                violations.push(Violation {
                    rule_id: "TS-BORROW-001".into(),
                    rule_version: "1.0".into(),
                    category: Category::Architecture,
                    severity: Severity::Deny,
                    file: file_path.to_path_buf(),
                    line: line_num,
                    column: 1,
                    symbol: "store_aliasing".into(),
                    snippet: trimmed.to_string(),
                    message: "Directly mutating store state from UI component bypasses store actions.".into(),
                    remediation: "Invoke typed store action method to mutate state instead of direct assignment.".into(),
                    fingerprint,
                });
            }
        }

        // 6. TS-MATCH-001: Tagged Union Exhaustive Match
        Self::check_exhaustive_switch(content, file_path, violations);
    }

    pub fn is_prop_mutation(trimmed: &str) -> bool {
        if trimmed.is_empty()
            || trimmed.starts_with("//")
            || trimmed.starts_with("/*")
            || trimmed.starts_with('*')
        {
            return false;
        }

        // Variable declarations, control flow statements and closing braces are not mutations
        if trimmed.starts_with("const ")
            || trimmed.starts_with("let ")
            || trimmed.starts_with("var ")
            || trimmed.starts_with("if (")
            || trimmed.starts_with("if(")
            || trimmed.starts_with('}')
            || trimmed.starts_with("return ")
        {
            return false;
        }

        // 1. Mutating array method calls: props.<item>.push(...), props.<list>.splice(...)
        let mutating_methods = [
            ".push(", ".splice(", ".pop(", ".shift(", ".unshift(", ".reverse(", ".sort(",
        ];
        for method in mutating_methods {
            if let Some(idx) = trimmed.find(method) {
                let before = &trimmed[..idx];
                let target = before
                    .split([';', '{', '(', ',', '&', '|'])
                    .next_back()
                    .unwrap_or("")
                    .trim();
                if target.starts_with("props.") || target.contains(" props.") {
                    return true;
                }
            }
        }

        // 2. Direct assignments into props: props.<field> = ..., props.<field> += ...
        let assign_ops = [" += ", " -= ", " = "];
        for op in assign_ops {
            if let Some(idx) = trimmed.find(op) {
                let left_side = trimmed[..idx].trim();
                // Exclude comparison operators and arrow functions
                if left_side.ends_with('=')
                    || left_side.ends_with('!')
                    || left_side.ends_with('<')
                    || left_side.ends_with('>')
                {
                    continue;
                }
                if trimmed.contains("==") || trimmed.contains("===") {
                    continue;
                }

                let target = left_side
                    .split([';', '{', '('])
                    .next_back()
                    .unwrap_or("")
                    .trim();

                if target.starts_with("props.") || target.contains(" props.") {
                    return true;
                }
            }
        }

        false
    }

    fn check_exhaustive_switch(content: &str, file_path: &Path, violations: &mut Vec<Violation>) {
        let file_stem = file_path
            .file_stem()
            .map_or("script", |s| s.to_str().unwrap_or("script"));
        let lines: Vec<&str> = content.lines().collect();

        for (i, line) in lines.iter().enumerate() {
            let trimmed = line.trim();
            if trimmed.starts_with("switch (") || trimmed.starts_with("switch(") {
                let is_discriminant = trimmed.contains(".type")
                    || trimmed.contains(".kind")
                    || trimmed.contains(".status")
                    || trimmed.contains("discriminant");

                if is_discriminant {
                    // Check next ~40 lines for switch block content
                    let max_lookahead = (i + 40).min(lines.len());
                    let block_slice = &lines[i..max_lookahead];
                    let block_text = block_slice.join("\n");

                    let case_count = block_slice
                        .iter()
                        .filter(|l| l.trim().starts_with("case "))
                        .count();
                    let has_default_assert_never = block_text.contains("assertNever(")
                        || block_text.contains(": never")
                        || (block_text.contains("default:") && block_text.contains("throw "));

                    // Rule triggers on multi-case (>2) tagged unions without exhaustive default
                    if case_count > 2 && !has_default_assert_never {
                        let snippet = block_slice
                            .iter()
                            .take(4)
                            .copied()
                            .collect::<Vec<_>>()
                            .join("\n");
                        let fingerprint =
                            compute_fingerprint("TS-MATCH-001", "1.0", file_stem, &snippet);

                        violations.push(Violation {
                            rule_id: "TS-MATCH-001".into(),
                            rule_version: "1.0".into(),
                            category: Category::Robustness,
                            severity: Severity::Deny,
                            file: file_path.to_path_buf(),
                            line: i + 1,
                            column: 1,
                            symbol: "switch_exhaustive".into(),
                            snippet,
                            message: "Switch on multi-variant tagged union lacks exhaustive assertNever default branch.".into(),
                            remediation: "Add default: return assertNever(discriminant); to guarantee compile-time exhaustiveness.".into(),
                            fingerprint,
                        });
                    }
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_vue_rule_checker_tauri_import_tauri002() {
        let sfc = VueSfc {
            script_setup: Some("import { invoke } from '@tauri-apps/api/core';".into()),
            ..Default::default()
        };
        let violations = VueRuleChecker::check(&sfc, Path::new("src/Component.vue"));
        assert_eq!(violations.len(), 1);
        assert_eq!(violations[0].rule_id, "TAURI-002");
    }

    #[test]
    fn test_vue_rule_checker_destructure_vue007() {
        let sfc = VueSfc {
            script_setup: Some("const { count, item } = props;".into()),
            ..Default::default()
        };
        let violations = VueRuleChecker::check(&sfc, Path::new("src/Component.vue"));
        assert!(violations.iter().any(|v| v.rule_id == "VUE-007"));

        // toRefs should not violate
        let clean_sfc = VueSfc {
            script_setup: Some("const { count } = toRefs(props);".into()),
            ..Default::default()
        };
        assert!(VueRuleChecker::check(&clean_sfc, Path::new("src/Component.vue")).is_empty());
    }

    #[test]
    fn test_vue_rule_checker_prop_mutation_vue008() {
        let sfc = VueSfc {
            script_setup: Some(
                "function update() { props.chapter.title = 'New'; props.tags.push('draft'); }"
                    .into(),
            ),
            ..Default::default()
        };
        let violations = VueRuleChecker::check(&sfc, Path::new("src/Component.vue"));
        assert!(violations.iter().any(|v| v.rule_id == "VUE-008"));
    }

    #[test]
    fn test_is_prop_mutation_positive() {
        assert!(VueRuleChecker::is_prop_mutation("props.chapter.title = 'New'"));
        assert!(VueRuleChecker::is_prop_mutation("props.tags.push('draft')"));
        assert!(VueRuleChecker::is_prop_mutation("props.tags.splice(0, 1)"));
        assert!(VueRuleChecker::is_prop_mutation("props.tags.pop()"));
        assert!(VueRuleChecker::is_prop_mutation("props.tags.shift()"));
        assert!(VueRuleChecker::is_prop_mutation("props.tags.unshift('x')"));
        assert!(VueRuleChecker::is_prop_mutation("props.tags.reverse()"));
        assert!(VueRuleChecker::is_prop_mutation("props.tags.sort()"));
        assert!(VueRuleChecker::is_prop_mutation("props.count += 1"));
        assert!(VueRuleChecker::is_prop_mutation("props.count -= 1"));
        assert!(VueRuleChecker::is_prop_mutation("doAction(); props.active = true"));
        assert!(VueRuleChecker::is_prop_mutation("x = props.tags.push('item');"));
        assert!(VueRuleChecker::is_prop_mutation("{ props.selected = id }"));
        assert!(VueRuleChecker::is_prop_mutation("props.items[0].name = 'test'"));
    }

    #[test]
    fn test_is_prop_mutation_negative() {
        assert!(!VueRuleChecker::is_prop_mutation(""));
        assert!(!VueRuleChecker::is_prop_mutation("// props.title = 'New'"));
        assert!(!VueRuleChecker::is_prop_mutation("/* props.title = 'New' */"));
        assert!(!VueRuleChecker::is_prop_mutation("* props.title = 'New'"));
        assert!(!VueRuleChecker::is_prop_mutation("const { title } = props.panel;"));
        assert!(!VueRuleChecker::is_prop_mutation("let x = props.value;"));
        assert!(!VueRuleChecker::is_prop_mutation("var y = props.title;"));
        assert!(!VueRuleChecker::is_prop_mutation("if (props.isValid) {"));
        assert!(!VueRuleChecker::is_prop_mutation("if(props.isValid) {"));
        assert!(!VueRuleChecker::is_prop_mutation("} = props.panel;"));
        assert!(!VueRuleChecker::is_prop_mutation("} = useGlobalTimeViewer(() => props.projectName);"));
        assert!(!VueRuleChecker::is_prop_mutation("return props.count;"));
        assert!(!VueRuleChecker::is_prop_mutation("props.count === 1"));
        assert!(!VueRuleChecker::is_prop_mutation("props.count == 1"));
        assert!(!VueRuleChecker::is_prop_mutation("props.count != 1"));
        assert!(!VueRuleChecker::is_prop_mutation("props.count <= 1"));
        assert!(!VueRuleChecker::is_prop_mutation("props.count >= 1"));
        assert!(!VueRuleChecker::is_prop_mutation("props.count == = 1"));
        assert!(!VueRuleChecker::is_prop_mutation("props.count != = 1"));
        assert!(!VueRuleChecker::is_prop_mutation("props.count <= = 1"));
        assert!(!VueRuleChecker::is_prop_mutation("props.count >= = 1"));
        assert!(!VueRuleChecker::is_prop_mutation("flag = props.count == 1"));
        assert!(!VueRuleChecker::is_prop_mutation("const flag = props.val == 2;"));
    }

    #[test]
    fn test_vue_rule_checker_multiline_destructuring_and_props_arg_no_vue008() {
        let code = r#"
            const {
                isVisible,
                minute
            } = useGlobalTimeViewer(() => props.projectName);

            const {
                a,
                b
            } = props.panel;
        "#;
        let sfc = VueSfc {
            script_setup: Some(code.into()),
            ..Default::default()
        };
        let violations = VueRuleChecker::check(&sfc, Path::new("src/Component.vue"));
        assert!(violations.is_empty());
    }

    #[test]
    fn test_vue_rule_checker_exhaustive_match_tsmatch001() {
        let code = r#"
            switch (node.type) {
                case 'paragraph': return 1;
                case 'heading': return 2;
                case 'code': return 3;
            }
        "#;
        let sfc = VueSfc {
            script_setup: Some(code.into()),
            ..Default::default()
        };
        let violations = VueRuleChecker::check(&sfc, Path::new("src/Component.vue"));
        assert!(violations.iter().any(|v| v.rule_id == "TS-MATCH-001"));

        // Fixed with assertNever
        let fixed_code = r#"
            switch (node.type) {
                case 'paragraph': return 1;
                case 'heading': return 2;
                case 'code': return 3;
                default: return assertNever(node);
            }
        "#;
        let clean_sfc = VueSfc {
            script_setup: Some(fixed_code.into()),
            ..Default::default()
        };
        assert!(VueRuleChecker::check(&clean_sfc, Path::new("src/Component.vue")).is_empty());
    }

    #[test]
    fn test_vue_rule_checker_exhaustive_match_other_discriminants_and_throw() {
        let kind_code = r#"
            switch (item.kind) {
                case 'a': return 1;
                case 'b': return 2;
                case 'c': return 3;
            }
        "#;
        let sfc_kind = VueSfc {
            script_setup: Some(kind_code.into()),
            ..Default::default()
        };
        assert!(!VueRuleChecker::check(&sfc_kind, Path::new("src/Component.vue")).is_empty());

        let status_code = r#"
            switch (task.status) {
                case 'pending': return 1;
                case 'running': return 2;
                case 'completed': return 3;
            }
        "#;
        let sfc_status = VueSfc {
            script_setup: Some(status_code.into()),
            ..Default::default()
        };
        assert!(!VueRuleChecker::check(&sfc_status, Path::new("src/Component.vue")).is_empty());

        let discriminant_code = r#"
            switch (action.discriminant) {
                case 'open': return 1;
                case 'close': return 2;
                case 'toggle': return 3;
                default: throw new Error('Unhandled');
            }
        "#;
        let sfc_throw = VueSfc {
            script_setup: Some(discriminant_code.into()),
            ..Default::default()
        };
        assert!(VueRuleChecker::check(&sfc_throw, Path::new("src/Component.vue")).is_empty());
    }

    #[test]
    fn test_vue_rule_checker_store_aliasing() {
        let code = "store.settings.state.enabled = false;";
        let sfc = VueSfc {
            script_setup: Some(code.into()),
            ..Default::default()
        };
        let violations = VueRuleChecker::check(&sfc, Path::new("src/Component.vue"));
        assert!(violations.iter().any(|v| v.rule_id == "TS-BORROW-001"));
    }

    #[test]
    fn test_vue_rule_checker_bloated_script_setup_vue001() {
        let temp = tempdir().unwrap();
        let comp_path = temp.path().join("MyComponent.vue");

        let mut heavy_lines = vec!["const a = ref(1);", "const b = computed(() => 2);"];
        heavy_lines.extend(vec!["console.log('line');"; 40]);
        let sfc = VueSfc {
            script_setup: Some(heavy_lines.join("\n")),
            script_setup_start_line: 1,
            ..Default::default()
        };

        let violations = VueRuleChecker::check(&sfc, &comp_path);
        assert!(violations.iter().any(|v| v.rule_id == "VUE-001"));
        assert!(violations.iter().any(|v| v.rule_id == "VUE-002"));

        // When component has no parent directory (Path::new("") has parent None)
        let root_violations = VueRuleChecker::check(&sfc, Path::new(""));
        assert!(root_violations.iter().any(|v| v.rule_id == "VUE-002"));

        // Companion hook + clean glue code satisfies both VUE-001 and VUE-002
        std::fs::write(
            temp.path().join("useMyComponent.ts"),
            "export const useMyComponent = () => {};",
        )
        .unwrap();

        let clean_glue_sfc = VueSfc {
            script_setup: Some("import { useMyComponent } from './useMyComponent';\nconst { a, b } = useMyComponent();".into()),
            script_setup_start_line: 1,
            ..Default::default()
        };
        let violations_with_hook = VueRuleChecker::check(&clean_glue_sfc, &comp_path);
        assert!(violations_with_hook.is_empty());
    }

    #[test]
    fn test_vue_rule_checker_tauri_002_setup_and_plain_script() {
        // 1. In script setup
        let sfc_setup = VueSfc {
            script_setup: Some("import { invoke } from '@tauri-apps/api';\ninvoke('save_chapter');".into()),
            script_setup_start_line: 10,
            ..Default::default()
        };
        let violations1 = VueRuleChecker::check(&sfc_setup, Path::new("src/Component.vue"));
        assert!(violations1.iter().any(|v| v.rule_id == "TAURI-002" && v.line == 10));

        // 2. In plain script without setup
        let sfc_script = VueSfc {
            script: Some("import { invoke } from '@tauri-apps/plugin-shell';\nwindow.__TAURI__.call();".into()),
            ..Default::default()
        };
        let violations2 = VueRuleChecker::check(&sfc_script, Path::new("src/Legacy.vue"));
        assert!(violations2.iter().any(|v| v.rule_id == "TAURI-002" && v.line == 1));

        // 3. Plain script with invoke/window.__TAURI__ on first matching line
        let sfc_script_invoke = VueSfc {
            script: Some("invoke('save_chapter');".into()),
            ..Default::default()
        };
        let violations_invoke = VueRuleChecker::check(&sfc_script_invoke, Path::new("src/Invoke.vue"));
        assert_eq!(violations_invoke.len(), 1);

        let sfc_script_tauri = VueSfc {
            script: Some("window.__TAURI__.call();".into()),
            ..Default::default()
        };
        let violations_tauri = VueRuleChecker::check(&sfc_script_tauri, Path::new("src/Tauri.vue"));
        assert_eq!(violations_tauri.len(), 1);

        // 4. More than 3 Tauri snippet lines to trigger break
        let sfc_multi = VueSfc {
            script_setup: Some(
                "import { invoke } from '@tauri-apps/api';\nimport { shell } from '@tauri-apps/plugin-shell';\ninvoke('a');\nwindow.__TAURI__.call();".into(),
            ),
            ..Default::default()
        };
        let violations_multi = VueRuleChecker::check(&sfc_multi, Path::new("src/Multi.vue"));
        assert_eq!(violations_multi.len(), 1);

        // 5. Clean component without Tauri API calls
        let sfc_clean = VueSfc {
            script_setup: Some("const greeting = 'hello';".into()),
            ..Default::default()
        };
        let violations3 = VueRuleChecker::check(&sfc_clean, Path::new("src/Clean.vue"));
        assert!(violations3.is_empty());
    }
}
