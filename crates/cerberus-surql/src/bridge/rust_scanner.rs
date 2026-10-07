use crate::ast::parser::SurqlParser;
use crate::config::SurqlConfig;
use crate::rules::SurqlRule;
use crate::schema::registry::SchemaRegistry;
use cerberus_domain::{
    compute_location_fingerprint, Category, Severity, Violation,
};
use std::fs;
use std::path::Path;
use syn::visit::Visit;
use syn::{Expr, ExprLit, ExprMacro, ExprMethodCall, Lit};

pub struct RustSurqlInlineScanner<'a> {
    pub rules: &'a [Box<dyn SurqlRule>],
    pub schema: &'a SchemaRegistry,
    pub config: &'a SurqlConfig,
}

impl<'a> RustSurqlInlineScanner<'a> {
    pub fn new(
        rules: &'a [Box<dyn SurqlRule>],
        schema: &'a SchemaRegistry,
        config: &'a SurqlConfig,
    ) -> Self {
        Self {
            rules,
            schema,
            config,
        }
    }

    pub fn scan_syntax_tree(&self, syn_file: &syn::File, path: &Path) -> Vec<Violation> {
        let path_str = path.to_string_lossy();
        if path_str.contains("_macros") || path_str.contains("proc_macro") {
            return Vec::new();
        }

        let mut visitor = QueryCallVisitor {
            file_path: path,
            violations: Vec::new(),
            rules: self.rules,
            schema: self.schema,
            config: self.config,
        };

        visitor.visit_file(syn_file);
        visitor.violations
    }

    pub fn scan_file(&self, path: &Path) -> Vec<Violation> {
        let path_str = path.to_string_lossy();
        if path_str.contains("_macros") || path_str.contains("proc_macro") {
            return Vec::new();
        }

        let content = match fs::read_to_string(path) {
            Ok(c) => c,
            Err(_) => return Vec::new(),
        };

        let syn_file = match syn::parse_file(&content) {
            Ok(f) => f,
            Err(_) => return Vec::new(),
        };

        self.scan_syntax_tree(&syn_file, path)
    }
}

pub fn scan_rust_source_for_surreal_queries(content: &str, file_path: &Path) -> Vec<Violation> {
    let syn_file = match syn::parse_file(content) {
        Ok(f) => f,
        Err(_) => return Vec::new(),
    };

    let rules = crate::rules::all_rules();
    let schema = SchemaRegistry::default();
    let config = SurqlConfig::default();

    let scanner = RustSurqlInlineScanner::new(&rules, &schema, &config);
    scanner.scan_syntax_tree(&syn_file, file_path)
}

struct QueryCallVisitor<'a> {
    file_path: &'a Path,
    violations: Vec<Violation>,
    rules: &'a [Box<dyn SurqlRule>],
    schema: &'a SchemaRegistry,
    config: &'a SurqlConfig,
}

impl<'a, 'ast> Visit<'ast> for QueryCallVisitor<'a> {
    fn visit_expr_macro(&mut self, node: &'ast ExprMacro) {
        let macro_name = node
            .mac
            .path
            .segments
            .last()
            .map(|s| s.ident.to_string())
            .unwrap_or_default();

        if macro_name == "format" {
            let tokens = node.mac.tokens.to_string();
            let upper = tokens.to_uppercase();
            let is_sql = upper.contains("\"SELECT ")
                || upper.contains("\"UPDATE ")
                || upper.contains("\"DELETE ")
                || upper.contains("\"INSERT ")
                || upper.contains("\"RELATE ")
                || upper.contains("\"UPSERT ")
                || upper.contains("\"DEFINE TABLE")
                || upper.contains("\"DEFINE FIELD")
                || upper.contains("\"DEFINE INDEX")
                || (upper.contains("SELECT ") && (upper.contains(" FROM ") || upper.contains(" WHERE ")))
                || (upper.contains("UPDATE ") && (upper.contains(" SET ") || upper.contains(" CONTENT ")))
                || (upper.contains("DELETE ") && (upper.contains(" FROM ") || upper.contains(" WHERE ") || upper.contains(" TYPE::RECORD")))
                || (upper.contains("CREATE ") && (upper.contains(" SET ") || upper.contains(" CONTENT ") || upper.contains(" TYPE::TABLE")))
                || (upper.contains("UPSERT ") && (upper.contains(" SET ") || upper.contains(" MERGE ") || upper.contains(" CONTENT ")))
                || (upper.contains("RELATE ") && upper.contains("->"));

            if is_sql {
                self.emit_sec011(
                    "format!(...)",
                    "Building SurrealQL query via format! macro. Pass parameterized bind values via .bind() instead.",
                );
            }
        }
        syn::visit::visit_expr_macro(self, node);
    }

    fn visit_expr_binary(&mut self, node: &'ast syn::ExprBinary) {
        if matches!(node.op, syn::BinOp::Add(_)) {
            let left_str = format!("{:?}", node.left);
            let right_str = format!("{:?}", node.right);
            let combined = format!("{} {}", left_str, right_str).to_uppercase();
            let is_sql = (combined.contains("SELECT ") && (combined.contains(" FROM ") || combined.contains(" WHERE ")))
                || (combined.contains("UPDATE ") && (combined.contains(" SET ") || combined.contains(" CONTENT ")))
                || (combined.contains("DELETE ") && (combined.contains(" FROM ") || combined.contains(" WHERE ")))
                || (combined.contains("INSERT ") && combined.contains(" INTO "))
                || (combined.contains("RELATE ") && combined.contains("->"));

            if is_sql {
                self.emit_sec011(
                    "string + string",
                    "Building SurrealQL query via string concatenation (+). Pass parameterized bind values via .bind() instead.",
                );
            }
        }
        syn::visit::visit_expr_binary(self, node);
    }

