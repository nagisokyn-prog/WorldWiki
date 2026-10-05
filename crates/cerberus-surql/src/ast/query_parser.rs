use crate::ast::node::*;
use regex::Regex;

/// Specialized parser for SurrealQL read-only queries (SELECT statements).
pub struct QueryParser;

impl QueryParser {
    pub fn parse_select(raw: &str, span: SourceSpan) -> SelectNode {
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
    fn test_parse_select_wildcard() {
        let raw = "SELECT * FROM users;";
        let node = QueryParser::parse_select(raw, dummy_span());
        assert!(node.is_wildcard);
        assert_eq!(node.from_table, Some("users".to_string()));
    }

    #[test]
    fn test_parse_select_clauses_and_limits() {
        let raw = "SELECT id, name FROM users WHERE is_active = true ORDER BY name ASC LIMIT 25;";
        let node = QueryParser::parse_select(raw, dummy_span());
        assert!(!node.is_wildcard);
        assert_eq!(node.from_table, Some("users".to_string()));
        assert_eq!(node.where_clause, Some("is_active = true".to_string()));
        assert_eq!(node.order_by, Some("name ASC".to_string()));
        assert_eq!(node.limit, Some(25));
    }

    #[test]
    fn test_parse_select_function_calls() {
        let raw = "SELECT search::score(1) AS score FROM articles WHERE title @1@ 'rust';";
        let node = QueryParser::parse_select(raw, dummy_span());
        assert_eq!(node.function_calls.len(), 1);
        assert_eq!(node.function_calls[0].name, "search::score");
    }

    #[test]
    fn test_parse_select_group_by_and_subquery_zero_index() {
        let raw = "SELECT status, count() FROM orders GROUP BY status;";
        let node = QueryParser::parse_select(raw, dummy_span());
        assert_eq!(node.group_by, Some("status".to_string()));

        let raw_zero = "SELECT (SELECT id FROM users)[0] AS first_user FROM orders;";
        let node_zero = QueryParser::parse_select(raw_zero, dummy_span());
        assert!(node_zero.is_subquery_zero_indexed);
    }
}
