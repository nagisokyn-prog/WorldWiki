use crate::domain::rules::Violation;
use crate::frontend::css_rules::CssRuleChecker;
use crate::frontend::lifecycle_rules::LifecycleRuleChecker;
use crate::frontend::sfc_parser::VueSfcParser;
use crate::frontend::vue_rules::VueRuleChecker;
use crate::ports::parser::AstParserPort;
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
