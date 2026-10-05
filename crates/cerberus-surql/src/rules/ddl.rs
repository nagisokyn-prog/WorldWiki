use crate::ast::document::SurqlDocument;
use crate::ast::node::*;
use crate::config::SurqlConfig;
use crate::rules::{create_violation, SurqlRule};
use crate::schema::registry::SchemaRegistry;
use crate::schema::types::SurqlType;
use cerberus_domain::{Category, RuleDefinition, Severity, Violation};

// SURQL-007: Schemaless Table Definition
pub struct Surql007SchemalessTable;
impl SurqlRule for Surql007SchemalessTable {
    fn id(&self) -> &'static str {
        "SURQL-007"
    }

    fn definition(&self) -> RuleDefinition {
        RuleDefinition {
            id: self.id().into(),
            version: "1.0".into(),
            category: Category::DataIntegrity,
            severity: Severity::Deny,
            title: "Schemaless Table Definition under Strict Schema".into(),
            description: "DEFINE TABLE without SCHEMAFULL disables server-side type enforcement under strict schema rules.".into(),
            remediation: "Add SCHEMAFULL to DEFINE TABLE statement, or configure strict_schema = false in .cerberus.toml for dynamic log buffers.".into(),
        }
    }

    fn check(&self, doc: &SurqlDocument, _schema: &SchemaRegistry, config: &SurqlConfig) -> Vec<Violation> {
        if !config.strict_schema {
            return Vec::new();
        }

        let mut violations = Vec::new();
        for stmt in &doc.statements {
            if let Statement::DefineTable(table) = stmt {
                if !table.is_schemfull {
                    violations.push(create_violation(
                        self,
                        doc,
                        table.span.start_line,
                        table.span.start_col,
                        &table.name,
                        &format!("DEFINE TABLE {}", table.name),
                        Some(&format!("Table '{}' is defined without SCHEMAFULL.", table.name)),
                    ));
                }
            }
        }
        violations
    }
}

// SURQL-008: Non-Idempotent DDL Statement
pub struct Surql008NonIdempotentDdl;
impl SurqlRule for Surql008NonIdempotentDdl {
    fn id(&self) -> &'static str {
        "SURQL-008"
    }

    fn definition(&self) -> RuleDefinition {
        RuleDefinition {
            id: self.id().into(),
            version: "1.0".into(),
            category: Category::Convention,
            severity: Severity::Deny,
            title: "Non-Idempotent DDL Statement".into(),
            description: "DEFINE TABLE, FIELD, INDEX, EVENT or FUNCTION without OVERWRITE breaks repeated schema migration applications.".into(),
            remediation: "Add OVERWRITE keyword to all DEFINE statements.".into(),
        }
    }

    fn check(&self, doc: &SurqlDocument, _schema: &SchemaRegistry, config: &SurqlConfig) -> Vec<Violation> {
        if !config.require_ddl_overwrite {
            return Vec::new();
        }

        let mut violations = Vec::new();
        for stmt in &doc.statements {
            match stmt {
                Statement::DefineTable(t) if !t.is_overwrite => {
                    violations.push(create_violation(
                        self,
                        doc,
                        t.span.start_line,
                        t.span.start_col,
                        &t.name,
                        &format!("DEFINE TABLE {}", t.name),
                        Some(&format!("DEFINE TABLE '{}' lacks OVERWRITE keyword.", t.name)),
                    ));
                }
                Statement::DefineField(f) if !f.is_overwrite => {
                    violations.push(create_violation(
                        self,
                        doc,
                        f.span.start_line,
                        f.span.start_col,
                        &f.field_name,
                        &format!("DEFINE FIELD {} ON {}", f.field_name, f.table_name),
                        Some(&format!("DEFINE FIELD '{}' ON '{}' lacks OVERWRITE keyword.", f.field_name, f.table_name)),
                    ));
                }
                Statement::DefineIndex(i) if !i.is_overwrite => {
                    violations.push(create_violation(
                        self,
                        doc,
                        i.span.start_line,
                        i.span.start_col,
                        &i.index_name,
                        &format!("DEFINE INDEX {} ON {}", i.index_name, i.table_name),
                        Some(&format!("DEFINE INDEX '{}' ON '{}' lacks OVERWRITE keyword.", i.index_name, i.table_name)),
                    ));
                }
                Statement::DefineFunction(func) if !func.is_overwrite => {
                    violations.push(create_violation(
                        self,
                        doc,
                        func.span.start_line,
                        func.span.start_col,
                        &func.name,
                        &format!("DEFINE FUNCTION {}", func.name),
                        Some(&format!("DEFINE FUNCTION '{}' lacks OVERWRITE keyword.", func.name)),
                    ));
                }
                _ => {}
            }
        }
        violations
    }
}

