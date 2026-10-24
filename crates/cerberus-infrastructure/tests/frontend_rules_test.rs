use cerberus_infrastructure::{FsdLayer, FsdRulesChecker, PerfRulesChecker};
use std::path::Path;

#[test]
fn test_fsd_layer_parsing() {
    assert_eq!(
        FsdLayer::parse("src/entities/user/model.ts"),
        FsdLayer::Entities
    );
    assert_eq!(
        FsdLayer::parse("src/features/auth/useAuth.ts"),
        FsdLayer::Features
    );
    assert_eq!(
        FsdLayer::parse("src/widgets/header/Header.vue"),
        FsdLayer::Widgets
    );
    assert_eq!(FsdLayer::parse("src/pages/home/Home.vue"), FsdLayer::Pages);
    assert_eq!(
        FsdLayer::parse("src/shared/ui/button.vue"),
        FsdLayer::Shared
    );
    assert_eq!(FsdLayer::parse("src/utils/math.ts"), FsdLayer::Unknown);
}

#[test]
fn test_fsd_violations_detection() {
    let entities_file = Path::new("src/entities/user/useUser.ts");
    let code = r#"
        import { useAuth } from '@/features/auth';
        import { Button } from '@/shared/ui';
        import { secret } from '@/features/auth/internal/secret';
    "#;

    let violations = FsdRulesChecker::check_source(code, entities_file);
    assert_eq!(violations.len(), 3);
    assert_eq!(
        violations.iter().filter(|v| v.rule_id == "FSD-001").count(),
        2
    );
    assert_eq!(
        violations.iter().filter(|v| v.rule_id == "FSD-002").count(),
        1
    );
}

#[test]
fn test_fsd_uikit_purity_check() {
    let uikit_file = Path::new("packages/components/src/Button.vue");
    let code = "import { useUserStore } from '@/stores/user';";
    let violations = FsdRulesChecker::check_source(code, uikit_file);
    assert_eq!(violations.len(), 1);
    assert_eq!(violations[0].rule_id, "FSD-003");
}

#[test]
fn test_fsd_cross_slice_dependency_check() {
    let feature_auth = Path::new("src/features/auth/useAuth.ts");
    let code = "import { getCart } from '@/features/cart';";
    let violations = FsdRulesChecker::check_source(code, feature_auth);
    assert_eq!(violations.len(), 1);
    assert_eq!(violations[0].rule_id, "FSD-004");
}

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
    assert!(violations.iter().any(|v| v.rule_id == "VUE-009"));
}

#[test]
fn test_vue_003_inline_macro_types() {
    let code = r#"
        <script setup lang="ts">
        const props = defineProps<{
            projectId?: string;
        }>();
        const emit = defineEmits<{
            (e: 'save'): void;
        }>();
        </script>
    "#;
    let file = Path::new("src/components/MyComp.vue");
    let violations = PerfRulesChecker::check_source(code, file);
    let vue003_count = violations.iter().filter(|v| v.rule_id == "VUE-003").count();
    assert_eq!(vue003_count, 2);
}

#[test]
fn test_deep_watch_cascade_check() {
    let code = "watch(props.modelValue, (val) => {}, { deep: true });";
    let file = Path::new("src/useForm.ts");
    let violations = PerfRulesChecker::check_source(code, file);
    assert_eq!(violations.len(), 1);
    assert_eq!(violations[0].rule_id, "PERF-005");
}

