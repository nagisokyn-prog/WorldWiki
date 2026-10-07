use crate::ast::ddl_parser::DdlParser;
use crate::ast::dml_parser::DmlParser;
use crate::ast::document::SurqlDocument;
use crate::ast::lexer::StatementSplitter;
use crate::ast::node::*;
use std::path::{Path, PathBuf};

/// Top-level parser for SurrealQL AST documents and statements.
pub struct SurqlParser;

impl SurqlParser {
    /// Parses a complete SurrealQL source file into a `SurqlDocument`.
    pub fn parse(source: &str, file_path: PathBuf) -> SurqlDocument {
        let mut statements = Vec::new();
        let doc_dummy = SurqlDocument::new(source.to_string(), file_path.clone(), Vec::new());

        let raw_stmts = StatementSplitter::split(source);

        for (start_byte, end_byte, stmt_text) in raw_stmts {
            let span = doc_dummy.resolve_span(start_byte, end_byte);
            if let Some(parsed) = Self::parse_statement(&stmt_text, span, source, &doc_dummy) {
                statements.push(parsed);
            }
        }

        SurqlDocument::new(source.to_string(), file_path, statements)
    }

    /// Parses inline SurrealQL query from Rust backend / strings.
    pub fn parse_inline(source: &str, file_path: &Path) -> SurqlDocument {
        Self::parse(source, file_path.to_path_buf())
    }

    /// Strips leading whitespace, line comments (`--`, `//`, `#`), and block comments (`/* ... */`).
    pub fn strip_leading_comments(mut s: &str) -> &str {
        loop {
            s = s.trim_start();
            if s.starts_with("--") || s.starts_with("//") || s.starts_with('#') {
                if let Some(pos) = s.find('\n') {
                    s = &s[pos + 1..];
                } else {
                    return "";
                }
            } else if s.starts_with("/*") {
                if let Some(pos) = s.find("*/") {
                    s = &s[pos + 2..];
                } else {
                    return "";
                }
            } else {
                break;
            }
        }
        s
    }

    /// Dispatches and parses a single SurrealQL statement string into a typed AST `Statement`.
    pub fn parse_statement(
        raw: &str,
        span: SourceSpan,
        full_source: &str,
        doc: &SurqlDocument,
    ) -> Option<Statement> {
        let clean = Self::strip_leading_comments(raw).trim();
        if clean.is_empty() {
            return None;
        }

        let upper = clean.to_uppercase();

        if upper.starts_with("DEFINE TABLE") {
            return Some(Statement::DefineTable(DdlParser::parse_define_table(clean, span)));
        }
        if upper.starts_with("DEFINE FIELD") {
            return Some(Statement::DefineField(DdlParser::parse_define_field(clean, span)));
        }
        if upper.starts_with("DEFINE INDEX") {
            return Some(Statement::DefineIndex(DdlParser::parse_define_index(clean, span)));
        }
        if upper.starts_with("DEFINE FUNCTION") {
            return Some(Statement::DefineFunction(DdlParser::parse_define_function(
                clean,
                span,
                |nested_raw, offset| Self::parse_nested_body(nested_raw, offset, full_source, doc),
            )));
        }
        if upper.starts_with("SELECT") {
            return Some(Statement::Select(DmlParser::parse_select(clean, span)));
        }
        if upper.starts_with("UPDATE") {
            return Some(Statement::Update(DmlParser::parse_update(clean, span)));
        }
        if upper.starts_with("DELETE") {
            return Some(Statement::Delete(DmlParser::parse_delete(clean, span)));
        }
        if upper.starts_with("RELATE") {
            return Some(Statement::Relate(DmlParser::parse_relate(clean, span)));
        }
        if upper.starts_with("FOR") {
            return Some(Statement::ForLoop(DmlParser::parse_for_loop(
                clean,
                span,
                |nested_raw, offset| Self::parse_nested_body(nested_raw, offset, full_source, doc),
            )));
        }
        if upper.starts_with("RETURN") {
            let mut expr = clean[6..].trim().trim_end_matches(';').trim();
            if expr.starts_with('(') && expr.ends_with(')') {
                expr = expr[1..expr.len() - 1].trim().trim_end_matches(';').trim();
            }
            if let Some(inner_stmt) = Self::parse_statement(expr, span.clone(), full_source, doc) {
                return Some(inner_stmt);
            }
        }
        if upper.starts_with("LET ") {
            if let Some((_var, val_expr)) = clean.split_once('=') {
                let mut expr = val_expr.trim().trim_end_matches(';').trim();
                if expr.starts_with('(') && expr.ends_with(')') {
                    expr = expr[1..expr.len() - 1].trim().trim_end_matches(';').trim();
                }
                if let Some(inner_stmt) = Self::parse_statement(expr, span.clone(), full_source, doc) {
                    return Some(inner_stmt);
                }
            }
        }
        if upper.starts_with("BEGIN TRANSACTION") || upper.starts_with("BEGIN") {
            return Some(Statement::Transaction(TransactionNode {
                span,
                body_statements: Vec::new(),
            }));
        }

        Some(Statement::Other(OtherNode {
            span,
            raw: clean.to_string(),
        }))
    }

