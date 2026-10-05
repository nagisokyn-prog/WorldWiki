/// Lexical statement splitter for SurrealQL scripts.
/// Handles comments (`--`, `/* */`), string literals (`'`, `"`), and nested block scopes (`{ }`).
pub struct StatementSplitter;

impl StatementSplitter {
    /// Splits raw SurrealQL script text into individual statement spans (byte_start, byte_end, text).
    pub fn split(source: &str) -> Vec<(usize, usize, String)> {
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
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_split_simple_statements() {
        let sql = "SELECT * FROM users; SELECT id FROM orders;";
        let stmts = StatementSplitter::split(sql);
        assert_eq!(stmts.len(), 2);
        assert_eq!(stmts[0].2, "SELECT * FROM users;");
        assert_eq!(stmts[1].2, "SELECT id FROM orders;");
    }

    #[test]
    fn test_split_with_line_and_block_comments() {
        let sql = r#"
            -- First statement
            SELECT 1;
            /* Block comment containing ; semicolon */
            SELECT 2;
        "#;
        let stmts = StatementSplitter::split(sql);
        assert_eq!(stmts.len(), 2);
        assert!(stmts[0].2.contains("SELECT 1"));
        assert!(stmts[1].2.contains("SELECT 2"));
    }

    #[test]
    fn test_split_with_quotes_containing_semicolons() {
        let sql = r#"
            INSERT INTO logs { msg: "hello; world" };
            SELECT 'semicolon; here' AS txt;
        "#;
        let stmts = StatementSplitter::split(sql);
        assert_eq!(stmts.len(), 2);
    }

    #[test]
    fn test_split_nested_braces() {
        let sql = r#"
            DEFINE FUNCTION fn::test() {
                LET $a = 1;
                RETURN $a;
            };
            SELECT 1;
        "#;
        let stmts = StatementSplitter::split(sql);
        assert_eq!(stmts.len(), 2);
        assert!(stmts[0].2.starts_with("DEFINE FUNCTION"));
        assert!(stmts[1].2.starts_with("SELECT 1"));
    }

    #[test]
    fn test_split_trailing_unclosed_statement() {
        let sql = "SELECT * FROM users";
        let stmts = StatementSplitter::split(sql);
        assert_eq!(stmts.len(), 1);
        assert_eq!(stmts[0].2, "SELECT * FROM users");
    }
}
