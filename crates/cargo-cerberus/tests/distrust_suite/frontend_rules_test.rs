use cerberus_infrastructure::frontend::{
    CssRuleChecker, FrontendAnalyzer, PerfRulesChecker, VueRuleChecker,
    VueSfcParser,
};
use std::fs;
use std::path::Path;
use tempfile::tempdir;

#[test]
fn test_frontend_vue_007_destructuring_loss() {
    let sfc = VueSfcParser::parse("
        <script setup lang=\"ts\">
        const { title, isDraft } = props;
        const { user } = userStore;
        </script>
    ");
    let violations = VueRuleChecker::check(&sfc, Path::new("ChapterView.vue"));
    let v7 = violations.iter().filter(|v| v.rule_id == "VUE-007").count();
    assert_eq!(v7, 2, "Both props and store direct destructuring should trigger VUE-007");

    // Clean with toRefs and storeToRefs
    let clean_sfc = VueSfcParser::parse("
        <script setup lang=\"ts\">
        const { title } = toRefs(props);
        const { user } = storeToRefs(userStore);
        </script>
    ");
    let clean_violations = VueRuleChecker::check(&clean_sfc, Path::new("ChapterView.vue"));
    assert!(clean_violations.iter().all(|v| v.rule_id != "VUE-007"));
}

#[test]
fn test_frontend_vue_008_prop_mutation() {
    let sfc = VueSfcParser::parse("
        <script setup lang=\"ts\">
        function update() {
            props.chapter.title = 'Mutated';
            props.tags.push('new');
        }
        </script>
    ");
    let violations = VueRuleChecker::check(&sfc, Path::new("ChapterView.vue"));
    let v8 = violations.iter().filter(|v| v.rule_id == "VUE-008").count();
    assert!(v8 >= 2, "Mutating props.chapter.title and props.tags.push should trigger VUE-008");
}

#[test]
fn test_frontend_ts_borrow_001_store_aliasing() {
    let sfc = VueSfcParser::parse("
        <script setup lang=\"ts\">
        function save() {
            userStore.state.currentUser = null;
        }
        </script>
    ");
    let violations = VueRuleChecker::check(&sfc, Path::new("UserProfile.vue"));
    assert!(violations.iter().any(|v| v.rule_id == "TS-BORROW-001"));
}

#[test]
fn test_frontend_ts_match_001_exhaustive_pattern() {
    let unhandled_sfc = VueSfcParser::parse("
        <script setup lang=\"ts\">
        function render(node: AstNode) {
            switch (node.type) {
                case 'p': return 1;
                case 'h': return 2;
                case 'code': return 3;
            }
        }
        </script>
    ");
    let violations = VueRuleChecker::check(&unhandled_sfc, Path::new("AstRenderer.vue"));
    assert!(violations.iter().any(|v| v.rule_id == "TS-MATCH-001"));

    let exhaustive_sfc = VueSfcParser::parse("
        <script setup lang=\"ts\">
        function render(node: AstNode) {
            switch (node.type) {
                case 'p': return 1;
                case 'h': return 2;
                case 'code': return 3;
                default: return assertNever(node);
            }
        }
        </script>
    ");
    let clean_violations = VueRuleChecker::check(&exhaustive_sfc, Path::new("AstRenderer.vue"));
    assert!(clean_violations.iter().all(|v| v.rule_id != "TS-MATCH-001"));
}

#[test]
fn test_frontend_tauri_002_direct_ipc_in_component() {
    let sfc = VueSfcParser::parse("
        <script setup lang=\"ts\">
        import { invoke } from '@tauri-apps/api/core';
        async function run() {
            await invoke('save_chapter');
        }
        </script>
    ");
    let violations = VueRuleChecker::check(&sfc, Path::new("SaveButton.vue"));
    assert!(violations.iter().any(|v| v.rule_id == "TAURI-002"));
}

#[test]
fn test_frontend_vue_009_template_methods_in_v_for() {
    let sfc_content = "
        <template>
            <div v-for=\"item in items\" :key=\"item.id\">
                <span>{{ computeHeavy(item) }}</span>
            </div>
        </template>
    ";
    let violations = PerfRulesChecker::check_source(sfc_content, Path::new("ItemList.vue"));
    assert!(violations.iter().any(|v| v.rule_id == "VUE-009"));
}

#[test]
fn test_frontend_perf_dom_001_layout_thrashing() {
    let code = "
        elements.forEach(el => {
            const h = el.offsetHeight;
            el.style.height = `${h + 10}px`;
        });
    ";
    let violations = PerfRulesChecker::check_source(code, Path::new("resizeHelper.ts"));
    assert!(violations.iter().any(|v| v.rule_id == "PERF-DOM-001"));
}

#[test]
fn test_frontend_css_006_important_abuse() {
    let sfc = VueSfcParser::parse("
        <template><div>OK</div></template>
        <style scoped>
        .btn {
            background: var(--color-bg-primary) !important;
        }
        </style>
    ");
    let violations = CssRuleChecker::check_sfc_styles(&sfc, Path::new("Button.vue"));
    assert!(violations.iter().any(|v| v.rule_id == "CSS-006"));
}

#[test]
fn test_frontend_analyzer_full_pipeline() {
    let temp = tempdir().unwrap();
    let file = temp.path().join("ComplexComponent.vue");

    let content = r#"
        <template>
            <div v-for="item in items" :key="item.id">
                <span>{{ format(item) }}</span>
            </div>
        </template>
        <script setup lang="ts">
        import { invoke } from '@tauri-apps/api/core';
        const { title } = props;
        </script>
        <style scoped>
        .title {
            color: #ff0000;
            margin: 10px !important;
        }
        </style>
    "#;
    fs::write(&file, content).unwrap();

    let violations = FrontendAnalyzer::analyze_file(&file).unwrap();
    let rule_ids: Vec<&str> = violations.iter().map(|v| v.rule_id.as_str()).collect();

    assert!(rule_ids.contains(&"TAURI-002"), "Should catch TAURI-002");
    assert!(rule_ids.contains(&"VUE-007"), "Should catch VUE-007");
    assert!(rule_ids.contains(&"CSS-004"), "Should catch CSS-004 hex color");
    assert!(rule_ids.contains(&"CSS-006"), "Should catch CSS-006 !important");
    assert!(rule_ids.contains(&"VUE-009"), "Should catch VUE-009");
}
