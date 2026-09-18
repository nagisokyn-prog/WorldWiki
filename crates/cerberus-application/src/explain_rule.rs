use cerberus_domain::{RuleCatalog, RuleDocEntry};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExplainFormat {
    Terminal,
    Markdown,
    Json,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ExplainError {
    RuleNotFound(String),
    SerializationError(String),
}

impl ExplainError {
    pub fn from_serde(e: serde_json::Error) -> Self {
        Self::SerializationError(e.to_string())
    }
}

impl std::fmt::Display for ExplainError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::RuleNotFound(id) => write!(f, "Rule '{}' not found in catalog", id),
            Self::SerializationError(msg) => write!(f, "Failed to serialize rule: {}", msg),
        }
    }
}

impl std::error::Error for ExplainError {}

pub struct ExplainRuleUseCase;

impl ExplainRuleUseCase {
    pub fn explain(rule_id: &str, format: ExplainFormat) -> Result<String, ExplainError> {
        let normalized = rule_id.trim();
        let entry = RuleCatalog::all()
            .into_iter()
            .find(|r| r.id.eq_ignore_ascii_case(normalized))
            .ok_or_else(|| ExplainError::RuleNotFound(normalized.to_string()))?;

        match format {
            ExplainFormat::Json => {
                serde_json::to_string_pretty(&entry).map_err(ExplainError::from_serde)
            }
            ExplainFormat::Markdown => Ok(Self::format_markdown(&entry)),
            ExplainFormat::Terminal => Ok(Self::format_terminal(&entry)),
        }
    }

    pub fn list(format: ExplainFormat) -> Result<String, ExplainError> {
        let entries = RuleCatalog::all();
        match format {
            ExplainFormat::Json => {
                serde_json::to_string_pretty(&entries).map_err(ExplainError::from_serde)
            }
            ExplainFormat::Markdown => {
                let mut out = String::from("# 📋 Cerberus Rule Catalog\n\n| ID | Name | Category | Severity |\n|---|---|---|---|\n");
                for r in &entries {
                    out.push_str(&format!("| `{}` | {} | {:?} | {:?} |\n", r.id, r.name, r.category, r.default_severity));
                }
                Ok(out)
            }
            ExplainFormat::Terminal => {
                let mut out = String::from("📋 REGISTERED CERBERUS RULES:\n");
                out.push_str("─────────────────────────────────────────────────────────────────────────────\n");
                for r in &entries {
                    out.push_str(&format!("{:<12} | {:<12} | {:<7} | {}\n", r.id, format!("{:?}", r.category), format!("{:?}", r.default_severity), r.name));
                }
                out.push_str("─────────────────────────────────────────────────────────────────────────────\n");
                out.push_str("Tip: Run `cargo cerberus rule explain <ID>` for detailed cards.\n");
                Ok(out)
            }
        }
    }

    fn format_terminal(entry: &RuleDocEntry) -> String {
        let border = "═".repeat(70);
        let divider = "─".repeat(70);

        format!(
            "╔{border}╗\n\
             ║ RULE: {:<10} | {:<52} ║\n\
             ║ Category: {:<12} | Default Severity: {:<27} ║\n\
             ╚{border}╝\n\n\
             📖 SUMMARY:\n   {}\n\n\
             🧠 RATIONALE:\n   {}\n\n\
             {divider}\n\
             ❌ BAD PRACTICE (Violation Trigger):\n\
             {}\n\n\
             {divider}\n\
             ✅ GOOD PRACTICE (Remediated Clean Architecture):\n\
             {}\n\n\
             {divider}\n\
             🛠️ REMEDIATION RECIPE:\n\
             {}\n\n\
             ⚙️ CONFIGURATION HINT (cerberus.json):\n\
             {}\n",
            entry.id,
            entry.name,
            format!("{:?}", entry.category),
            format!("{:?}", entry.default_severity),
            entry.summary,
            entry.rationale,
            entry.bad_example,
            entry.good_example,
            entry.remediation_recipe,
            entry.configuration_hint
        )
    }