    /// Recursively parses block-scoped inner statements enclosed in `{ ... }`.
    pub fn parse_nested_body(
        raw: &str,
        parent_start: usize,
        full_source: &str,
        doc: &SurqlDocument,
    ) -> Vec<Statement> {
        let mut stmts = Vec::new();
        if let Some(open_idx) = raw.find('{') {
            if let Some(close_idx) = raw.rfind('}') {
                if open_idx < close_idx {
                    let inner = &raw[open_idx + 1..close_idx];
                    let base_offset = parent_start + open_idx + 1;
                    for (rel_start, rel_end, text) in StatementSplitter::split(inner) {
                        let abs_start = base_offset + rel_start;
                        let abs_end = base_offset + rel_end;
                        let span = doc.resolve_span(abs_start, abs_end);
                        if let Some(s) = Self::parse_statement(&text, span, full_source, doc) {
                            stmts.push(s);
                        }
                    }
                }
            }
        }
        stmts
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_multi_statement_script() {
        let sql = r#"
            DEFINE TABLE OVERWRITE users SCHEMAFULL;
            DEFINE FIELD OVERWRITE name ON users TYPE string;
            SELECT id, name FROM users LIMIT 10;
        "#;
        let doc = SurqlParser::parse(sql, PathBuf::from("schema.surql"));
        assert_eq!(doc.statements.len(), 3);
        assert!(matches!(doc.statements[0], Statement::DefineTable(_)));
        assert!(matches!(doc.statements[1], Statement::DefineField(_)));
        assert!(matches!(doc.statements[2], Statement::Select(_)));
    }

    #[test]
    fn test_parse_function_nested_body() {
        let sql = r#"
            DEFINE FUNCTION OVERWRITE fn::archive($id: record<users>) {
                UPDATE users SET is_active = false WHERE id = $id;
                RETURN (SELECT id, is_active FROM users WHERE id = $id LIMIT 1);
            };
        "#;
        let doc = SurqlParser::parse(sql, PathBuf::from("fn.surql"));
        assert_eq!(doc.statements.len(), 1);
        if let Statement::DefineFunction(f) = &doc.statements[0] {
            assert_eq!(f.name, "fn::archive");
            assert_eq!(f.body_statements.len(), 2);
            assert!(matches!(f.body_statements[0], Statement::Update(_)));
            assert!(matches!(f.body_statements[1], Statement::Select(_)));
        } else {
            panic!("Expected DefineFunction");
        }
    }

    #[test]
    fn test_parse_let_expression_unpacking() {
        let sql = "LET $top_users = (SELECT id FROM users LIMIT 5);";
        let doc = SurqlParser::parse(sql, PathBuf::from("query.surql"));
        assert_eq!(doc.statements.len(), 1);
        assert!(matches!(doc.statements[0], Statement::Select(_)));
    }

    #[test]
    fn test_parse_statements_with_leading_comments() {
        let sql = r#"
            -- 1. Section Header Comment
            -- Sub-comment line
            DEFINE INDEX OVERWRITE idx_volume_project ON volumes FIELDS project_id;

            /* Multi-line block comment
               explaining the following statement */
            DEFINE TABLE OVERWRITE volumes SCHEMAFULL;

            # Shell style comment
            DEFINE FIELD OVERWRITE name ON volumes TYPE string;
        "#;
        let doc = SurqlParser::parse(sql, PathBuf::from("schema.surql"));
        assert_eq!(doc.statements.len(), 3);
        assert!(matches!(doc.statements[0], Statement::DefineIndex(_)));
        if let Statement::DefineIndex(idx) = &doc.statements[0] {
            assert_eq!(idx.index_name, "idx_volume_project");
            assert_eq!(idx.table_name, "volumes");
            assert_eq!(idx.fields, vec!["project_id"]);
        }
        assert!(matches!(doc.statements[1], Statement::DefineTable(_)));
        assert!(matches!(doc.statements[2], Statement::DefineField(_)));
    }
}