    fn visit_expr_method_call(&mut self, node: &'ast ExprMethodCall) {
        let method_name = node.method.to_string();
        if method_name == "query" || method_name == "query_raw" {
            if let Some(first_arg) = node.args.first() {
                self.inspect_query_arg(first_arg);
            }
        }
        syn::visit::visit_expr_method_call(self, node);
    }
}

impl<'a> QueryCallVisitor<'a> {
    fn inspect_query_arg(&mut self, expr: &Expr) {
        match expr {
            Expr::Macro(ExprMacro { mac, .. }) => {
                let macro_name = mac
                    .path
                    .segments
                    .last()
                    .map(|s| s.ident.to_string())
                    .unwrap_or_default();

                if macro_name == "format" && !self.violations.iter().any(|v| v.rule_id == "SEC-011") {
                    self.emit_sec011(
                        "format!(...)",
                        "Building SurrealQL query via format! macro. Pass parameterized bind values via .bind() instead.",
                    );
                }
            }
            Expr::Binary(binary) if matches!(binary.op, syn::BinOp::Add(_)) => {
                if !self.violations.iter().any(|v| v.rule_id == "SEC-011") {
                    self.emit_sec011(
                        "string + string",
                        "Building SurrealQL query via string concatenation (+). Pass parameterized bind values via .bind() instead.",
                    );
                }
            }
            Expr::Lit(ExprLit {
                lit: Lit::Str(lit_str),
                ..
            }) => {
                let sql_text = lit_str.value();
                let doc = SurqlParser::parse_inline(&sql_text, self.file_path);

                for rule in self.rules {
                    let surql_violations = rule.check(&doc, self.schema, self.config);
                    for v in surql_violations {
                        self.violations.push(Violation {
                            rule_id: v.rule_id,
                            rule_version: v.rule_version,
                            category: v.category,
                            severity: v.severity,
                            file: self.file_path.to_path_buf(),
                            line: 1, // Line within the string / file
                            column: 1,
                            symbol: v.symbol,
                            snippet: v.snippet,
                            message: format!("(Rust Inline SURQL) {}", v.message),
                            remediation: v.remediation,
                            fingerprint: v.fingerprint,
                        });
                    }
                }
            }
            _ => {}
        }
    }

    fn emit_sec011(&mut self, symbol: &str, message: &str) {
        let file_str = self.file_path.to_string_lossy().to_string();
        let fingerprint = compute_location_fingerprint(
            "SEC-011",
            "1.0",
            &file_str,
            symbol,
            symbol,
        );

        self.violations.push(Violation {
            rule_id: "SEC-011".to_string(),
            rule_version: "1.0".to_string(),
            category: Category::Security,
            severity: Severity::Deny,
            file: self.file_path.to_path_buf(),
            line: 1,
            column: 1,
            symbol: symbol.to_string(),
            snippet: format!("db.query({})", symbol),
            message: message.to_string(),
            remediation: "Use parameterized queries: db.query(\"SELECT * FROM table WHERE field = $val\").bind((\"val\", value)).".to_string(),
            fingerprint,
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::rules::all_rules;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn test_rust_scanner_file_read_error_handling() {
        let rules = all_rules();
        let schema = SchemaRegistry::new();
        let config = SurqlConfig::default();
        let scanner = RustSurqlInlineScanner::new(&rules, &schema, &config);

        let non_existent = Path::new("non_existent_file.rs");
        let violations = scanner.scan_file(non_existent);
        assert!(violations.is_empty());
    }

    #[test]
    fn test_rust_scanner_invalid_syntax_handling() {
        let rules = all_rules();
        let schema = SchemaRegistry::new();
        let config = SurqlConfig::default();
        let scanner = RustSurqlInlineScanner::new(&rules, &schema, &config);

        let dir = tempdir().unwrap();
        let file = dir.path().join("invalid.rs");
        fs::write(&file, "fn broken( { {{ unclosed").unwrap();

        let violations = scanner.scan_file(&file);
        assert!(violations.is_empty());
    }

    #[test]
    fn test_rust_scanner_inline_query_inspected() {
        let rules = all_rules();
        let schema = SchemaRegistry::new();
        let config = SurqlConfig::default();
        let scanner = RustSurqlInlineScanner::new(&rules, &schema, &config);

        let dir = tempdir().unwrap();
        let file = dir.path().join("repo.rs");
        let code = r#"
            pub async fn get_users(db: &Db, table_name: &str, dyn_param: usize) {
                db.query("SELECT * FROM users;").await.unwrap();
                db.query_raw("SELECT * FROM users;").await.unwrap();
                db.query(format!("SELECT * FROM {}", table_name)).await.unwrap();
                db.query("SELECT * FROM " + table_name).await.unwrap();
                db.query(dyn_param).await.unwrap();
                db.other_method().await.unwrap();
            }
        "#;
        fs::write(&file, code).unwrap();

        let violations = scanner.scan_file(&file);
        assert!(violations.iter().any(|v| v.rule_id == "SURQL-002"));
        assert!(violations.iter().any(|v| v.rule_id == "SEC-011"));
    }
}