#[test]
fn test_fsd_and_vue_sfc_deep_coverage() {
    use cerberus_infrastructure::VueSfcParserAdapter;
    use cerberus_ports::AstParserPort;
    use tempfile::tempdir;

    // 1. FSD Layer variations & as_str
    assert_eq!(FsdLayer::parse("src/app/main.ts"), FsdLayer::App);
    assert_eq!(FsdLayer::parse("app/main.ts"), FsdLayer::App);
    assert_eq!(FsdLayer::Shared.as_str(), "shared");
    assert_eq!(FsdLayer::Entities.as_str(), "entities");
    assert_eq!(FsdLayer::Features.as_str(), "features");
    assert_eq!(FsdLayer::Widgets.as_str(), "widgets");
    assert_eq!(FsdLayer::Pages.as_str(), "pages");
    assert_eq!(FsdLayer::App.as_str(), "app");
    assert_eq!(FsdLayer::Unknown.as_str(), "unknown");
    assert!(FsdLayer::Unknown.can_import(FsdLayer::Shared));
    assert!(FsdLayer::Features.can_import(FsdLayer::Unknown));

    // 2. UIKit purity checks for pinia, app, features, entities
    let uikit_file = Path::new("packages/components/src/Button.vue");
    let code_pinia = "import { defineStore } from 'pinia';";
    let code_app = "import { router } from '@/app/router';";
    let code_feat = "import { auth } from '@/features/auth';";
    let code_ent = "import { user } from '@/entities/user';";
    assert_eq!(
        FsdRulesChecker::check_source(code_pinia, uikit_file).len(),
        1
    );
    assert_eq!(FsdRulesChecker::check_source(code_app, uikit_file).len(), 1);
    assert_eq!(
        FsdRulesChecker::check_source(code_feat, uikit_file).len(),
        1
    );
    assert_eq!(FsdRulesChecker::check_source(code_ent, uikit_file).len(), 1);

    // 3. Public API internals: model and ui
    let ent_file = Path::new("src/entities/user/useUser.ts");
    let code_internals = r#"
        import { slice } from '@/features/auth/model/slice';
        import { Widget } from '@/entities/session/ui/Widget';
    "#;
    let v_internals = FsdRulesChecker::check_source(code_internals, ent_file);
    assert_eq!(
        v_internals
            .iter()
            .filter(|v| v.rule_id == "FSD-002")
            .count(),
        2
    );

    // 4. VueSfcParserAdapter .js, SLOC warn & deny for use*.ts and helpers
    let adapter = VueSfcParserAdapter::default();
    let temp = tempdir().unwrap();

    // JS file
    let js_path = temp.path().join("script.js");
    std::fs::write(&js_path, "export const x = 1;").unwrap();
    assert!(adapter.parse_file(&js_path, "spa").is_ok());

    // useComposable.ts with warn SLOC (280 lines > 250 + 15 grace)
    let use_ts = temp.path().join("useCustom.ts");
    let mut use_code = String::new();
    for _ in 0..280 {
        use_code.push_str("const a = 1;\n");
    }
    std::fs::write(&use_ts, &use_code).unwrap();
    let use_violations = adapter.parse_file(&use_ts, "spa").unwrap();
    assert!(use_violations
        .iter()
        .any(|v| v.rule_id == "ARCH-031" && v.severity == cerberus_domain::Severity::Warn));

    // useComposable.ts with deny SLOC (480 lines > 450 + 15 grace)
    let use_deny_ts = temp.path().join("useHeavy.ts");
    let mut use_deny_code = String::new();
    for _ in 0..480 {
        use_deny_code.push_str("const a = 1;\n");
    }
    std::fs::write(&use_deny_ts, &use_deny_code).unwrap();
    let use_deny_violations = adapter.parse_file(&use_deny_ts, "spa").unwrap();
    assert!(use_deny_violations
        .iter()
        .any(|v| v.rule_id == "ARCH-031" && v.severity == cerberus_domain::Severity::Deny));

    // Regular helper.ts with warn SLOC (330 lines > 300 + 15 grace)
    let helper_ts = temp.path().join("helper.ts");
    let mut helper_code = String::new();
    for _ in 0..330 {
        helper_code.push_str("const a = 1;\n");
    }
    std::fs::write(&helper_ts, &helper_code).unwrap();
    let helper_violations = adapter.parse_file(&helper_ts, "spa").unwrap();
    assert!(helper_violations
        .iter()
        .any(|v| v.rule_id == "ARCH-031" && v.severity == cerberus_domain::Severity::Warn));

    // Vue SFC with warn SLOC (180 lines > 150 + 15 grace)
    let vue_warn = temp.path().join("Medium.vue");
    let mut vue_warn_code = String::from("<template>\n<div>\n");
    for _ in 0..180 {
        vue_warn_code.push_str("<span>row</span>\n");
    }
    vue_warn_code.push_str("</div>\n</template>\n");
    std::fs::write(&vue_warn, &vue_warn_code).unwrap();
    let vue_warn_violations = adapter.parse_file(&vue_warn, "spa").unwrap();
    assert!(vue_warn_violations
        .iter()
        .any(|v| v.rule_id == "ARCH-031" && v.severity == cerberus_domain::Severity::Warn));
}

