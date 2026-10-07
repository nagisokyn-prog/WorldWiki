use crate::ast::document::SurqlDocument;
use crate::ast::node::*;
use crate::schema::registry::*;
use crate::schema::types::SurqlType;

pub struct SchemaCollector;

impl SchemaCollector {
    pub fn collect(docs: &[SurqlDocument]) -> SchemaRegistry {
        let mut registry = SchemaRegistry::new();

        for doc in docs {
            for stmt in &doc.statements {
                Self::visit_statement(stmt, &mut registry);
            }
            Self::scan_document_references(doc, &mut registry);
        }

        registry
    }

    fn scan_document_references(doc: &SurqlDocument, registry: &mut SchemaRegistry) {
        let fn_re = regex::Regex::new(r"fn::([a-zA-Z0-9_]+)").unwrap();
        let source = doc.source();
        for cap in fn_re.captures_iter(source) {
            if let Some(m) = cap.get(1) {
                let full_m = cap.get(0).unwrap();
                let prefix = source[..full_m.start()].trim_end();
                let upper_prefix = prefix.to_ascii_uppercase();
                if upper_prefix.ends_with("DEFINE FUNCTION")
                    || upper_prefix.trim_end_matches("OVERWRITE").trim_end().ends_with("DEFINE FUNCTION")
                {
                    continue;
                }
                registry.record_function_reference(m.as_str());
            }
        }
    }

    fn visit_statement(stmt: &Statement, registry: &mut SchemaRegistry) {
        match stmt {
            Statement::DefineTable(n) => {
                let (is_relation, in_table, out_table) = if let Some(rel) = &n.relation {
                    (true, Some(rel.in_table.clone()), Some(rel.out_table.clone()))
                } else {
                    (false, None, None)
                };

                registry.tables.insert(
                    n.name.clone(),
                    TableMeta {
                        name: n.name.clone(),
                        is_schemfull: n.is_schemfull,
                        is_schemaless: n.is_schemaless,
                        is_relation,
                        in_table,
                        out_table,
                    },
                );
            }
            Statement::DefineField(n) => {
                let parsed_type = SurqlType::parse(&n.raw_type);
                registry.fields.insert(
                    (n.table_name.clone(), n.field_name.clone()),
                    FieldMeta {
                        table_name: n.table_name.clone(),
                        field_name: n.field_name.clone(),
                        surql_type: parsed_type,
                        raw_type: n.raw_type.clone(),
                        is_nullable: n.is_nullable,
                        is_optional: n.is_optional,
                        default_expr: n.default_expr.clone(),
                    },
                );
            }
            Statement::DefineIndex(n) => {
                registry
                    .indexes
                    .entry(n.table_name.clone())
                    .or_default()
                    .push(IndexMeta {
                        name: n.index_name.clone(),
                        table_name: n.table_name.clone(),
                        fields: n.fields.clone(),
                        is_fulltext: n.is_fulltext,
                        analyzer: n.analyzer.clone(),
                        is_bm25: n.is_bm25,
                    });
            }
            Statement::DefineFunction(n) => {
                let parameters: Vec<(String, Option<SurqlType>)> = n
                    .parameters
                    .iter()
                    .map(|p| {
                        let parsed = p.raw_type.as_ref().map(|rt| SurqlType::parse(rt));
                        (p.name.clone(), parsed)
                    })
                    .collect();

                registry.functions.insert(
                    n.name.clone(),
                    FunctionMeta {
                        name: n.name.clone(),
                        parameters,
                        return_type: None,
                    },
                );
            }
            _ => {}
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ast::parser::SurqlParser;
    use std::path::PathBuf;

    #[test]
    fn test_schema_collector_collects_all_objects() {
        let sql = r#"
            DEFINE TABLE OVERWRITE users SCHEMAFULL;
            DEFINE FIELD OVERWRITE name ON users TYPE string;
            DEFINE INDEX OVERWRITE idx_users_name ON users FIELDS name;
            DEFINE TABLE OVERWRITE user_follows TYPE RELATION IN users OUT users;
            DEFINE FUNCTION OVERWRITE fn::get_user($id: record<users>, $untyped) {
                RETURN 1;
            };
            SELECT * FROM users;
        "#;
        let doc = SurqlParser::parse(sql, PathBuf::from("schema.surql"));
        let registry = SchemaCollector::collect(&[doc]);

        assert_eq!(registry.tables.len(), 2);
        assert!(registry.tables["users"].is_schemfull);
        assert!(registry.tables["user_follows"].is_relation);
        assert_eq!(registry.tables["user_follows"].in_table, Some("users".to_string()));

        assert_eq!(registry.fields.len(), 1);
        assert_eq!(registry.fields[&("users".to_string(), "name".to_string())].surql_type, SurqlType::String);

        assert_eq!(registry.indexes["users"].len(), 1);
        assert_eq!(registry.indexes["users"][0].name, "idx_users_name");

        assert_eq!(registry.functions.len(), 1);
        assert_eq!(registry.functions["fn::get_user"].parameters.len(), 2);
        assert_eq!(
            registry.functions["fn::get_user"].parameters[0].1,
            Some(SurqlType::Record("users".to_string()))
        );
        assert_eq!(registry.functions["fn::get_user"].parameters[1].1, None);
    }
}

