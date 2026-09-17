use cerberus_infrastructure::{FsdLayer, FsdRulesChecker, PerfRulesChecker};
use std::path::Path;

#[test]
fn test_fsd_layer_parsing() {
    assert_eq!(FsdLayer::parse("src/entities/user/model.ts"), FsdLayer::Entities);
    assert_eq!(FsdLayer::parse("src/features/auth/useAuth.ts"), FsdLayer::Features);
    assert_eq!(FsdLayer::parse("src/widgets/header/Header.vue"), FsdLayer::Widgets);
    assert_eq!(FsdLayer::parse("src/pages/home/Home.vue"), FsdLayer::Pages);
    assert_eq!(FsdLayer::parse("src/shared/ui/button.vue"), FsdLayer::Shared);
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
    assert_eq!(violations.iter().filter(|v| v.rule_id == "FSD-001").count(), 2);
    assert_eq!(violations.iter().filter(|v| v.rule_id == "FSD-002").count(), 1);
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
    let uikit_file = Path::new("@worldwiki/components/src/Button.vue");
    let code_pinia = "import { defineStore } from 'pinia';";
    let code_app = "import { router } from '@/app/router';";
    let code_feat = "import { auth } from '@/features/auth';";
    let code_ent = "import { user } from '@/entities/user';";
    assert_eq!(FsdRulesChecker::check_source(code_pinia, uikit_file).len(), 1);
    assert_eq!(FsdRulesChecker::check_source(code_app, uikit_file).len(), 1);
    assert_eq!(FsdRulesChecker::check_source(code_feat, uikit_file).len(), 1);
    assert_eq!(FsdRulesChecker::check_source(code_ent, uikit_file).len(), 1);

    // 3. Public API internals: model and ui
    let ent_file = Path::new("src/entities/user/useUser.ts");
    let code_internals = r#"
        import { slice } from '@/features/auth/model/slice';
        import { Widget } from '@/entities/session/ui/Widget';
    "#;
    let v_internals = FsdRulesChecker::check_source(code_internals, ent_file);
    assert_eq!(v_internals.iter().filter(|v| v.rule_id == "FSD-002").count(), 2);

    // 4. VueSfcParserAdapter .js, SLOC warn & deny for use*.ts and helpers
    let adapter = VueSfcParserAdapter;
    let temp = tempdir().unwrap();

    // JS file
    let js_path = temp.path().join("script.js");
    std::fs::write(&js_path, "export const x = 1;").unwrap();
    assert!(adapter.parse_file(&js_path, "spa").is_ok());

    // useComposable.ts with warn SLOC (260 lines)
    let use_ts = temp.path().join("useCustom.ts");
    let mut use_code = String::new();
    for _ in 0..260 {
        use_code.push_str("const a = 1;\n");
    }
    std::fs::write(&use_ts, &use_code).unwrap();
    let use_violations = adapter.parse_file(&use_ts, "spa").unwrap();
    assert!(use_violations.iter().any(|v| v.rule_id == "ARCH-031" && v.severity == cerberus_domain::Severity::Warn));

    // useComposable.ts with deny SLOC (460 lines)
    let use_deny_ts = temp.path().join("useHeavy.ts");
    let mut use_deny_code = String::new();
    for _ in 0..460 {
        use_deny_code.push_str("const a = 1;\n");
    }
    std::fs::write(&use_deny_ts, &use_deny_code).unwrap();
    let use_deny_violations = adapter.parse_file(&use_deny_ts, "spa").unwrap();
    assert!(use_deny_violations.iter().any(|v| v.rule_id == "ARCH-031" && v.severity == cerberus_domain::Severity::Deny));

    // Regular helper.ts with warn SLOC (310 lines)
    let helper_ts = temp.path().join("helper.ts");
    let mut helper_code = String::new();
    for _ in 0..310 {
        helper_code.push_str("const a = 1;\n");
    }
    std::fs::write(&helper_ts, &helper_code).unwrap();
    let helper_violations = adapter.parse_file(&helper_ts, "spa").unwrap();
    assert!(helper_violations.iter().any(|v| v.rule_id == "ARCH-031" && v.severity == cerberus_domain::Severity::Warn));

    // Vue SFC with warn SLOC (160 lines)
    let vue_warn = temp.path().join("Medium.vue");
    let mut vue_warn_code = String::from("<template>\n<div>\n");
    for _ in 0..160 {
        vue_warn_code.push_str("<span>row</span>\n");
    }
    vue_warn_code.push_str("</div>\n</template>\n");
    std::fs::write(&vue_warn, &vue_warn_code).unwrap();
    let vue_warn_violations = adapter.parse_file(&vue_warn, "spa").unwrap();
    assert!(vue_warn_violations.iter().any(|v| v.rule_id == "ARCH-031" && v.severity == cerberus_domain::Severity::Warn));
}
