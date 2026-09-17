use cerberus_domain::{compute_fingerprint, Category, RuleDefinition, Severity, Violation};
use std::path::PathBuf;
use syn::visit::Visit;
use syn::{File, ItemStatic, Stmt};

pub struct ConcurrencyRulesChecker<'a> {
    file_path: &'a str,
    rules: &'a [RuleDefinition],
}

impl<'a> ConcurrencyRulesChecker<'a> {
    pub fn new(file_path: &'a str, rules: &'a [RuleDefinition]) -> Self {
        Self { file_path, rules }
    }

    pub fn check_file(&self, syntax: &File) -> Vec<Violation> {
        let mut violations = Vec::new();
        let mut visitor = ConcurrencyRulesVisitor {
            checker: self,
            violations: &mut violations,
        };
        visitor.visit_file(syntax);
        violations
    }

    fn check_static_mut(&self, item: &ItemStatic, violations: &mut Vec<Violation>) {
        if !self.is_rule_enabled("CONC-008") {
            return;
        }

        if let syn::StaticMutability::Mut(_) = &item.mutability {
            let name = item.ident.to_string();
            let snippet = format!("static mut {}: ...", name);
            let fp = compute_fingerprint("CONC-008", "1.0", &name, &snippet);

            violations.push(Violation {
                rule_id: "CONC-008".into(),
                rule_version: "1.0".into(),
                category: Category::Concurrency,
                severity: self.get_severity("CONC-008", Severity::Deny),
                file: PathBuf::from(self.file_path),
                line: 1,
                column: 1,
                symbol: name,
                message: "Global 'static mut' variable causes undefined behavior and data races under concurrent execution.".into(),
                snippet,
                remediation: "Replace static mut with Atomic types, Mutex, or std::sync::OnceLock.".into(),
                fingerprint: fp,
            });
        }
    }

    fn check_stmt(&self, stmt: &Stmt, violations: &mut Vec<Violation>) {
        if !self.is_rule_enabled("CONC-002") {
            return;
        }

        // Check if statement is an expression containing tokio::spawn
        if let Stmt::Expr(expr, _) = stmt {
            let expr_str = quote::quote!(#expr).to_string();
            if (expr_str.contains("tokio :: spawn") || expr_str.contains("spawn (") || expr_str.contains("spawn("))
                && !expr_str.contains("token")
                && !expr_str.contains("cancellation")
            {
                let snippet = expr_str;
                let fp = compute_fingerprint("CONC-002", "1.0", "orphan_spawn", &snippet);

                violations.push(Violation {
                    rule_id: "CONC-002".into(),
                    rule_version: "1.0".into(),
                    category: Category::Concurrency,
                    severity: self.get_severity("CONC-002", Severity::Deny),
                    file: PathBuf::from(self.file_path),
                    line: 1,
                    column: 1,
                    symbol: "orphan_spawn".into(),
                    message: "Unbounded 'tokio::spawn' executed without storing JoinHandle or attaching CancellationToken.".into(),
                    snippet,
                    remediation: "Store the returned JoinHandle or pass a CancellationToken to enable graceful task shutdown.".into(),
                    fingerprint: fp,
                });
            }
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

struct ConcurrencyRulesVisitor<'a, 'b> {
    checker: &'a ConcurrencyRulesChecker<'a>,
    violations: &'b mut Vec<Violation>,
}

impl<'a, 'b> Visit<'_> for ConcurrencyRulesVisitor<'a, 'b> {
    fn visit_item_static(&mut self, item: &ItemStatic) {
        self.checker.check_static_mut(item, self.violations);
        syn::visit::visit_item_static(self, item);
    }

    fn visit_stmt(&mut self, item: &Stmt) {
        self.checker.check_stmt(item, self.violations);
        syn::visit::visit_stmt(self, item);
    }
}