#[test]
fn test_custom_frontend_layers_matrix() {
    use cerberus_domain::{CerberusConfig, FrontendLayerConfig};
    use std::collections::HashMap;

    let mut frontend_layers = HashMap::new();
    frontend_layers.insert(
        "views".into(),
        FrontendLayerConfig {
            order: Some(5),
            aliases: vec!["screens".into()],
            allowed_deps: vec!["modules".into(), "shared".into()],
            is_orchestrator: true,
            allow_cross_slice: true,
        },
    );
    frontend_layers.insert(
        "modules".into(),
        FrontendLayerConfig {
            order: Some(3),
            aliases: vec![],
            allowed_deps: vec!["shared".into()],
            is_orchestrator: false,
            allow_cross_slice: false,
        },
    );
    frontend_layers.insert(
        "shared".into(),
        FrontendLayerConfig {
            order: Some(1),
            aliases: vec![],
            allowed_deps: vec![],
            is_orchestrator: false,
            allow_cross_slice: true,
        },
    );

    let config = CerberusConfig {
        frontend_layers,
        ..Default::default()
    };

    // 1. View importing modules should be allowed
    let view_file = Path::new("src/views/Dashboard.vue");
    let view_code = "import { UserModule } from '@/modules/user';";
    let v1 = FsdRulesChecker::check_source_with_config(view_code, view_file, Some(&config));
    assert_eq!(v1.len(), 0);

    // 2. Module importing view should violate hierarchy
    let module_file = Path::new("src/modules/user/useUser.ts");
    let module_code = "import { Dashboard } from '@/views/Dashboard.vue';";
    let v2 = FsdRulesChecker::check_source_with_config(module_code, module_file, Some(&config));
    assert_eq!(v2.len(), 1);
    assert_eq!(v2[0].rule_id, "FSD-001");

    // 3. External package should NOT trigger FSD violations
    let external_code = "import { ref } from '@tiptap/pm/view';";
    let v3 = FsdRulesChecker::check_source_with_config(external_code, module_file, Some(&config));
    assert_eq!(v3.len(), 0);
}

