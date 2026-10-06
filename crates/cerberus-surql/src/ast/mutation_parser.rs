use crate::ast::node::*;
use regex::Regex;

/// Specialized parser for SurrealQL mutating operations (UPDATE, DELETE, RELATE, FOR).
pub struct MutationParser;

impl MutationParser {
    pub fn parse_update(raw: &str, span: SourceSpan) -> UpdateNode {
        let re = Regex::new(r"(?i)UPDATE\s+([a-zA-Z0-9_$:]+)").unwrap();
        let target = re
            .captures(raw)
            .and_then(|c| c.get(1))
            .map(|m| m.as_str().to_string())
            .unwrap_or_default();

        let is_record_id = target.contains(':') || target.starts_with('$');
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

    pub fn parse_delete(raw: &str, span: SourceSpan) -> DeleteNode {
        let re = Regex::new(r"(?i)DELETE\s+(?:FROM\s+)?([a-zA-Z0-9_$:]+)").unwrap();
        let target = re
            .captures(raw)
            .and_then(|c| c.get(1))
            .map(|m| m.as_str().to_string())
            .unwrap_or_default();

        let is_record_id = target.contains(':') || target.starts_with('$');
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

    pub fn parse_relate(raw: &str, span: SourceSpan) -> RelateNode {
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

    pub fn parse_for_loop<F>(
        raw: &str,
        span: SourceSpan,
        parse_body: F,
    ) -> ForLoopNode
    where
        F: FnOnce(&str, usize) -> Vec<Statement>,
    {
        let re = Regex::new(r"(?i)FOR\s+(\$[a-zA-Z0-9_]+)\s+IN\s+([^\s{]+)").unwrap();
        let (iterator_var, target_iterable) = if let Some(c) = re.captures(raw) {
            (
                c.get(1).map(|m| m.as_str().to_string()).unwrap_or_default(),
                c.get(2).map(|m| m.as_str().to_string()).unwrap_or_default(),
            )
        } else {
            (String::new(), String::new())
        };

        let body_statements = parse_body(raw, span.byte_range.start);

        ForLoopNode {
            span,
            iterator_var,
            target_iterable,
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
    fn test_parse_update_assignments() {
        let raw = "UPDATE users:123 SET is_active = true, updated_at = time::now() WHERE is_active = false;";
        let node = MutationParser::parse_update(raw, dummy_span());
        assert_eq!(node.target, "users:123");
        assert!(node.is_record_id);
        assert!(node.has_where);
        assert_eq!(node.where_clause, Some("is_active = false".to_string()));
        assert_eq!(node.set_assignments.len(), 2);
        assert_eq!(node.set_assignments[0].0, "is_active");
    }

    #[test]
    fn test_parse_delete_where() {
        let raw = "DELETE FROM orders WHERE status = 'cancelled';";
        let node = MutationParser::parse_delete(raw, dummy_span());
        assert_eq!(node.target, "orders");
        assert!(!node.is_record_id);
        assert!(node.has_where);
        assert_eq!(node.where_clause, Some("status = 'cancelled'".to_string()));
    }

    #[test]
    fn test_parse_relate_endpoints() {
        let raw = "RELATE users:1->follows->users:2;";
        let node = MutationParser::parse_relate(raw, dummy_span());
        assert_eq!(node.from, "users:1");
        assert_eq!(node.relation_table, "follows");
        assert_eq!(node.to, "users:2");
    }

    #[test]
    fn test_parse_for_loop() {
        let raw = "FOR $user IN $users { RELATE $user->notified->events:1; };";
        let node = MutationParser::parse_for_loop(raw, dummy_span(), |_raw, _offset| Vec::new());
        assert_eq!(node.iterator_var, "$user");
        assert_eq!(node.target_iterable, "$users");
    }
}
