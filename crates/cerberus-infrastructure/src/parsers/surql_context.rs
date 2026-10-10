use crate::parsers::surql_scanner;
use cerberus_domain::CerberusConfig;
use cerberus_surql::ast::document::SurqlDocument;
use cerberus_surql::ast::parser::SurqlParser;
use cerberus_surql::schema::collector::SchemaCollector;
use cerberus_surql::schema::registry::SchemaRegistry;
use std::path::Path;

#[derive(Debug)]
pub struct SurqlSchemaContext {
    pub document: SurqlDocument,
    pub schema: SchemaRegistry,
}

impl SurqlSchemaContext {
    pub fn build(
        path: &Path,
        content: &str,
        workspace_root: Option<&Path>,
        cerberus_config: Option<&CerberusConfig>,
    ) -> Self {
        let doc = SurqlParser::parse(content, path.to_path_buf());
        let all_docs = surql_scanner::collect_modular_schemas(path, &doc);
        let mut schema = SchemaCollector::collect(&all_docs);

        let fn_re = regex::Regex::new(r"fn::([a-zA-Z0-9_]+)").unwrap();
        let ws_root = surql_scanner::resolve_workspace_root(path, workspace_root);

        if let Some(root) = ws_root {
            let scan_roots = surql_scanner::resolve_scan_roots(&root, cerberus_config);
            let ignore_patterns = cerberus_config.map(|c| c.ignore.as_slice()).unwrap_or(&[]);

            for scan_root in scan_roots {
                surql_scanner::scan_codebase_for_fn_refs(
                    &scan_root,
                    &root,
                    &fn_re,
                    ignore_patterns,
                    &mut schema,
                );
            }
        }

        Self {
            document: doc,
            schema,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_surql_schema_context_build_basic() {
        let temp_dir = tempfile::tempdir().unwrap();
        let file_path = temp_dir.path().join("users.surql");
        let content = "DEFINE TABLE OVERWRITE user TYPE NORMAL SCHEMAFULL;\nDEFINE FIELD OVERWRITE name ON TABLE user TYPE string;\n";
        fs::write(&file_path, content).unwrap();

        let ctx = SurqlSchemaContext::build(&file_path, content, None, None);
        assert_eq!(ctx.document.statements.len(), 2);
        assert!(ctx.schema.tables.contains_key("user"));
    }

    #[test]
    fn test_surql_schema_context_build_with_workspace_and_scan() {
        let temp_dir = tempfile::tempdir().unwrap();
        let ws_root = temp_dir.path();
        fs::write(
            ws_root.join("Cargo.toml"),
            "[workspace]\nmembers = [\"src\"]\n",
        )
        .unwrap();

        let schema_dir = ws_root.join("schema");
        fs::create_dir_all(&schema_dir).unwrap();
        let schema_file = schema_dir.join("calc.surql");
        let surql_content = "DEFINE FUNCTION OVERWRITE fn::calc_total() { RETURN 10; };\n";
        fs::write(&schema_file, surql_content).unwrap();

        let src_dir = ws_root.join("src");
        fs::create_dir_all(&src_dir).unwrap();
        fs::write(src_dir.join("main.rs"), "let _ = \"fn::calc_total()\";").unwrap();

        let ctx = SurqlSchemaContext::build(&schema_file, surql_content, Some(ws_root), None);
        assert!(ctx.schema.is_function_referenced("fn::calc_total"));
    }
}