#[test]
fn test_frontend_layers_transitive_closure_and_cycle_prevention() {
    use cerberus_domain::{CerberusConfig, FrontendLayerConfig};
    use std::collections::HashMap;

    let mut frontend_layers = HashMap::new();
    frontend_layers.insert(
        "app".into(),
        FrontendLayerConfig {
            order: Some(4),
            aliases: vec![],
            allowed_deps: vec!["features".into(), "entities".into(), "shared".into()],
            is_orchestrator: true,
            allow_cross_slice: true,
        },
    );
    frontend_layers.insert(
        "features".into(),
        FrontendLayerConfig {
            order: Some(3),
            aliases: vec![],
            allowed_deps: vec!["entities".into(), "shared".into()],
            is_orchestrator: false,
            allow_cross_slice: false,
        },
    );
    frontend_layers.insert(
        "entities".into(),
        FrontendLayerConfig {
            order: Some(2),
            aliases: vec![],
            allowed_deps: vec!["shared".into()],
            is_orchestrator: false,
            allow_cross_slice: false,
        },
    );
    frontend_layers.insert(
        "shared".into(),
        FrontendLayerConfig {
            order: Some(1),
            aliases: vec![],
            allowed_deps: vec![],
            is_orchestrator: false,
            allow_cross_slice: true,
        },
    );

    let config = CerberusConfig {
        frontend_layers,
        ..Default::default()
    };

    // Transitive flow test: App -> Features -> Entities -> Shared
    // 1. Shared cannot import Entities (Cycle Attempt 1)
    let shared_file = Path::new("src/shared/ui/Button.vue");
    let code_shared_illegal = "import { userModel } from '@/entities/user';";
    let v_shared =
        FsdRulesChecker::check_source_with_config(code_shared_illegal, shared_file, Some(&config));
    assert_eq!(v_shared.len(), 1);
    assert_eq!(v_shared[0].rule_id, "FSD-001");

    // 2. Entities cannot import Features (Cycle Attempt 2)
    let ent_file = Path::new("src/entities/user/useUser.ts");
    let code_ent_illegal = "import { checkout } from '@/features/cart';";
    let v_ent =
        FsdRulesChecker::check_source_with_config(code_ent_illegal, ent_file, Some(&config));
    assert_eq!(v_ent.len(), 1);
    assert_eq!(v_ent[0].rule_id, "FSD-001");

    // 3. Features cannot import App (Cycle Attempt 3)
    let feat_file = Path::new("src/features/cart/useCart.ts");
    let code_feat_illegal = "import { router } from '@/app/router';";
    let v_feat =
        FsdRulesChecker::check_source_with_config(code_feat_illegal, feat_file, Some(&config));
    assert_eq!(v_feat.len(), 1);
    assert_eq!(v_feat[0].rule_id, "FSD-001");

    // 4. Features cannot import sibling Features (Cross-slice)
    let code_cross_feat = "import { auth } from '@/features/auth';";
    let v_cross =
        FsdRulesChecker::check_source_with_config(code_cross_feat, feat_file, Some(&config));
    assert_eq!(v_cross.len(), 1);
    assert_eq!(v_cross[0].rule_id, "FSD-004");
}

#[test]
fn test_shell_orchestrator_allowed_cross_slice_and_composition() {
    use cerberus_domain::{CerberusConfig, FrontendLayerConfig};
    use std::collections::HashMap;

    let mut frontend_layers = HashMap::new();
    frontend_layers.insert(
        "shell".into(),
        FrontendLayerConfig {
            order: Some(6),
            aliases: vec![],
            allowed_deps: vec![
                "features".into(),
                "chapters".into(),
                "entities".into(),
                "timeline".into(),
                "ai".into(),
                "shared".into(),
            ],
            is_orchestrator: true,
            allow_cross_slice: true,
        },
    );
    frontend_layers.insert(
        "features".into(),
        FrontendLayerConfig {
            order: Some(3),
            aliases: vec![],
            allowed_deps: vec!["entities".into(), "shared".into()],
            is_orchestrator: false,
            allow_cross_slice: false,
        },
    );

    let config = CerberusConfig {
        frontend_layers,
        ..Default::default()
    };

    // Shell can orchestrate multiple slices
    let shell_file = Path::new("apps/spa/src/ts/features/shell/EditorView.vue");
    let shell_code = r#"
        import { ChapterTree } from '@/features/chapters/ChapterTree';
        import { EntityEditor } from '@/features/entities/EntityEditor';
        import { WowilonPanel } from '@/features/ai/WowilonPanel';
        import { GlobalTimeViewer } from '@/features/timeline/Calendars';
    "#;
    let v_shell = FsdRulesChecker::check_source_with_config(shell_code, shell_file, Some(&config));
    assert_eq!(
        v_shell.len(),
        0,
        "Shell orchestrator must be allowed to import features without FSD-004 violations"
    );
}

