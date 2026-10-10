use crate::parsers::surql_context::SurqlSchemaContext;
use cerberus_domain::{CerberusConfig, Violation};
use cerberus_ports::AstParserPort;
use cerberus_surql::config::SurqlConfig;
use cerberus_surql::engine::SurqlEngine;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Default, Clone)]
pub struct SurqlAstParserAdapter {
    pub config: SurqlConfig,
    pub cerberus_config: Option<CerberusConfig>,
    pub workspace_root: Option<PathBuf>,
}

impl SurqlAstParserAdapter {
    pub fn new() -> Self {
        Self {
            config: SurqlConfig::default(),
            cerberus_config: None,
            workspace_root: None,
        }
    }

    pub fn with_config(config: SurqlConfig) -> Self {
        Self {
            config,
            cerberus_config: None,
            workspace_root: None,
        }
    }

    pub fn with_cerberus_config(
        mut self,
        cerberus_config: Option<CerberusConfig>,
        workspace_root: Option<PathBuf>,
    ) -> Self {
        self.cerberus_config = cerberus_config;
        self.workspace_root = workspace_root;
        self
    }
}

impl AstParserPort for SurqlAstParserAdapter {
    fn can_parse(&self, path: &Path) -> bool {
        path.extension().is_some_and(|ext| ext == "surql")
    }

    fn parse_file(&self, path: &Path, _crate_name: &str) -> Result<Vec<Violation>, String> {
        let content = fs::read_to_string(path)
            .map_err(|e| format!("Could not read SurQL file {}: {}", path.display(), e))?;

        let context = SurqlSchemaContext::build(
            path,
            &content,
            self.workspace_root.as_deref(),
            self.cerberus_config.as_ref(),
        );

        let engine = SurqlEngine::new(self.config.clone());
        let violations = engine.inspect_document(&context.document, &context.schema);
        Ok(violations)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::NamedTempFile;
    use std::io::Write;

    #[test]
    fn test_surql_adapter_new() {
        let adapter = SurqlAstParserAdapter::new();
        assert!(adapter.cerberus_config.is_none());
        assert!(adapter.workspace_root.is_none());
        assert!(adapter.config.strict_schema);
    }

    #[test]
    fn test_surql_adapter_with_config() {
        let custom_cfg = SurqlConfig {
            strict_schema: false,
            ..Default::default()
        };

        let adapter = SurqlAstParserAdapter::with_config(custom_cfg);
        assert!(!adapter.config.strict_schema);
        assert!(adapter.cerberus_config.is_none());
        assert!(adapter.workspace_root.is_none());
    }

    #[test]
    fn test_surql_adapter_with_cerberus_config() {
        let cerberus_cfg = CerberusConfig {
            version: "2.0".to_string(),
            ..Default::default()
        };
        let ws_root = PathBuf::from("/test/root");

        let adapter = SurqlAstParserAdapter::new().with_cerberus_config(
            Some(cerberus_cfg.clone()),
            Some(ws_root.clone()),
        );

        assert_eq!(
            adapter.cerberus_config.as_ref().map(|c| c.version.as_str()),
            Some("2.0")
        );
        assert_eq!(adapter.workspace_root, Some(ws_root));
    }

    #[test]
    fn test_surql_adapter_default() {
        let adapter = SurqlAstParserAdapter::default();
        assert!(adapter.cerberus_config.is_none());
        assert!(adapter.workspace_root.is_none());
    }

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
    fn test_surql_adapter_read_error() {
        let adapter = SurqlAstParserAdapter::new();
        let res = adapter.parse_file(Path::new("non_existent_surql_file_xyz.surql"), "test");
        assert!(res.is_err());
    }

    #[test]
    fn test_surql_adapter_parse_file_success() {
        let mut temp = NamedTempFile::new().unwrap();
        writeln!(temp, "DEFINE TABLE OVERWRITE user TYPE NORMAL SCHEMAFULL;").unwrap();
        writeln!(temp, "DEFINE FIELD OVERWRITE name ON TABLE user TYPE string;").unwrap();

        let adapter = SurqlAstParserAdapter::new();
        let violations = adapter.parse_file(temp.path(), "test_crate").unwrap();
        assert!(violations.is_empty());
    }

    #[test]
    fn test_surql_adapter_parse_file_violation() {
        let mut temp = NamedTempFile::new().unwrap();
        writeln!(temp, "DEFINE TABLE account SCHEMALESS;").unwrap();
        writeln!(temp, "DEFINE FIELD balance ON TABLE account TYPE float;").unwrap();

        let adapter = SurqlAstParserAdapter::new();
        let violations = adapter.parse_file(temp.path(), "test_crate").unwrap();
        let has_schemaless = violations.iter().any(|v| v.rule_id == "SURQL-007");
        let has_non_idempotent = violations.iter().any(|v| v.rule_id == "SURQL-008");
        assert!(has_schemaless);
        assert!(has_non_idempotent);
    }
}
