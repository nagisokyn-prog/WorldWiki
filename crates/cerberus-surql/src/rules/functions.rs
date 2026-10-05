use crate::ast::document::SurqlDocument;
use crate::ast::node::*;
use crate::config::SurqlConfig;
use crate::rules::{create_violation, SurqlRule};
use crate::schema::registry::SchemaRegistry;
use crate::schema::types::SurqlType;
use cerberus_domain::{Category, RuleDefinition, Severity, Violation};
use regex::Regex;

// SURQL-020: Untyped Parameter in Stored Function
pub struct Surql020UntypedFunctionParam;
impl SurqlRule for Surql020UntypedFunctionParam {
    fn id(&self) -> &'static str {
        "SURQL-020"
    }

    fn definition(&self) -> RuleDefinition {
        RuleDefinition {
            id: self.id().into(),
            version: "1.0".into(),
            category: Category::Robustness,
            severity: Severity::Deny,
            title: "Untyped Parameter in Stored Function".into(),
            description: "Stored function parameter without type annotation defaults to any, bypassing server-side argument validation.".into(),
            remediation: "Add explicit type annotation to function parameter: $param: string, $id: record<user>.".into(),
        }
    }

    fn check(&self, doc: &SurqlDocument, _schema: &SchemaRegistry, _config: &SurqlConfig) -> Vec<Violation> {
        let mut violations = Vec::new();
        for stmt in &doc.statements {
            if let Statement::DefineFunction(func) = stmt {
                for param in &func.parameters {
                    if param.raw_type.is_none() {
                        violations.push(create_violation(
                            self,
                            doc,
                            func.span.start_line,
                            func.span.start_col,
                            &format!("{}({})", func.name, param.name),
                            &format!("DEFINE FUNCTION {}(...)", func.name),
                            Some(&format!("Parameter '{}' of function '{}' lacks an explicit type annotation.", param.name, func.name)),
                        ));
                    }
                }
            }
        }
        violations
    }
}

// SURQL-026: Datetime Coerced to String in DateTime Field
pub struct Surql026DatetimeCoercedToString;
impl SurqlRule for Surql026DatetimeCoercedToString {
    fn id(&self) -> &'static str {
        "SURQL-026"
    }

    fn definition(&self) -> RuleDefinition {
        RuleDefinition {
            id: self.id().into(),
            version: "1.0".into(),
            category: Category::DataIntegrity,
            severity: Severity::Deny,
            title: "Datetime Coerced to String in DateTime Field".into(),
            description: "Saving type::string(time::now()) into schema field typed as datetime breaks chronological ordering and comparison.".into(),
            remediation: "Pass native datetime value (time::now()) directly to datetime fields without type::string coercion.".into(),
        }
    }

    fn check(&self, doc: &SurqlDocument, schema: &SchemaRegistry, _config: &SurqlConfig) -> Vec<Violation> {
        let mut violations = Vec::new();
        let coerce_re = Regex::new(r"([a-zA-Z0-9_]+)\s*=\s*type::string\s*\(\s*time::now\s*\(\s*\)\s*\)").unwrap();

        for stmt in &doc.statements {
            let span = stmt.span();
            let snippet = &doc.source()[span.byte_range.clone()];

            for cap in coerce_re.captures_iter(snippet) {
                if let Some(field_match) = cap.get(1) {
                    let field_name = field_match.as_str();

                    // Check if target field in schema is datetime
                    let mut is_target_datetime = false;
                    for ((_tbl, f_name), f_meta) in &schema.fields {
                        if f_name == field_name {
                            match &f_meta.surql_type {
                                SurqlType::Datetime => is_target_datetime = true,
                                SurqlType::Option(inner) if matches!(**inner, SurqlType::Datetime) => {
                                    is_target_datetime = true;
                                }
                                _ => {}
                            }
                        }
                    }

                    if is_target_datetime {
                        violations.push(create_violation(
                            self,
                            doc,
                            span.start_line,
                            span.start_col,
                            field_name,
                            cap.get(0).map(|m| m.as_str()).unwrap_or(""),
                            Some(&format!("Field '{}' is typed as datetime in schema, but assigned type::string(time::now()). Pass native datetime value directly.", field_name)),
                        ));
                    }
                }
            }
        }
        violations
    }
}
