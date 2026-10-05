use crate::ast::document::SurqlDocument;
use crate::ast::node::*;
use regex::Regex;
use std::path::{Path, PathBuf};

pub struct SurqlParser;

impl SurqlParser {
    pub fn parse(source: &str, file_path: PathBuf) -> SurqlDocument {
        let mut statements = Vec::new();
        let doc_dummy = SurqlDocument::new(source.to_string(), file_path.clone(), Vec::new());

        let raw_stmts = Self::split_statements(source);

        for (start_byte, end_byte, stmt_text) in raw_stmts {
            let span = doc_dummy.resolve_span(start_byte, end_byte);
            if let Some(parsed) = Self::parse_statement(&stmt_text, span, source, &doc_dummy) {
                statements.push(parsed);
            }
        }

        SurqlDocument::new(source.to_string(), file_path, statements)
    }

    pub fn parse_inline(source: &str, file_path: &Path) -> SurqlDocument {
        Self::parse(source, file_path.to_path_buf())
    }

    fn split_statements(source: &str) -> Vec<(usize, usize, String)> {
        let mut results = Vec::new();
        let mut in_single_quote = false;
        let mut in_double_quote = false;
        let mut in_line_comment = false;
        let mut in_block_comment = false;
        let mut brace_depth: usize = 0;
        let mut stmt_start = 0;

        let bytes = source.as_bytes();
        let mut i = 0;
        while i < bytes.len() {
            let b = bytes[i];
            let next_b = if i + 1 < bytes.len() { Some(bytes[i + 1]) } else { None };

            if in_line_comment {
                if b == b'\n' {
                    in_line_comment = false;
                }
                i += 1;
                continue;
            }

            if in_block_comment {
                if b == b'*' && next_b == Some(b'/') {
                    in_block_comment = false;
                    i += 2;
                    continue;
                }
                i += 1;
                continue;
            }

            if in_single_quote {
                if b == b'\\' {
                    i += 2;
                    continue;
                }
                if b == b'\'' {
                    in_single_quote = false;
                }
                i += 1;
                continue;
            }

            if in_double_quote {
                if b == b'\\' {
                    i += 2;
                    continue;
                }
                if b == b'"' {
                    in_double_quote = false;
                }
                i += 1;
                continue;
            }

            if b == b'-' && next_b == Some(b'-') {
                in_line_comment = true;
                i += 2;
                continue;
            }
            if b == b'/' && next_b == Some(b'*') {
                in_block_comment = true;
                i += 2;
                continue;
            }
            if b == b'\'' {
                in_single_quote = true;
                i += 1;
                continue;
            }
            if b == b'"' {
                in_double_quote = true;
                i += 1;
                continue;
            }

            if b == b'{' {
                brace_depth += 1;
            } else if b == b'}' {
                brace_depth = brace_depth.saturating_sub(1);
            }

            if b == b';' && brace_depth == 0 {
                let stmt_str = source[stmt_start..=i].trim().to_string();
                if !stmt_str.is_empty() {
                    results.push((stmt_start, i + 1, stmt_str));
                }
                stmt_start = i + 1;
            }

            i += 1;
        }

        if stmt_start < source.len() {
            let tail = source[stmt_start..].trim().to_string();
            if !tail.is_empty() {
                results.push((stmt_start, source.len(), tail));
            }
        }

        results
    }