    fn format_markdown(entry: &RuleDocEntry) -> String {
        format!(
            "# 🛡️ Rule `{}`: {}\n\n\
             - **Category**: `{:?}`\n\
             - **Default Severity**: `{:?}`\n\n\
             ## 📖 Summary\n\
             {}\n\n\
             ## 🧠 Rationale\n\
             {}\n\n\
             ## ❌ Bad Practice (Violation Trigger)\n\
             ```rust\n\
             {}\n\
             ```\n\n\
             ## ✅ Good Practice\n\
             ```rust\n\
             {}\n\
             ```\n\n\
             ## 🛠️ Remediation Recipe\n\
             {}\n\n\
             ## ⚙️ Configuration Hint (`cerberus.json`)\n\
             ```json\n\
             {}\n\
             ```\n",
            entry.id,
            entry.name,
            entry.category,
            entry.default_severity,
            entry.summary,
            entry.rationale,
            entry.bad_example,
            entry.good_example,
            entry.remediation_recipe,
            entry.configuration_hint
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_explain_terminal_success() {
        let res = ExplainRuleUseCase::explain("ARCH-001", ExplainFormat::Terminal);
        assert!(res.is_ok());
        let output = res.unwrap();
        assert!(output.contains("ARCH-001"));
        assert!(output.contains("SUMMARY:"));
        assert!(output.contains("BAD PRACTICE"));
    }

    #[test]
    fn test_explain_markdown_success() {
        let res = ExplainRuleUseCase::explain("VUE-007", ExplainFormat::Markdown);
        assert!(res.is_ok());
        let output = res.unwrap();
        assert!(output.contains("# 🛡️ Rule `VUE-007`"));
        assert!(output.contains("```rust"));
    }

    #[test]
    fn test_explain_json_success() {
        let res = ExplainRuleUseCase::explain("CSS-001", ExplainFormat::Json);
        assert!(res.is_ok());
        let output = res.unwrap();
        assert!(output.contains("\"id\": \"CSS-001\""));
    }

    #[test]
    fn test_explain_case_insensitive() {
        let res = ExplainRuleUseCase::explain("arch-001", ExplainFormat::Terminal);
        assert!(res.is_ok());
    }

    #[test]
    fn test_explain_not_found() {
        let res = ExplainRuleUseCase::explain("NONEXISTENT-999", ExplainFormat::Terminal);
        assert!(res.is_err());
        match res.unwrap_err() {
            ExplainError::RuleNotFound(id) => assert_eq!(id, "NONEXISTENT-999"),
            _ => panic!("Expected RuleNotFound"),
        }
    }

    #[test]
    fn test_list_rules_all_formats() {
        let term = ExplainRuleUseCase::list(ExplainFormat::Terminal).unwrap();
        assert!(term.contains("REGISTERED CERBERUS RULES"));

        let md = ExplainRuleUseCase::list(ExplainFormat::Markdown).unwrap();
        assert!(md.contains("# 📋 Cerberus Rule Catalog"));

        let json = ExplainRuleUseCase::list(ExplainFormat::Json).unwrap();
        assert!(json.starts_with('['));
    }

    #[test]
    fn test_error_display_and_traits() {
        use std::error::Error;

        let err1 = ExplainError::RuleNotFound("ABC".into());
        let err1_clone = err1.clone();
        assert_eq!(err1, err1_clone);
        assert_eq!(format!("{}", err1), "Rule 'ABC' not found in catalog");
        let _ = format!("{:?}", err1);
        assert!(err1.source().is_none());

        let serde_err: Result<String, serde_json::Error> = serde_json::from_str("{invalid json");
        let from_serde = ExplainError::from_serde(serde_err.unwrap_err());
        assert!(matches!(from_serde, ExplainError::SerializationError(_)));
    }

    #[test]
    fn test_format_enum_traits() {
        let fmt = ExplainFormat::Terminal;
        let fmt_copy = fmt;
        assert_eq!(fmt, fmt_copy);
        let _ = format!("{:?}", fmt);
        let _ = format!("{:?}", ExplainFormat::Markdown);
        let _ = format!("{:?}", ExplainFormat::Json);
    }
}
