use cerberus_domain::Violation;
use cerberus_ports::AstParserPort;
use cerberus_surql::ast::parser::SurqlParser;
use cerberus_surql::config::SurqlConfig;
use cerberus_surql::engine::SurqlEngine;
use cerberus_surql::schema::collector::SchemaCollector;
use std::fs;
use std::path::Path;

#[derive(Default, Clone)]
pub struct SurqlAstParserAdapter {
    pub config: SurqlConfig,
}

impl SurqlAstParserAdapter {
    pub fn new() -> Self {
        Self {
            config: SurqlConfig::default(),
        }
    }

    pub fn with_config(config: SurqlConfig) -> Self {
        Self { config }
    }
}

impl AstParserPort for SurqlAstParserAdapter {
    fn can_parse(&self, path: &Path) -> bool {
        path.extension().is_some_and(|ext| ext == "surql")
    }

    fn parse_file(&self, path: &Path, _crate_name: &str) -> Result<Vec<Violation>, String> {
        let content = fs::read_to_string(path)
            .map_err(|e| format!("Could not read SurQL file {}: {}", path.display(), e))?;

        let doc = SurqlParser::parse(&content, path.to_path_buf());
        
        // Collect schema from all .surql files in the same directory (modular schema support)
        let mut all_docs = vec![doc.clone()];
        if let Some(parent) = path.parent() {
            if let Ok(entries) = fs::read_dir(parent) {
                for entry in entries.flatten() {
                    let sibling_path = entry.path();
                    if sibling_path != path && sibling_path.extension().is_some_and(|ext| ext == "surql") {
                        if let Ok(sibling_content) = fs::read_to_string(&sibling_path) {
                            all_docs.push(SurqlParser::parse(&sibling_content, sibling_path));
                        }
                    }
                }
            }
        }

        let schema = SchemaCollector::collect(&all_docs);
        let engine = SurqlEngine::new(self.config.clone());

        let violations = engine.inspect_document(&doc, &schema);
        Ok(violations)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::NamedTempFile;
    use std::io::Write;

    #[test]
    fn test_surql_adapter_can_parse() {
        let adapter = SurqlAstParserAdapter::default();
        assert!(adapter.can_parse(Path::new("schema.surql")));
        assert!(adapter.can_parse(Path::new("path/to/01_tables.surql")));
        assert!(!adapter.can_parse(Path::new("main.rs")));
        assert!(!adapter.can_parse(Path::new("App.vue")));
        assert!(!adapter.can_parse(Path::new("no_ext")));
    }

    #[test]
    fn test_surql_adapter_parse_file_success() {
        let mut temp = NamedTempFile::new().unwrap();
        writeln!(temp, "DEFINE TABLE OVERWRITE user TYPE NORMAL SCHEMAFULL;").unwrap();
        writeln!(temp, "DEFINE FIELD OVERWRITE name ON TABLE user TYPE string;").unwrap();

        let adapter = SurqlAstParserAdapter::with_config(SurqlConfig::default());
        let violations = adapter.parse_file(temp.path(), "test_crate").unwrap();
        assert!(violations.is_empty());
    }

    #[test]
    fn test_surql_adapter_parse_file_violation() {
        let mut temp = NamedTempFile::new().unwrap();
        // Schemaless table without OVERWRITE and un-overwritten field
        writeln!(temp, "DEFINE TABLE account SCHEMALESS;").unwrap();
        writeln!(temp, "DEFINE FIELD balance ON TABLE account TYPE float;").unwrap();

        let adapter = SurqlAstParserAdapter::new();
        let violations = adapter.parse_file(temp.path(), "test_crate").unwrap();
        let has_schemaless = violations.iter().any(|v| v.rule_id == "SURQL-007");
        let has_non_idempotent = violations.iter().any(|v| v.rule_id == "SURQL-008");
        assert!(has_schemaless);
        assert!(has_non_idempotent);
    }

    #[test]
    fn test_surql_adapter_read_error() {
        let adapter = SurqlAstParserAdapter::new();
        let res = adapter.parse_file(Path::new("non_existent_surql_file_xyz.surql"), "test");
        assert!(res.is_err());
    }

    #[test]
    fn test_surql_adapter_modular_schema_sibling_indexes() {
        let temp_dir = tempfile::tempdir().unwrap();
        let tables_path = temp_dir.path().join("01_tables.surql");
        let indexes_path = temp_dir.path().join("02_indexes.surql");

        fs::write(
            &tables_path,
            "DEFINE TABLE OVERWRITE orders TYPE NORMAL SCHEMAFULL;\nDEFINE FIELD OVERWRITE user_id ON TABLE orders TYPE record<user>;\n",
        ).unwrap();

        fs::write(
            &indexes_path,
            "DEFINE INDEX OVERWRITE idx_orders_user ON TABLE orders FIELDS user_id;\n",
        ).unwrap();

        let adapter = SurqlAstParserAdapter::new();
        let violations = adapter.parse_file(&tables_path, "test_crate").unwrap();
        // Since 02_indexes.surql defines idx_orders_user on user_id, SURQL-017 should not trigger
        assert!(!violations.iter().any(|v| v.rule_id == "SURQL-017"));
    }
}