#[test]
fn test_vue_sfc_parser_adapter_with_custom_config() {
    use cerberus_domain::{CerberusConfig, FrontendLayerConfig};
    use cerberus_infrastructure::VueSfcParserAdapter;
    use cerberus_ports::AstParserPort;
    use std::collections::HashMap;
    use tempfile::tempdir;

    let mut frontend_layers = HashMap::new();
    frontend_layers.insert(
        "shell".into(),
        FrontendLayerConfig {
            order: Some(6),
            aliases: vec![],
            allowed_deps: vec!["features".into(), "shared".into()],
            is_orchestrator: true,
            allow_cross_slice: true,
        },
    );

    let config = CerberusConfig {
        frontend_layers,
        ..Default::default()
    };

    let adapter = VueSfcParserAdapter::with_config(Some(config));
    let temp = tempdir().unwrap();
    let shell_vue = temp.path().join("shell").join("EditorView.vue");
    std::fs::create_dir_all(shell_vue.parent().unwrap()).unwrap();

    let content = r#"
<template>
  <div>Editor</div>
</template>
<script setup lang="ts">
import { AuthFeature } from '@/features/auth';
</script>
"#;
    std::fs::write(&shell_vue, content).unwrap();

    let violations = adapter.parse_file(&shell_vue, "spa").unwrap();
    let fsd_violations: Vec<_> = violations
        .iter()
        .filter(|v| v.rule_id.starts_with("FSD-"))
        .collect();
    assert_eq!(fsd_violations.len(), 0);
}

#[test]
fn test_ts_color_rule_checker_css005_positive_cases() {
    use cerberus_infrastructure::CssRuleChecker;

    let ts_code = r##"
        export function useThemeColors() {
            const primaryHex = '#8b5cf6';
            const shortHex = "#fff";
            const alphaHex = `#112233aa`;
            
            const rgbColor = 'rgb(255, 99, 71)';
            const rgbaColor = "rgba(100, 150, 255, 0.5)";
            const hslColor = 'hsl(210, 50%, 40%)';
            const hslaColor = `hsla(120, 100%, 50%, 0.3)`;

            const colorMapper = (type: string) => {
                const map: Record<string, string> = {
                    day: '#f59e0b',
                    night: 'rgba(30, 41, 59, 0.9)'
                };
                return map[type];
            };

            return { primaryHex, shortHex, alphaHex, rgbColor, rgbaColor, hslColor, hslaColor, colorMapper };
        }
    "##;

    let violations = CssRuleChecker::check_typescript_colors(
        ts_code,
        Path::new("src/features/useTheme.ts"),
        None,
    );
    // 3 hex + 4 rgb/hsl + 1 hex in map + 1 rgba in map = 9 violations
    assert_eq!(violations.len(), 9);

    for v in &violations {
        assert_eq!(v.rule_id, "CSS-005");
        assert!(v.symbol == "ts_color_hex" || v.symbol == "ts_color_rgb_hsl");
        assert!(v.message.contains("Raw color literal"));
        assert!(!v.fingerprint.is_empty());
    }

    // Verify hex and rgb symbols are differentiated
    let hex_violations: Vec<_> = violations
        .iter()
        .filter(|v| v.symbol == "ts_color_hex")
        .collect();
    let rgb_violations: Vec<_> = violations
        .iter()
        .filter(|v| v.symbol == "ts_color_rgb_hsl")
        .collect();
    assert_eq!(hex_violations.len(), 4);
    assert_eq!(rgb_violations.len(), 5);
}

