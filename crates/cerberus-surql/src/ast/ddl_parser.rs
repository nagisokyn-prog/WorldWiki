use crate::ast::node::*;
use regex::Regex;

/// Specialized parser for SurrealQL DDL statements (DEFINE TABLE, FIELD, INDEX, FUNCTION).
pub struct DdlParser;

impl DdlParser {
    pub fn parse_define_table(raw: &str, span: SourceSpan) -> DefineTableNode {
        let is_overwrite = raw.to_uppercase().contains("OVERWRITE");
        let is_schemfull = raw.to_uppercase().contains("SCHEMAFULL");
        let is_schemaless = raw.to_uppercase().contains("SCHEMALESS");

        let re = Regex::new(r"(?i)DEFINE\s+TABLE\s+(?:OVERWRITE\s+)?([a-zA-Z0-9_]+)").unwrap();
        let name = re
            .captures(raw)
            .and_then(|c| c.get(1))
            .map(|m| m.as_str().to_string())
            .unwrap_or_default();

        let relation = if raw.to_uppercase().contains("TYPE RELATION") {
            let rel_re = Regex::new(r"(?i)TYPE\s+RELATION(?:\s+IN\s+([a-zA-Z0-9_|]+))?(?:\s+OUT\s+([a-zA-Z0-9_|]+))?").unwrap();
            if let Some(c) = rel_re.captures(raw) {
                Some(RelationEndpoints {
                    in_table: c.get(1).map(|m| m.as_str().trim().to_string()).unwrap_or_default(),
                    out_table: c.get(2).map(|m| m.as_str().trim().to_string()).unwrap_or_default(),
                })
            } else {
                Some(RelationEndpoints {
                    in_table: String::new(),
                    out_table: String::new(),
                })
            }
        } else {
            None
        };

        DefineTableNode {
            span,
            name,
            is_overwrite,
            is_schemfull,
            is_schemaless,
            relation,
        }
    }

    pub fn parse_define_field(raw: &str, span: SourceSpan) -> DefineFieldNode {
        let is_overwrite = raw.to_uppercase().contains("OVERWRITE");
        let re = Regex::new(r"(?i)DEFINE\s+FIELD\s+(?:OVERWRITE\s+)?([a-zA-Z0-9_.*]+)\s+ON\s+(?:TABLE\s+)?([a-zA-Z0-9_]+)").unwrap();
        let (field_name, table_name) = if let Some(c) = re.captures(raw) {
            (
                c.get(1).map(|m| m.as_str().to_string()).unwrap_or_default(),
                c.get(2).map(|m| m.as_str().to_string()).unwrap_or_default(),
            )
        } else {
            (String::new(), String::new())
        };

        let type_re = Regex::new(r"(?i)TYPE\s+([^;]+?)(?:\s+DEFAULT|\s+ASSERT|\s+PERMISSIONS|\s+VALUE|;|\z)").unwrap();
        let raw_type = type_re
            .captures(raw)
            .and_then(|c| c.get(1))
            .map(|m| m.as_str().trim().to_string())
            .unwrap_or_default();

        let default_re = Regex::new(r"(?i)DEFAULT\s+(?:ALWAYS\s+)?([^;]+?)(?:\s+ASSERT|\s+PERMISSIONS|\s+VALUE|;|\z)").unwrap();
        let default_expr = default_re
            .captures(raw)
            .and_then(|c| c.get(1))
            .map(|m| m.as_str().trim().to_string());

        let lower_type = raw_type.to_lowercase();
        let is_nullable = lower_type.contains("| null") || lower_type.contains("|null");
        let is_optional = lower_type.starts_with("option<") || lower_type.contains("| none");

        DefineFieldNode {
            span,
            field_name,
            table_name,
            is_overwrite,
            raw_type,
            is_nullable,
            is_optional,
            default_expr,
        }
    }

    pub fn parse_define_index(raw: &str, span: SourceSpan) -> DefineIndexNode {
        let is_overwrite = raw.to_uppercase().contains("OVERWRITE");
        let re = Regex::new(r"(?i)DEFINE\s+INDEX\s+(?:OVERWRITE\s+)?([a-zA-Z0-9_]+)\s+ON\s+(?:TABLE\s+)?([a-zA-Z0-9_]+)\s+(?:FIELDS|COLUMNS)\s+([a-zA-Z0-9_,\s]+?)(?:\s+FULLTEXT|\s+SEARCH|\s+UNIQUE|\s+HNSW|\s+MTREE|\s+CONCURRENTLY|\s+COMMENT|;|\z)").unwrap();
        let (index_name, table_name, fields_str) = if let Some(c) = re.captures(raw) {
            (
                c.get(1).map(|m| m.as_str().to_string()).unwrap_or_default(),
                c.get(2).map(|m| m.as_str().to_string()).unwrap_or_default(),
                c.get(3).map(|m| m.as_str().to_string()).unwrap_or_default(),
            )
        } else {
            (String::new(), String::new(), String::new())
        };

        let fields: Vec<String> = fields_str
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();

        let is_fulltext = raw.to_uppercase().contains("FULLTEXT");
        let is_bm25 = raw.to_uppercase().contains("BM25");

        let analyzer_re = Regex::new(r"(?i)ANALYZER\s+([a-zA-Z0-9_]+)").unwrap();
        let analyzer = analyzer_re
            .captures(raw)
            .and_then(|c| c.get(1))
            .map(|m| m.as_str().to_string());

        DefineIndexNode {
            span,
            index_name,
            table_name,
            is_overwrite,
            fields,
            is_fulltext,
            analyzer,
            is_bm25,
        }
    }

