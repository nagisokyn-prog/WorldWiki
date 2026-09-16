pub mod css_rules;
pub mod lifecycle_rules;
pub mod sfc_parser;
pub mod vue_rules;

use cerberus_domain::Violation;

use crate::frontend::css_rules::CssRuleChecker;
use crate::frontend::lifecycle_rules::LifecycleRuleChecker;
use crate::frontend::sfc_parser::VueSfcParser;
use crate::frontend::vue_rules::VueRuleChecker;
use std::fs;
use std::path::Path;

pub struct FrontendAnalyzer;

impl FrontendAnalyzer {
    pub fn analyze_file(path: &Path) -> Result<Vec<Violation>, String> {
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
    fn test_frontend_analyzer_delegates_by_extension() {
        let temp = tempdir().unwrap();
        let vue_file = temp.path().join("Test.vue");
        fs::write(&vue_file, "<template><div>OK</div></template>").unwrap();

        let violations = FrontendAnalyzer::analyze_file(&vue_file).unwrap();
        assert_eq!(violations.len(), 0);

        let css_file = temp.path().join("Test.css");
        fs::write(&css_file, "body { color: var(--color-text-primary); }").unwrap();
        assert!(FrontendAnalyzer::analyze_file(&css_file).unwrap().is_empty());

        let ts_file = temp.path().join("Test.ts");
        fs::write(&ts_file, "export const x = 1;").unwrap();
        assert!(FrontendAnalyzer::analyze_file(&ts_file).unwrap().is_empty());

        let txt_file = temp.path().join("Test.txt");
        fs::write(&txt_file, "ignored text").unwrap();
        assert!(FrontendAnalyzer::analyze_file(&txt_file).unwrap().is_empty());

        let missing = temp.path().join("none.vue");
        assert!(FrontendAnalyzer::analyze_file(&missing).is_err());
    }
}


