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
        }

        registry
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