#[test]
fn test_ts_color_rule_checker_css005_negative_and_false_positive_immunity() {
    use cerberus_domain::{CerberusConfig, DesignTokensConfig};
    use cerberus_infrastructure::CssRuleChecker;

    let ts_code = r##"
        // 1. Comments with colors should be ignored
        // const oldColor = '#ffffff';
        // const oldRgba = 'rgba(0, 0, 0, 0.5)';
        /* Multi-line comment #8b5cf6 and rgb(10, 20, 30) */
        * JSDoc style line with #000000

        // 2. RegExp literals matching colors should be ignored
        const hexRegex = /#([a-f0-9]{3}){1,2}\b/i;
        const rgbaRegex = /\brgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+/;

        // 3. SVG fragment identifiers should be ignored
        const maskUrl = "url(#icon-gradient)";
        const clipPath = 'url(#my-clip-mask)';

        // 4. CSS variables & semantic tokens should be allowed
        const bgVar = 'var(--bg-sunken)';
        const accentVar = "var(--accent)";
        const transparentKeyword = 'transparent';
        const inheritKeyword = 'currentColor';

        // 5. Normal strings with hash or letters
        const issueId = '#issue-1234';
        const channelName = '#general';
        const title = 'Chapter 1: The Dark Forest';
    "##;

    // Normal ts file - all 5 false-positive scenarios must yield 0 violations
    let violations = CssRuleChecker::check_typescript_colors(
        ts_code,
        Path::new("src/features/useSanitized.ts"),
        None,
    );
    assert_eq!(violations.len(), 0);

    // 6. Test file paths (*.spec.ts, *.test.ts, __tests__) must be exempt even with raw colors
    let code_with_raw_colors = "export const testColor = '#ff0000';";
    assert_eq!(
        CssRuleChecker::check_typescript_colors(
            code_with_raw_colors,
            Path::new("src/useSanitized.spec.ts"),
            None
        )
        .len(),
        0
    );
    assert_eq!(
        CssRuleChecker::check_typescript_colors(
            code_with_raw_colors,
            Path::new("src/useSanitized.test.ts"),
            None
        )
        .len(),
        0
    );
    assert_eq!(
        CssRuleChecker::check_typescript_colors(
            code_with_raw_colors,
            Path::new("src/__tests__/testHelper.ts"),
            None
        )
        .len(),
        0
    );
    assert_eq!(
        CssRuleChecker::check_typescript_colors(
            code_with_raw_colors,
            Path::new("src/components/button.stories.ts"),
            None
        )
        .len(),
        0
    );

    // 7. Configured token roots must be exempt
    let config = CerberusConfig {
        design_tokens: Some(DesignTokensConfig {
            tokens_roots: vec![
                "packages/resources/src/styles/tokens/**".into(),
                "packages/tokens/**".into(),
            ],
            ..Default::default()
        }),
        ..Default::default()
    };

    assert_eq!(
        CssRuleChecker::check_typescript_colors(
            code_with_raw_colors,
            Path::new("packages/tokens/src/palette.ts"),
            Some(&config)
        )
        .len(),
        0
    );
    assert_eq!(
        CssRuleChecker::check_typescript_colors(
            code_with_raw_colors,
            Path::new("packages/resources/src/styles/tokens/colors.ts"),
            Some(&config)
        )
        .len(),
        0
    );
}

#[test]
fn test_ts_color_rule_checker_css005_closure_and_edge_cases() {
    use cerberus_infrastructure::CssRuleChecker;

    // Closures, nested higher-order functions, and multi-line template strings
    let closure_ts = r##"
        export function createTimelineRenderer(defaultTheme: string) {
            return function(event: { type: string }) {
                const getNested = () => {
                    if (event.type === 'alert') {
                        return '#ef4444';
                    }
                    return 'var(--text-main)';
                };
                return getNested();
            };
        }
    "##;

    let violations = CssRuleChecker::check_typescript_colors(
        closure_ts,
        Path::new("src/timelineRenderer.ts"),
        None,
    );
    assert_eq!(violations.len(), 1);
    assert_eq!(violations[0].rule_id, "CSS-005");
    assert_eq!(violations[0].symbol, "ts_color_hex");
    assert_eq!(violations[0].line, 6);

    // Empty and whitespace-only files
    assert_eq!(
        CssRuleChecker::check_typescript_colors("", Path::new("src/empty.ts"), None).len(),
        0
    );
    assert_eq!(
        CssRuleChecker::check_typescript_colors(
            "   \n\n  \t\n",
            Path::new("src/whitespace.ts"),
            None
        )
        .len(),
        0
    );
}
