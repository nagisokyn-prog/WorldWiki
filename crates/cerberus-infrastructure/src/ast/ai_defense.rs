use cerberus_domain::{compute_fingerprint, Category, RuleDefinition, Severity, Violation};
use regex::Regex;
use std::path::PathBuf;
use syn::visit::Visit;
use syn::{Attribute, Expr, File, ImplItem, Item, Meta, Stmt};

pub struct AiDefenseChecker<'a> {
    file_path: &'a str,
    crate_name: &'a str,
    rules: &'a [RuleDefinition],
    source_code: &'a str,
}

impl<'a> AiDefenseChecker<'a> {
    pub fn new(
        file_path: &'a str,
        crate_name: &'a str,
        rules: &'a [RuleDefinition],
        source_code: &'a str,
    ) -> Self {
        Self {
            file_path,
            crate_name,
            rules,
            source_code,
        }
    }

    pub fn check_file(&self, syntax: &File) -> Vec<Violation> {
        let mut violations = Vec::new();

        // 1. Text-based strict checks: AI-009 (Strict Regex for TODO with TTL and Issue)
        self.check_todo_comments(&mut violations);

        // 2. Positional checks: AI-008 (Strict pre-unsafe SAFETY comment)
        self.check_unsafe_blocks_positional(&mut violations);

        // 3. Full AST traversal for AI-013 (Universal attribute suppression) and AI-003 (Reflection)
        let mut visitor = AiDefenseVisitor {
            checker: self,
            violations: &mut violations,
        };
        visitor.visit_file(syntax);

        violations
    }

    fn check_todo_comments(&self, violations: &mut Vec<Violation>) {
        if !self.is_rule_enabled("AI-009") {
            return;
        }

        // Strict pattern: // TODO(YYYY-MM-DD, #issue): description
        let valid_pattern = Regex::new(
            r#"^//\s*(TODO|FIXME)\(\d{4}-\d{2}-\d{2},\s*(#[0-9a-zA-Z_-]+|[A-Z]+-[0-9]+|https?://\S+)\)\s*:\s*.+"#,
        )
        .unwrap();

        for (line_idx, line) in self.source_code.lines().enumerate() {
            let trimmed = line.trim();
            if trimmed.starts_with("//") {
                let upper = trimmed.to_uppercase();
                if (upper.contains("TODO") || upper.contains("FIXME"))
                    && !valid_pattern.is_match(trimmed)
                {
                    let span_line = line_idx + 1;
                    let snippet = trimmed.to_string();
                    let fp = compute_fingerprint("AI-009", "1.0", "comment", &snippet);
                    violations.push(Violation {
                        rule_id: "AI-009".into(),
                        rule_version: "1.0".into(),
                        category: Category::AiDefense,
                        severity: self.get_severity("AI-009", Severity::Warn),
                        file: PathBuf::from(self.file_path),
                        line: span_line,
                        column: 1,
                        symbol: "comment".into(),
                        message: format!(
                            "Invalid or undated TODO comment '{}'. Required format: '// TODO(YYYY-MM-DD, #issue_or_url): description'.",
                            trimmed
                        ),
                        snippet,
                        remediation: "Specify expiration date and issue reference, e.g. '// TODO(2026-12-31, #123): Refactor'.".into(),
                        fingerprint: fp,
                    });
                }
            }
        }
    }

    fn check_unsafe_blocks_positional(&self, violations: &mut Vec<Violation>) {
        if !self.is_rule_enabled("AI-008") {
            return;
        }

        let lines: Vec<&str> = self.source_code.lines().collect();

        for (line_idx, line) in lines.iter().enumerate() {
            let trimmed = line.trim();
            // Look for 'unsafe {' or 'unsafe fn' anywhere on the line
            let is_unsafe = trimmed.starts_with("unsafe ")
                || trimmed.starts_with("unsafe{")
                || trimmed == "unsafe"
                || trimmed.contains(" unsafe ")
                || trimmed.contains(" unsafe{")
                || trimmed.starts_with("pub unsafe ")
                || trimmed.starts_with("async unsafe ");

            if is_unsafe {
                let mut has_safety_above = false;

                // Inspect 1 to 3 lines directly above
                let start_check = line_idx.saturating_sub(3);
                for prev_idx in (start_check..line_idx).rev() {
                    let prev_line = lines[prev_idx].trim();
                    if prev_line.is_empty() {
                        continue;
                    }
                    let upper = prev_line.to_uppercase();
                    if upper.starts_with("// SAFETY:") || upper.starts_with("// SAFETY :") {
                        has_safety_above = true;
                        break;
                    }
                    // If we encounter a non-empty, non-comment line or another statement, stop searching
                    if !prev_line.starts_with("//") {
                        break;
                    }
                }

                if !has_safety_above {
                    let snippet = trimmed.to_string();
                    let fp = compute_fingerprint("AI-008", "1.0", "unsafe_block", &snippet);
                    violations.push(Violation {
                        rule_id: "AI-008".into(),
                        rule_version: "1.0".into(),
                        category: Category::AiDefense,
                        severity: self.get_severity("AI-008", Severity::Deny),
                        file: PathBuf::from(self.file_path),
                        line: line_idx + 1,
                        column: 1,
                        symbol: "unsafe_block".into(),
                        message: "Unverified 'unsafe' block without mandatory '// SAFETY: <rationale>' comment immediately preceding it.".into(),
                        snippet,
                        remediation: "Add '// SAFETY: <proof of memory safety invariants>' on the line directly preceding 'unsafe'.".into(),
                        fingerprint: fp,
                    });
                }
            }
        }
    }