// SURQL-009: Nullable Relation Endpoints
pub struct Surql009NullableRelationEndpoints;
impl SurqlRule for Surql009NullableRelationEndpoints {
    fn id(&self) -> &'static str {
        "SURQL-009"
    }

    fn definition(&self) -> RuleDefinition {
        RuleDefinition {
            id: self.id().into(),
            version: "1.0".into(),
            category: Category::Architecture,
            severity: Severity::Deny,
            title: "Nullable Relation Endpoints in Graph Edge".into(),
            description: "System fields 'in' and 'out' on TYPE RELATION tables cannot be nullable or optional. Graph edges require valid source and destination records.".into(),
            remediation: "Define 'in' and 'out' fields with exact record types: TYPE record<from_table> and TYPE record<to_table> without | null.".into(),
        }
    }

    fn check(&self, doc: &SurqlDocument, schema: &SchemaRegistry, _config: &SurqlConfig) -> Vec<Violation> {
        let mut violations = Vec::new();
        for stmt in &doc.statements {
            if let Statement::DefineField(field) = stmt {
                if (field.field_name == "in" || field.field_name == "out")
                    && (field.is_nullable || field.is_optional)
                {
                    if let Some(table) = schema.get_table(&field.table_name) {
                        if table.is_relation {
                            violations.push(create_violation(
                                self,
                                doc,
                                field.span.start_line,
                                field.span.start_col,
                                &format!("{}.{}", field.table_name, field.field_name),
                                &format!("DEFINE FIELD {} ON {} TYPE {}", field.field_name, field.table_name, field.raw_type),
                                Some(&format!("Relation endpoint field '{}.{}' cannot be nullable or optional.", field.table_name, field.field_name)),
                            ));
                        }
                    }
                }
            }
        }
        violations
    }
}

// SURQL-010: Three-Valued Boolean Logic Hazard
pub struct Surql010ThreeValuedBoolean;
impl SurqlRule for Surql010ThreeValuedBoolean {
    fn id(&self) -> &'static str {
        "SURQL-010"
    }

    fn definition(&self) -> RuleDefinition {
        RuleDefinition {
            id: self.id().into(),
            version: "1.0".into(),
            category: Category::Robustness,
            severity: Severity::Deny,
            title: "Three-Valued Boolean Logic Hazard".into(),
            description: "TYPE bool | null introduces SQL three-valued logic (TRUE, FALSE, UNKNOWN/NULL) and causes silent misses in WHERE flag != true.".into(),
            remediation: "Use TYPE bool DEFAULT false or TYPE option<bool> for uninitialized flags without explicit NULL.".into(),
        }
    }

    fn check(&self, doc: &SurqlDocument, _schema: &SchemaRegistry, config: &SurqlConfig) -> Vec<Violation> {
        if !config.types.disallow_three_valued_booleans {
            return Vec::new();
        }

        let mut violations = Vec::new();
        for stmt in &doc.statements {
            if let Statement::DefineField(field) = stmt {
                let surql_type = SurqlType::parse(&field.raw_type);
                if surql_type.is_bool_nullable_hazard() {
                    violations.push(create_violation(
                        self,
                        doc,
                        field.span.start_line,
                        field.span.start_col,
                        &format!("{}.{}", field.table_name, field.field_name),
                        &format!("DEFINE FIELD {} ON {} TYPE {}", field.field_name, field.table_name, field.raw_type),
                        Some(&format!("Field '{}.{}' uses nullable boolean (bool | null), creating 3-valued logic hazards.", field.table_name, field.field_name)),
                    ));
                }
            }
        }
        violations
    }
}

// SURQL-011: Nullable Collection Anti-Pattern
pub struct Surql011NullableCollection;
impl SurqlRule for Surql011NullableCollection {
    fn id(&self) -> &'static str {
        "SURQL-011"
    }

    fn definition(&self) -> RuleDefinition {
        RuleDefinition {
            id: self.id().into(),
            version: "1.0".into(),
            category: Category::Convention,
            severity: Severity::Deny,
            title: "Nullable Collection Anti-Pattern".into(),
            description: "Collections (array, object) typed as | null break client iteration. Collections must default to empty containers instead of null.".into(),
            remediation: "Use TYPE array<T> DEFAULT [] or TYPE object DEFAULT {}.".into(),
        }
    }

    fn check(&self, doc: &SurqlDocument, _schema: &SchemaRegistry, config: &SurqlConfig) -> Vec<Violation> {
        if !config.types.disallow_nullable_collections {
            return Vec::new();
        }

        let mut violations = Vec::new();
        for stmt in &doc.statements {
            if let Statement::DefineField(field) = stmt {
                let surql_type = SurqlType::parse(&field.raw_type);
                if surql_type.is_collection() && field.is_nullable {
                    violations.push(create_violation(
                        self,
                        doc,
                        field.span.start_line,
                        field.span.start_col,
                        &format!("{}.{}", field.table_name, field.field_name),
                        &format!("DEFINE FIELD {} ON {} TYPE {}", field.field_name, field.table_name, field.raw_type),
                        Some(&format!("Collection field '{}.{}' is nullable (array|object | null). Default to empty container instead.", field.table_name, field.field_name)),
                    ));
                }
            }
        }
        violations
    }
}