    fn parse_statement(
        raw: &str,
        span: SourceSpan,
        full_source: &str,
        doc: &SurqlDocument,
    ) -> Option<Statement> {
        let clean = raw.trim();
        if clean.is_empty() {
            return None;
        }

        let upper = clean.to_uppercase();

        if upper.starts_with("DEFINE TABLE") {
            return Some(Statement::DefineTable(Self::parse_define_table(clean, span)));
        }
        if upper.starts_with("DEFINE FIELD") {
            return Some(Statement::DefineField(Self::parse_define_field(clean, span)));
        }
        if upper.starts_with("DEFINE INDEX") {
            return Some(Statement::DefineIndex(Self::parse_define_index(clean, span)));
        }
        if upper.starts_with("DEFINE FUNCTION") {
            return Some(Statement::DefineFunction(Self::parse_define_function(
                clean, span, full_source, doc,
            )));
        }
        if upper.starts_with("SELECT") {
            return Some(Statement::Select(Self::parse_select(clean, span)));
        }
        if upper.starts_with("UPDATE") {
            return Some(Statement::Update(Self::parse_update(clean, span)));
        }
        if upper.starts_with("DELETE") {
            return Some(Statement::Delete(Self::parse_delete(clean, span)));
        }
        if upper.starts_with("RELATE") {
            return Some(Statement::Relate(Self::parse_relate(clean, span)));
        }
        if upper.starts_with("FOR") {
            return Some(Statement::ForLoop(Self::parse_for_loop(clean, span, full_source, doc)));
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

    fn parse_define_table(raw: &str, span: SourceSpan) -> DefineTableNode {
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
            let rel_re = Regex::new(r"(?i)TYPE\s+RELATION\s+IN\s+([a-zA-Z0-9_| ]+)\s+OUT\s+([a-zA-Z0-9_| ]+)").unwrap();
            rel_re.captures(raw).map(|c| RelationEndpoints {
                in_table: c.get(1).map(|m| m.as_str().trim().to_string()).unwrap_or_default(),
                out_table: c.get(2).map(|m| m.as_str().trim().to_string()).unwrap_or_default(),
            })
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

    fn parse_define_field(raw: &str, span: SourceSpan) -> DefineFieldNode {
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

    fn parse_define_index(raw: &str, span: SourceSpan) -> DefineIndexNode {
        let is_overwrite = raw.to_uppercase().contains("OVERWRITE");
        let re = Regex::new(r"(?i)DEFINE\s+INDEX\s+(?:OVERWRITE\s+)?([a-zA-Z0-9_]+)\s+ON\s+(?:TABLE\s+)?([a-zA-Z0-9_]+)\s+(?:FIELDS|COLUMNS)\s+([a-zA-Z0-9_,\s]+)").unwrap();
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

    fn parse_define_function(
        raw: &str,
        span: SourceSpan,
        full_source: &str,
        doc: &SurqlDocument,
    ) -> DefineFunctionNode {
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

        let body_statements = Self::parse_nested_body(raw, span.byte_range.start, full_source, doc);

        DefineFunctionNode {
            span,
            name,
            is_overwrite,
            parameters,
            return_type: None,
            body_statements,
        }
    }

    fn parse_select(raw: &str, span: SourceSpan) -> SelectNode {
        let upper = raw.to_uppercase();
        let is_wildcard = upper.contains("SELECT *") || upper.contains("SELECT\n*");

        let from_re = Regex::new(r"(?i)\bFROM\s+([a-zA-Z0-9_:]+)").unwrap();
        let from_table = from_re
            .captures(raw)
            .and_then(|c| c.get(1))
            .map(|m| m.as_str().to_string());

        let where_re = Regex::new(r"(?i)\bWHERE\s+([^;]+?)(?:\s+GROUP|\s+ORDER|\s+LIMIT|\s+FETCH|;|\z)").unwrap();
        let where_clause = where_re
            .captures(raw)
            .and_then(|c| c.get(1))
            .map(|m| m.as_str().trim().to_string());

        let group_re = Regex::new(r"(?i)\bGROUP\s+(?:BY\s+|ALL\b)([^;]+?)(?:\s+ORDER|\s+LIMIT|;|\z)").unwrap();
        let group_by = group_re
            .captures(raw)
            .and_then(|c| c.get(1))
            .map(|m| m.as_str().trim().to_string());

        let order_re = Regex::new(r"(?i)\bORDER\s+BY\s+([^;]+?)(?:\s+LIMIT|;|\z)").unwrap();
        let order_by = order_re
            .captures(raw)
            .and_then(|c| c.get(1))
            .map(|m| m.as_str().trim().to_string());

        let limit_re = Regex::new(r"(?i)\bLIMIT\s+([0-9]+)").unwrap();
        let limit = limit_re
            .captures(raw)
            .and_then(|c| c.get(1))
            .and_then(|m| m.as_str().parse::<usize>().ok());

        let mut function_calls = Vec::new();
        let fn_re = Regex::new(r"([a-zA-Z0-9_:]+)\s*\((.*?)\)").unwrap();
        for cap in fn_re.captures_iter(raw) {
            if let Some(fn_name) = cap.get(1) {
                let full = cap.get(0).map(|m| m.as_str()).unwrap_or("");
                function_calls.push(FunctionCallInfo {
                    name: fn_name.as_str().to_string(),
                    full_call: full.to_string(),
                    span: span.clone(),
                });
            }
        }

        let is_subquery_zero_indexed = raw.contains(")[0]") || raw.contains("] [0]");

        SelectNode {
            span,
            is_wildcard,
            projected_fields: Vec::new(),
            from_table,
            where_clause,
            group_by,
            order_by,
            limit,
            function_calls,
            subqueries: Vec::new(),
            is_subquery_zero_indexed,
        }
    }

    fn parse_update(raw: &str, span: SourceSpan) -> UpdateNode {
        let re = Regex::new(r"(?i)UPDATE\s+([a-zA-Z0-9_:]+)").unwrap();
        let target = re
            .captures(raw)
            .and_then(|c| c.get(1))
            .map(|m| m.as_str().to_string())
            .unwrap_or_default();

        let is_record_id = target.contains(':');
        let has_where = raw.to_uppercase().contains("WHERE");

        let where_re = Regex::new(r"(?i)\bWHERE\s+(.+?)(?:;|\z)").unwrap();
        let where_clause = where_re
            .captures(raw)
            .and_then(|c| c.get(1))
            .map(|m| m.as_str().trim().to_string());

        let mut set_assignments = Vec::new();
        let set_re = Regex::new(r"(?i)\bSET\s+([^;]+)").unwrap();
        if let Some(c) = set_re.captures(raw) {
            if let Some(assignments) = c.get(1) {
                for part in assignments.as_str().split(',') {
                    if let Some((k, v)) = part.split_once('=') {
                        set_assignments.push((k.trim().to_string(), v.trim().to_string()));
                    }
                }
            }
        }

        UpdateNode {
            span,
            target,
            is_record_id,
            has_where,
            where_clause,
            set_assignments,
        }
    }

    fn parse_delete(raw: &str, span: SourceSpan) -> DeleteNode {
        let re = Regex::new(r"(?i)DELETE\s+(?:FROM\s+)?([a-zA-Z0-9_:]+)").unwrap();
        let target = re
            .captures(raw)
            .and_then(|c| c.get(1))
            .map(|m| m.as_str().to_string())
            .unwrap_or_default();

        let is_record_id = target.contains(':');
        let has_where = raw.to_uppercase().contains("WHERE");

        let where_re = Regex::new(r"(?i)\bWHERE\s+(.+?)(?:;|\z)").unwrap();
        let where_clause = where_re
            .captures(raw)
            .and_then(|c| c.get(1))
            .map(|m| m.as_str().trim().to_string());

        DeleteNode {
            span,
            target,
            is_record_id,
            has_where,
            where_clause,
        }
    }

    fn parse_relate(raw: &str, span: SourceSpan) -> RelateNode {
        let re = Regex::new(r"(?i)RELATE\s+([^\s\->]+)\s*->\s*([a-zA-Z0-9_]+)\s*->\s*([^\s;{]+)").unwrap();
        let (from, relation_table, to) = if let Some(c) = re.captures(raw) {
            (
                c.get(1).map(|m| m.as_str().to_string()).unwrap_or_default(),
                c.get(2).map(|m| m.as_str().to_string()).unwrap_or_default(),
                c.get(3).map(|m| m.as_str().to_string()).unwrap_or_default(),
            )
        } else {
            (String::new(), String::new(), String::new())
        };

        RelateNode {
            span,
            from,
            relation_table,
            to,
        }
    }

    fn parse_for_loop(
        raw: &str,
        span: SourceSpan,
        full_source: &str,
        doc: &SurqlDocument,
    ) -> ForLoopNode {
        let re = Regex::new(r"(?i)FOR\s+(\$[a-zA-Z0-9_]+)\s+IN\s+([^\s{]+)").unwrap();
        let (iterator_var, target_iterable) = if let Some(c) = re.captures(raw) {
            (
                c.get(1).map(|m| m.as_str().to_string()).unwrap_or_default(),
                c.get(2).map(|m| m.as_str().to_string()).unwrap_or_default(),
            )
        } else {
            (String::new(), String::new())
        };

        let body_statements = Self::parse_nested_body(raw, span.byte_range.start, full_source, doc);

        ForLoopNode {
            span,
            iterator_var,
            target_iterable,
            body_statements,
        }
    }

    fn parse_nested_body(
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
                    for (rel_start, rel_end, text) in Self::split_statements(inner) {
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
