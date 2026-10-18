use cerberus_domain::{compute_fingerprint, Category, RuleDefinition, Severity, Violation};
use std::path::PathBuf;
use syn::spanned::Spanned;
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
            let span = item.span();

            violations.push(Violation {
                rule_id: "CONC-008".into(),
                rule_version: "1.0".into(),
                category: Category::Concurrency,
                severity: self.get_severity("CONC-008", Severity::Deny),
                file: PathBuf::from(self.file_path),
                line: span.start().line,
                column: span.start().column + 1,
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

        // Check if statement is an unhandled async task spawn
        if let Stmt::Expr(expr, _) = stmt {
            if self.is_orphan_async_spawn(expr) {
                let snippet = quote::quote!(#expr).to_string();
                let fp = compute_fingerprint("CONC-002", "1.0", "orphan_spawn", &snippet);
                let span = expr.span();

                violations.push(Violation {
                    rule_id: "CONC-002".into(),
                    rule_version: "1.0".into(),
                    category: Category::Concurrency,
                    severity: self.get_severity("CONC-002", Severity::Deny),
                    file: PathBuf::from(self.file_path),
                    line: span.start().line,
                    column: span.start().column + 1,
                    symbol: "orphan_spawn".into(),
                    message: "Unbounded 'tokio::spawn' executed without storing JoinHandle or attaching CancellationToken.".into(),
                    snippet,
                    remediation: "Store the returned JoinHandle or pass a CancellationToken to enable graceful task shutdown.".into(),
                    fingerprint: fp,
                });
            }
        }
    }

    fn is_orphan_async_spawn(&self, expr: &syn::Expr) -> bool {
        let expr_str = quote::quote!(#expr).to_string();

        if expr_str.contains("token") || expr_str.contains("cancellation") {
            return false;
        }

        let expr_str_lower = expr_str.to_lowercase();

        // Explicitly exclude Bevy ECS / Entity world spawns
        if expr_str_lower.contains("commands . spawn")
            || expr_str_lower.contains("commands.spawn")
            || expr_str_lower.contains("parent . spawn")
            || expr_str_lower.contains("parent.spawn")
            || expr_str_lower.contains("builder . spawn")
            || expr_str_lower.contains("builder.spawn")
            || expr_str_lower.contains("world . spawn")
            || expr_str_lower.contains("world.spawn")
            || expr_str_lower.contains("child_builder . spawn")
            || expr_str_lower.contains("child_builder.spawn")
        {
            return false;
        }

        // Match async runtime task spawns (tokio::spawn, async_std::task::spawn, rt.spawn, runtime.spawn, handle.spawn)
        if expr_str.contains("tokio :: spawn")
            || expr_str.contains("tokio :: task :: spawn")
            || expr_str.contains("async_std :: task :: spawn")
            || expr_str_lower.contains("rt . spawn")
            || expr_str_lower.contains("rt.spawn")
            || expr_str_lower.contains("runtime . spawn")
            || expr_str_lower.contains("runtime.spawn")
            || expr_str_lower.contains("handle . spawn")
            || expr_str_lower.contains("handle.spawn")
            || expr_str_lower.contains("executor . spawn")
            || expr_str_lower.contains("executor.spawn")
        {
            return true;
        }

        // Match .spawn(...) with async block argument
        if (expr_str.contains("spawn (") || expr_str.contains("spawn("))
            && (expr_str.contains("async {")
                || expr_str.contains("async move {")
                || expr_str.contains("async move|")
                || expr_str.contains("async |"))
        {
            return true;
        }

        false
    }

    fn is_rule_enabled(&self, rule_id: &str) -> bool {
        for r in self.rules {
            if r.id == rule_id {
                return r.severity != Severity::Off;
            }
        }
        true
    }

    fn get_severity(&self, rule_id: &str, default: Severity) -> Severity {
        for r in self.rules {
            if r.id == rule_id {
                return r.severity;
            }
        }
        default
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

#[cfg(test)]
mod tests {
    use super::*;

    fn has_rule(violations: &[Violation], rule_id: &str) -> bool {
        for v in violations {
            if v.rule_id == rule_id {
                return true;
            }
        }
        false
    }

    #[test]
    fn test_concurrency_rules_all() {
        let code = r#"
            static mut GLOBAL_VAL: u32 = 0;
            pub fn run() {
                tokio::spawn(async {
                    println!("hello");
                });
            }
        "#;
        let syntax: File = syn::parse_str(code).unwrap();
        let rules = cerberus_domain::BuiltinRuleRegistry::all_rules();
        let checker = ConcurrencyRulesChecker::new("src/lib.rs", &rules);
        let violations = checker.check_file(&syntax);

        assert!(has_rule(&violations, "CONC-008"));
        assert!(has_rule(&violations, "CONC-002"));
    }

    #[test]
    fn test_bevy_commands_spawn_not_flagged_as_conc_002() {
        let code = r#"
            pub fn spawn_entities(mut commands: Commands) {
                commands.spawn((Mesh3d(mesh), Transform::default()));
                parent.spawn((ChildComponent,));
            }
        "#;
        let syntax: File = syn::parse_str(code).unwrap();
        let rules = cerberus_domain::BuiltinRuleRegistry::all_rules();
        let checker = ConcurrencyRulesChecker::new("src/combat/render.rs", &rules);
        let violations = checker.check_file(&syntax);

        assert!(!has_rule(&violations, "CONC-002"), "commands.spawn should not trigger CONC-002");
    }

    #[test]
    fn test_rt_spawn_flagged_as_conc_002() {
        let code = r#"
            pub fn run_async(rt: &tokio::runtime::Runtime) {
                rt.spawn(async move {
                    do_work().await;
                });
            }
        "#;
        let syntax: File = syn::parse_str(code).unwrap();
        let rules = cerberus_domain::BuiltinRuleRegistry::all_rules();
        let checker = ConcurrencyRulesChecker::new("src/db.rs", &rules);
        let violations = checker.check_file(&syntax);

        assert!(has_rule(&violations, "CONC-002"), "rt.spawn without handle should trigger CONC-002");
    }

    #[test]
    fn test_concurrency_rules_fallback_when_empty_rules() {
        let code = r#"
            static mut GLOBAL_VAL: u32 = 0;
            pub fn run() {
                tokio::spawn(async {});
            }
        "#;
        let syntax: File = syn::parse_str(code).unwrap();
        let empty_rules: Vec<RuleDefinition> = Vec::new();
        let checker = ConcurrencyRulesChecker::new("src/lib.rs", &empty_rules);
        let violations = checker.check_file(&syntax);

        assert!(has_rule(&violations, "CONC-008"));
        assert!(has_rule(&violations, "CONC-002"));
    }

    #[test]
    fn test_concurrency_disabled_rule() {
        let code = r#"
            static mut GLOBAL_VAL: u32 = 0;
        "#;
        let syntax: File = syn::parse_str(code).unwrap();
        let rules = vec![RuleDefinition {
            id: "CONC-008".into(),
            title: "static mut".into(),
            version: "1.0".into(),
            category: Category::Concurrency,
            severity: Severity::Off,
            description: "off".into(),
            remediation: "none".into(),
        }];
        let checker = ConcurrencyRulesChecker::new("src/lib.rs", &rules);
        let violations = checker.check_file(&syntax);
        assert!(violations.is_empty());
    }
}