// SURQL-012: Naked option<T> JSON Compatibility Hazard
pub struct Surql012NakedOptionJsonHazard;
impl SurqlRule for Surql012NakedOptionJsonHazard {
    fn id(&self) -> &'static str {
        "SURQL-012"
    }

    fn definition(&self) -> RuleDefinition {
        RuleDefinition {
            id: self.id().into(),
            version: "1.0".into(),
            category: Category::Robustness,
            severity: Severity::Warn,
            title: "Naked option<T> JSON Compatibility Hazard".into(),
            description: "TYPE option<T> accepts missing fields (NONE), but rejects explicit JSON null. Clients sending { \"field\": null } will encounter type errors.".into(),
            remediation: "Use TYPE option<T | null> if clients may send null, or ensure API clients omit null keys.".into(),
        }
    }

    fn check(&self, doc: &SurqlDocument, _schema: &SchemaRegistry, config: &SurqlConfig) -> Vec<Violation> {
        if !config.types.warn_on_naked_option {
            return Vec::new();
        }

        let mut violations = Vec::new();
        for stmt in &doc.statements {
            if let Statement::DefineField(field) = stmt {
                let surql_type = SurqlType::parse(&field.raw_type);
                if let SurqlType::Option(inner) = &surql_type {
                    if !inner.is_nullable() && !matches!(**inner, SurqlType::Bool) {
                        violations.push(create_violation(
                            self,
                            doc,
                            field.span.start_line,
                            field.span.start_col,
                            &format!("{}.{}", field.table_name, field.field_name),
                            &format!("DEFINE FIELD {} ON {} TYPE {}", field.field_name, field.table_name, field.raw_type),
                            Some(&format!("Field '{}.{}' uses 'option<T>' without '| null'. This rejects explicit JSON null values.", field.table_name, field.field_name)),
                        ));
                    }
                }
            }
        }
        violations
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ast::parser::SurqlParser;
    use std::path::PathBuf;

    #[test]
    fn test_ddl_rules_unit() {
        let surql = r#"
            DEFINE TABLE logs;
            DEFINE FIELD name ON logs TYPE string;
            DEFINE TABLE OVERWRITE edge SCHEMAFULL TYPE RELATION IN users OUT users;
            DEFINE FIELD OVERWRITE in ON edge TYPE record<users> | null;
            DEFINE FIELD OVERWRITE flag ON logs TYPE bool | null;
            DEFINE FIELD OVERWRITE tags ON logs TYPE array<string> | null;
            DEFINE FIELD OVERWRITE title ON logs TYPE option<string>;
        "#;
        let doc = SurqlParser::parse(surql, PathBuf::from("test.surql"));
        let mut schema = SchemaRegistry::new();
        schema.tables.insert(
            "edge".to_string(),
            crate::schema::registry::TableMeta {
                name: "edge".to_string(),
                is_schemfull: true,
                is_schemaless: false,
                is_relation: true,
                in_table: Some("users".to_string()),
                out_table: Some("users".to_string()),
            },
        );
        let config = SurqlConfig::default();

        let v07 = Surql007SchemalessTable.check(&doc, &schema, &config);
        assert_eq!(v07.len(), 1);
        assert_eq!(v07[0].rule_id, "SURQL-007");

        let v08 = Surql008NonIdempotentDdl.check(&doc, &schema, &config);
        assert_eq!(v08.len(), 2);
        assert_eq!(v08[0].rule_id, "SURQL-008");

        let v09 = Surql009NullableRelationEndpoints.check(&doc, &schema, &config);
        assert_eq!(v09.len(), 1);
        assert_eq!(v09[0].rule_id, "SURQL-009");

        let v10 = Surql010ThreeValuedBoolean.check(&doc, &schema, &config);
        assert_eq!(v10.len(), 1);
        assert_eq!(v10[0].rule_id, "SURQL-010");

        let v11 = Surql011NullableCollection.check(&doc, &schema, &config);
        assert_eq!(v11.len(), 1);
        assert_eq!(v11[0].rule_id, "SURQL-011");

        let v12 = Surql012NakedOptionJsonHazard.check(&doc, &schema, &config);
        assert_eq!(v12.len(), 1);
        assert_eq!(v12[0].rule_id, "SURQL-012");
    }
}
