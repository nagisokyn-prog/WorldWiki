use cerberus_domain::Violation;
use crate::frontend::css_rules::CssRuleChecker;
use crate::frontend::lifecycle_rules::LifecycleRuleChecker;
use crate::frontend::sfc_parser::VueSfcParser;
use crate::frontend::vue_rules::VueRuleChecker;
use cerberus_ports::AstParserPort;

use std::fs;
use std::path::Path;

pub struct VueSfcParserAdapter;

impl AstParserPort for VueSfcParserAdapter {
    fn can_parse(&self, path: &Path) -> bool {
        let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("");
        matches!(ext, "vue" | "css" | "ts" | "js")
    }

    fn parse_file(&self, path: &Path, _crate_name: &str) -> Result<Vec<Violation>, String> {
        let content = fs::read_to_string(path)
            .map_err(|e| format!("Could not read file {}: {}", path.display(), e))?;

        let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("");
        let mut violations = Vec::new();

        match ext {
            "vue" => {
                let sfc = VueSfcParser::parse(&content);
                violations.extend(VueRuleChecker::check(&sfc, path));
                violations.extend(CssRuleChecker::check_sfc_styles(&sfc, path));
            }
            "css" => {
                violations.extend(CssRuleChecker::validate_css_file(&content, path));
            }
            "ts" | "js" => {
                violations.extend(LifecycleRuleChecker::check_typescript_file(&content, path));
            }
            _ => {}
        }

        Ok(violations)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_vue_sfc_parser_adapter_can_parse_and_parse_files() {
        let adapter = VueSfcParserAdapter;
        assert!(adapter.can_parse(Path::new("Component.vue")));
        assert!(adapter.can_parse(Path::new("styles.css")));
        assert!(adapter.can_parse(Path::new("useHook.ts")));
        assert!(adapter.can_parse(Path::new("legacy.js")));
        assert!(!adapter.can_parse(Path::new("main.rs")));

        let temp = tempdir().unwrap();

        // 1. Vue SFC test
        let vue_path = temp.path().join("App.vue");
        fs::write(&vue_path, "<template><div>Hello</div></template><script setup>const x = 1;</script>").unwrap();
        let vue_res = adapter.parse_file(&vue_path, "spa").unwrap();
        assert_eq!(vue_res.len(), 0);

        // 2. CSS test
        let css_path = temp.path().join("app.css");
        fs::write(&css_path, "body { color: var(--color-text-primary); }").unwrap();
        let css_res = adapter.parse_file(&css_path, "spa").unwrap();
        assert_eq!(css_res.len(), 0);

        // 3. TS test
        let ts_path = temp.path().join("hook.ts");
        fs::write(&ts_path, "export function useOk() {}").unwrap();
        let ts_res = adapter.parse_file(&ts_path, "spa").unwrap();
        assert_eq!(ts_res.len(), 0);

        // 4. Missing file
        let missing = temp.path().join("missing.vue");
        assert!(adapter.parse_file(&missing, "spa").is_err());
    }
}