    pub fn parse_define_function<F>(
        raw: &str,
        span: SourceSpan,
        parse_body: F,
    ) -> DefineFunctionNode
    where
        F: FnOnce(&str, usize) -> Vec<Statement>,
    {
        let is_overwrite = raw.to_uppercase().contains("OVERWRITE");
        let re = Regex::new(r"(?i)DEFINE\s+FUNCTION\s+(?:OVERWRITE\s+)?(fn::[a-zA-Z0-9_]+)\s*\((.*?)\)").unwrap();
        let (name, params_str) = if let Some(c) = re.captures(raw) {
            (
                c.get(1).map(|m| m.as_str().to_string()).unwrap_or_default(),
                c.get(2).map(|m| m.as_str().to_string()).unwrap_or_default(),
            )
        } else {
            (String::new(), String::new())
        };

        let mut parameters = Vec::new();
        if !params_str.trim().is_empty() {
            for part in params_str.split(',') {
                let part = part.trim();
                if part.is_empty() {
                    continue;
                }
                if let Some((pname, ptype)) = part.split_once(':') {
                    parameters.push(FunctionParam {
                        name: pname.trim().to_string(),
                        raw_type: Some(ptype.trim().to_string()),
                    });
                } else {
                    parameters.push(FunctionParam {
                        name: part.to_string(),
                        raw_type: None,
                    });
                }
            }
        }

        let body_statements = parse_body(raw, span.byte_range.start);

        DefineFunctionNode {
            span,
            name,
            is_overwrite,
            parameters,
            return_type: None,
            body_statements,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn dummy_span() -> SourceSpan {
        SourceSpan {
            start_line: 1,
            start_col: 1,
            end_line: 1,
            end_col: 10,
            byte_range: 0..10,
        }
    }

    #[test]
    fn test_parse_define_table_schemfull_and_relation() {
        let raw = "DEFINE TABLE OVERWRITE user_follows TYPE RELATION IN users OUT users SCHEMAFULL;";
        let node = DdlParser::parse_define_table(raw, dummy_span());
        assert_eq!(node.name, "user_follows");
        assert!(node.is_overwrite);
        assert!(node.is_schemfull);
        assert!(!node.is_schemaless);
        let rel = node.relation.unwrap();
        assert_eq!(rel.in_table, "users");
        assert_eq!(rel.out_table, "users");
    }

    #[test]
    fn test_parse_define_field_types_and_defaults() {
        let raw = "DEFINE FIELD OVERWRITE email ON users TYPE option<string | null> DEFAULT none;";
        let node = DdlParser::parse_define_field(raw, dummy_span());
        assert_eq!(node.field_name, "email");
        assert_eq!(node.table_name, "users");
        assert!(node.is_overwrite);
        assert_eq!(node.raw_type, "option<string | null>");
        assert!(node.is_nullable);
        assert!(node.is_optional);
        assert_eq!(node.default_expr, Some("none".to_string()));
    }

    #[test]
    fn test_parse_define_index_fulltext() {
        let raw = "DEFINE INDEX OVERWRITE idx_title ON articles FIELDS title FULLTEXT ANALYZER ru_en_analyzer BM25 HIGHLIGHTS;";
        let node = DdlParser::parse_define_index(raw, dummy_span());
        assert_eq!(node.index_name, "idx_title");
        assert_eq!(node.table_name, "articles");
        assert!(node.is_overwrite);
        assert_eq!(node.fields, vec!["title"]);
        assert!(node.is_fulltext);
        assert!(node.is_bm25);
        assert_eq!(node.analyzer, Some("ru_en_analyzer".to_string()));
    }

    #[test]
    fn test_parse_define_function_params() {
        let raw = "DEFINE FUNCTION OVERWRITE fn::get_user($id: record<users>, $flag) { RETURN 1; };";
        let node = DdlParser::parse_define_function(raw, dummy_span(), |_raw, _offset| Vec::new());
        assert_eq!(node.name, "fn::get_user");
        assert!(node.is_overwrite);
        assert_eq!(node.parameters.len(), 2);
        assert_eq!(node.parameters[0].name, "$id");
        assert_eq!(node.parameters[0].raw_type, Some("record<users>".to_string()));
        assert_eq!(node.parameters[1].name, "$flag");
        assert_eq!(node.parameters[1].raw_type, None);
    }
}
