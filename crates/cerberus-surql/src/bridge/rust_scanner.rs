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

    pub fn scan_file(&self, path: &Path) -> Vec<Violation> {
        let content = match fs::read_to_string(path) {
            Ok(c) => c,
            Err(_) => return Vec::new(),
        };

        let syn_file = match syn::parse_file(&content) {
            Ok(f) => f,
            Err(_) => return Vec::new(),
        };

        let mut visitor = QueryCallVisitor {
            file_path: path,
            violations: Vec::new(),
            rules: self.rules,
            schema: self.schema,
            config: self.config,
        };

        visitor.visit_file(&syn_file);
        visitor.violations
    }
}

struct QueryCallVisitor<'a> {
    file_path: &'a Path,
    violations: Vec<Violation>,
    rules: &'a [Box<dyn SurqlRule>],
    schema: &'a SchemaRegistry,
    config: &'a SurqlConfig,
}

impl<'a, 'ast> Visit<'ast> for QueryCallVisitor<'a> {
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

                if macro_name == "format" {
                    self.emit_sec011(
                        "format!(...)",
                        "Building SurrealQL query via format! macro. Pass parameterized bind values via .bind() instead.",
                    );
                }
            }
            Expr::Binary(binary) if matches!(binary.op, syn::BinOp::Add(_)) => {
                self.emit_sec011(
                    "string + string",
                    "Building SurrealQL query via string concatenation (+). Pass parameterized bind values via .bind() instead.",
                );
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