    fn check_attribute(&self, attr: &Attribute, target_symbol: &str, violations: &mut Vec<Violation>) {
        if !self.is_rule_enabled("AI-013") {
            return;
        }

        if attr.path().is_ident("allow") || attr.path().is_ident("expect") {
            if let Meta::List(meta_list) = &attr.meta {
                let tokens_str = meta_list.tokens.to_string();
                let ident = attr.path().get_ident().unwrap().to_string();
                let snippet = format!("#[{}({})]", ident, tokens_str);
                let fp = compute_fingerprint("AI-013", "1.0", target_symbol, &snippet);

                violations.push(Violation {
                    rule_id: "AI-013".into(),
                    rule_version: "1.0".into(),
                    category: Category::AiDefense,
                    severity: self.get_severity("AI-013", Severity::Deny),
                    file: PathBuf::from(self.file_path),
                    line: 1,
                    column: 1,
                    symbol: target_symbol.into(),
                    message: format!(
                        "Unauthorized compiler warning suppression '#[{}({})]' on '{}'. Suppressions must be cryptographically signed in cerberus ledger.",
                        ident, tokens_str, target_symbol
                    ),
                    snippet,
                    remediation: "Resolve underlying warning or register signed suppression via 'cargo cerberus ledger sign'.".into(),
                    fingerprint: fp,
                });
            }
        }
    }

    fn check_reflection_probe(&self, path_str: &str, violations: &mut Vec<Violation>) {
        if !self.is_rule_enabled("AI-003") {
            return;
        }

        let is_infra = self.crate_name.contains("infra") || self.crate_name.contains("adapter");
        if is_infra {
            return;
        }

        if path_str.contains("current_exe")
            || path_str.contains("proc::")
            || path_str.contains("env::current_dir")
        {
            let snippet = path_str.to_string();
            let fp = compute_fingerprint("AI-003", "1.0", "reflection_probe", &snippet);

            violations.push(Violation {
                rule_id: "AI-003".into(),
                rule_version: "1.0".into(),
                category: Category::AiDefense,
                severity: self.get_severity("AI-003", Severity::Deny),
                file: PathBuf::from(self.file_path),
                line: 1,
                column: 1,
                symbol: "reflection_probe".into(),
                message: format!(
                    "Unauthorized environment probe '{}' in crate '{}'. Probing platform environment is restricted to infrastructure adapters.",
                    path_str, self.crate_name
                ),
                snippet,
                remediation: "Move environment detection logic to infrastructure adapter behind a clean domain port.".into(),
                fingerprint: fp,
            });
        }
    }

    fn is_rule_enabled(&self, rule_id: &str) -> bool {
        self.rules
            .iter()
            .find(|r| r.id == rule_id)
            .map(|r| r.severity != Severity::Off)
            .unwrap_or(true)
    }

    fn get_severity(&self, rule_id: &str, default: Severity) -> Severity {
        self.rules
            .iter()
            .find(|r| r.id == rule_id)
            .map(|r| r.severity)
            .unwrap_or(default)
    }
}

struct AiDefenseVisitor<'a, 'b> {
    checker: &'a AiDefenseChecker<'a>,
    violations: &'b mut Vec<Violation>,
}

impl<'a, 'b> Visit<'_> for AiDefenseVisitor<'a, 'b> {
    fn visit_item(&mut self, item: &Item) {
        let (name, attrs) = match item {
            Item::Fn(f) => (f.sig.ident.to_string(), &f.attrs),
            Item::Struct(s) => (s.ident.to_string(), &s.attrs),
            Item::Enum(e) => (e.ident.to_string(), &e.attrs),
            Item::Trait(t) => (t.ident.to_string(), &t.attrs),
            Item::Mod(m) => (m.ident.to_string(), &m.attrs),
            Item::Type(t) => (t.ident.to_string(), &t.attrs),
            Item::Const(c) => (c.ident.to_string(), &c.attrs),
            Item::Static(s) => (s.ident.to_string(), &s.attrs),
            Item::Impl(i) => ("impl_block".to_string(), &i.attrs),
            _ => ("item".to_string(), &Vec::new()),
        };

        for attr in attrs {
            self.checker.check_attribute(attr, &name, self.violations);
        }

        syn::visit::visit_item(self, item);
    }

    fn visit_impl_item(&mut self, impl_item: &ImplItem) {
        if let ImplItem::Fn(method) = impl_item {
            let fn_name = method.sig.ident.to_string();
            for attr in &method.attrs {
                self.checker.check_attribute(attr, &fn_name, self.violations);
            }
        }
        syn::visit::visit_impl_item(self, impl_item);
    }

    fn visit_stmt(&mut self, stmt: &Stmt) {
        if let Stmt::Local(local) = stmt {
            for attr in &local.attrs {
                self.checker.check_attribute(attr, "let_binding", self.violations);
            }
        }
        syn::visit::visit_stmt(self, stmt);
    }

    fn visit_expr(&mut self, expr: &Expr) {
        if let Expr::Call(item) = expr {
            if let syn::Expr::Path(expr_path) = &*item.func {
                let path_str = expr_path
                    .path
                    .segments
                    .iter()
                    .map(|s| s.ident.to_string())
                    .collect::<Vec<_>>()
                    .join("::");
                self.checker.check_reflection_probe(&path_str, self.violations);
            }
        }
        syn::visit::visit_expr(self, expr);
    }
}
