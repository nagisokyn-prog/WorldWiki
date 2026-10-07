use crate::schema::types::SurqlType;
use std::collections::{HashMap, HashSet};

#[derive(Debug, Clone, Default)]
pub struct SchemaRegistry {
    pub tables: HashMap<String, TableMeta>,
    pub fields: HashMap<(String, String), FieldMeta>,
    pub indexes: HashMap<String, Vec<IndexMeta>>,
    pub functions: HashMap<String, FunctionMeta>,
    pub referenced_functions: HashSet<String>,
}

#[derive(Debug, Clone)]
pub struct TableMeta {
    pub name: String,
    pub is_schemfull: bool,
    pub is_schemaless: bool,
    pub is_relation: bool,
    pub in_table: Option<String>,
    pub out_table: Option<String>,
}

#[derive(Debug, Clone)]
pub struct FieldMeta {
    pub table_name: String,
    pub field_name: String,
    pub surql_type: SurqlType,
    pub raw_type: String,
    pub is_nullable: bool,
    pub is_optional: bool,
    pub default_expr: Option<String>,
}

#[derive(Debug, Clone)]
pub struct IndexMeta {
    pub name: String,
    pub table_name: String,
    pub fields: Vec<String>,
    pub is_fulltext: bool,
    pub analyzer: Option<String>,
    pub is_bm25: bool,
}

#[derive(Debug, Clone)]
pub struct FunctionMeta {
    pub name: String,
    pub parameters: Vec<(String, Option<SurqlType>)>,
    pub return_type: Option<SurqlType>,
}

impl SchemaRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn get_table(&self, name: &str) -> Option<&TableMeta> {
        self.tables.get(name)
    }

    pub fn get_field(&self, table: &str, field: &str) -> Option<&FieldMeta> {
        self.fields.get(&(table.to_string(), field.to_string()))
    }

    pub fn get_table_indexes(&self, table: &str) -> Option<&Vec<IndexMeta>> {
        self.indexes.get(table)
    }

    pub fn has_index_on_field(&self, table: &str, field: &str) -> bool {
        if let Some(indexes) = self.indexes.get(table) {
            indexes.iter().any(|idx| idx.fields.first().map(|f| f.as_str()) == Some(field))
        } else {
            false
        }
    }

    pub fn has_fts_index_on_field(&self, table: &str, field: &str) -> bool {
        if let Some(indexes) = self.indexes.get(table) {
            indexes.iter().any(|idx| idx.is_fulltext && idx.fields.iter().any(|f| f == field))
        } else {
            false
        }
    }

    pub fn record_function_reference(&mut self, name: &str) {
        let clean_name = name.strip_prefix("fn::").unwrap_or(name);
        self.referenced_functions.insert(clean_name.to_string());
        self.referenced_functions.insert(name.to_string());
        if !name.starts_with("fn::") {
            self.referenced_functions.insert(format!("fn::{name}"));
        }
    }

    pub fn is_function_referenced(&self, name: &str) -> bool {
        if self.referenced_functions.is_empty() {
            return true;
        }
        let clean_name = name.strip_prefix("fn::").unwrap_or(name);
        self.referenced_functions.contains(clean_name)
            || self.referenced_functions.contains(name)
            || self.referenced_functions.contains(&format!("fn::{clean_name}"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_schema_registry_lookups() {
        let mut reg = SchemaRegistry::new();
        reg.tables.insert(
            "users".to_string(),
            TableMeta {
                name: "users".to_string(),
                is_schemfull: true,
                is_schemaless: false,
                is_relation: false,
                in_table: None,
                out_table: None,
            },
        );

        reg.fields.insert(
            ("users".to_string(), "name".to_string()),
            FieldMeta {
                table_name: "users".to_string(),
                field_name: "name".to_string(),
                surql_type: SurqlType::String,
                raw_type: "string".to_string(),
                is_nullable: false,
                is_optional: false,
                default_expr: None,
            },
        );

        reg.indexes.insert(
            "users".to_string(),
            vec![
                IndexMeta {
                    name: "idx_name".to_string(),
                    table_name: "users".to_string(),
                    fields: vec!["name".to_string()],
                    is_fulltext: false,
                    analyzer: None,
                    is_bm25: false,
                },
                IndexMeta {
                    name: "idx_bio_ft".to_string(),
                    table_name: "users".to_string(),
                    fields: vec!["bio".to_string()],
                    is_fulltext: true,
                    analyzer: Some("ru_en".to_string()),
                    is_bm25: true,
                },
            ],
        );

        assert!(reg.get_table("users").is_some());
        assert!(reg.get_table("non_existent").is_none());
        assert!(reg.get_field("users", "name").is_some());
        assert!(reg.get_field("users", "unknown").is_none());
        assert!(reg.get_table_indexes("users").is_some());
        assert!(reg.get_table_indexes("orders").is_none());

        assert!(reg.has_index_on_field("users", "name"));
        assert!(!reg.has_index_on_field("users", "unknown"));
        assert!(!reg.has_index_on_field("orders", "name"));

        assert!(reg.has_fts_index_on_field("users", "bio"));
        assert!(!reg.has_fts_index_on_field("users", "name"));
        assert!(!reg.has_fts_index_on_field("orders", "bio"));
    }
}

