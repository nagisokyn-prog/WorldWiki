use cerberus_domain::{compute_fingerprint, Category, RuleDefinition, Severity, Violation};
use std::path::PathBuf;
use syn::visit::Visit;
use syn::{ExprCall, ExprPath, File, ItemStatic, ItemUse};

pub struct TestabilityChecker<'a> {
    file_path: &'a str,
    crate_name: &'a str,
    rules: &'a [RuleDefinition],
}

impl<'a> TestabilityChecker<'a> {
    pub fn new(file_path: &'a str, crate_name: &'a str, rules: &'a [RuleDefinition]) -> Self {
        Self {
            file_path,
            crate_name,
            rules,
        }
    }

    pub fn check_file(&self, syntax: &File) -> Vec<Violation> {
        let mut violations = Vec::new();
        let mut visitor = TestabilityVisitor {
            checker: self,
            violations: &mut violations,
        };
        visitor.visit_file(syntax);
        violations
    }

    fn check_call_path(&self, path_str: &str, violations: &mut Vec<Violation>) {
        let is_domain = self.crate_name.contains("domain") || self.file_path.contains("domain");
        let is_app = self.crate_name.contains("application") || self.file_path.contains("application");

        // TEST-005: Deterministic domain (no SystemTime::now, Uuid::new_v4, Instant::now, thread_rng)
        if is_domain && self.is_rule_enabled("TEST-005") {
            let forbidden = [
                "SystemTime::now",
                "Instant::now",
                "Utc::now",
                "Local::now",
                "Uuid::new_v4",
                "rand::thread_rng",
                "rand::random",
                "thread::sleep",
            ];

            for bad_call in &forbidden {
                if path_str.contains(bad_call) {
                    let snippet = path_str.to_string();
                    let fp = compute_fingerprint("TEST-005", "1.0", "system_call", &snippet);

                    violations.push(Violation {
                        rule_id: "TEST-005".into(),
                        rule_version: "1.0".into(),
                        category: Category::Testability,
                        severity: self.get_severity("TEST-005", Severity::Deny),
                        file: PathBuf::from(self.file_path),
                        line: 1,
                        column: 1,
                        symbol: "system_call".into(),
                        message: format!(
                            "Non-deterministic system call '{}' invoked directly inside domain crate '{}'. Domain logic must remain 100% deterministic and pure.",
                            path_str, self.crate_name
                        ),
                        snippet,
                        remediation: "Inject time/uuid provider port or pass timestamp as an explicit domain method parameter.".into(),
                        fingerprint: fp,
                    });
                    break;
                }
            }
        }

        // TEST-003: Direct concrete adapter instantiation in domain/application
        if (is_domain || is_app)
            && self.is_rule_enabled("TEST-003")
            && (path_str.ends_with("Adapter::new") || path_str.contains("StorageAdapter::new"))
        {
            let snippet = path_str.to_string();
            let fp = compute_fingerprint("TEST-003", "1.0", "adapter_instantiation", &snippet);

            violations.push(Violation {
                rule_id: "TEST-003".into(),
                rule_version: "1.0".into(),
                category: Category::Testability,
                severity: self.get_severity("TEST-003", Severity::Warn),
                file: PathBuf::from(self.file_path),
                line: 1,
                column: 1,
                symbol: "adapter_instantiation".into(),
                message: format!(
                    "Direct concrete adapter instantiation '{}' inside '{}' violates Dependency Inversion Principle.",
                    path_str, self.crate_name
                ),
                snippet,
                remediation: "Accept abstract port interface 'Arc<dyn Port>' via constructor Dependency Injection.".into(),
                fingerprint: fp,
            });
        }
    }

    fn check_use_item(&self, item_use: &ItemUse, violations: &mut Vec<Violation>) {
        let is_domain = self.crate_name.contains("domain") || self.file_path.contains("domain");
        if !is_domain || !self.is_rule_enabled("TEST-005") {
            return;
        }

        let use_str = quote::quote!(#item_use).to_string();
        if use_str.contains("SystemTime") || use_str.contains("Instant") || use_str.contains("chrono :: Utc") {
            let snippet = use_str;
            let fp = compute_fingerprint("TEST-005", "1.0", "time_import", &snippet);

            violations.push(Violation {
                rule_id: "TEST-005".into(),
                rule_version: "1.0".into(),
                category: Category::Testability,
                severity: self.get_severity("TEST-005", Severity::Deny),
                file: PathBuf::from(self.file_path),
                line: 1,
                column: 1,
                symbol: "time_import".into(),
                message: "Direct import of system clock types into domain violates deterministic domain purity.".into(),
                snippet,
                remediation: "Abstract time access through TimePort in ports layer.".into(),
                fingerprint: fp,
            });
        }
    }

    fn check_static_item(&self, item: &ItemStatic, violations: &mut Vec<Violation>) {
        if !self.is_rule_enabled("TEST-002") {
            return;
        }

        // Check if static item contains Mutex, RwLock, or Cell
        let ty_str = quote::quote!(#item.ty).to_string();
        if ty_str.contains("Mutex") || ty_str.contains("RwLock") || ty_str.contains("Cell") {
            let name = item.ident.to_string();
            let snippet = format!("static {}: {}", name, ty_str);
            let fp = compute_fingerprint("TEST-002", "1.0", &name, &snippet);

            violations.push(Violation {
                rule_id: "TEST-002".into(),
                rule_version: "1.0".into(),
                category: Category::Testability,
                severity: self.get_severity("TEST-002", Severity::Deny),
                file: PathBuf::from(self.file_path),
                line: 1,
                column: 1,
                symbol: name,
                message: "Mutable global static state hinders deterministic isolated testing and parallel test execution.".into(),
                snippet,
                remediation: "Eliminate static locks and inject state through struct instances.".into(),
                fingerprint: fp,
            });
        }
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

struct TestabilityVisitor<'a, 'b> {
    checker: &'a TestabilityChecker<'a>,
    violations: &'b mut Vec<Violation>,
}

impl<'a, 'b> Visit<'_> for TestabilityVisitor<'a, 'b> {
    fn visit_expr_call(&mut self, item: &ExprCall) {
        if let syn::Expr::Path(ExprPath { path, .. }) = &*item.func {
            let mut parts = Vec::new();
            for s in &path.segments {
                parts.push(s.ident.to_string());
            }
            let path_str = parts.join("::");
            self.checker.check_call_path(&path_str, self.violations);
        }
        syn::visit::visit_expr_call(self, item);
    }

    fn visit_item_use(&mut self, item: &ItemUse) {
        self.checker.check_use_item(item, self.violations);
        syn::visit::visit_item_use(self, item);
    }

    fn visit_item_static(&mut self, item: &ItemStatic) {
        self.checker.check_static_item(item, self.violations);
        syn::visit::visit_item_static(self, item);
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
    fn test_testability_rules_and_fallbacks() {
        let code = r#"
            use std::time::SystemTime;
            static LOCK: std::sync::Mutex<i32> = std::sync::Mutex::new(0);

            pub fn logic() {
                let _ = SqlAdapter::new();
                let now = SystemTime::now();
            }
        "#;
        let syntax: File = syn::parse_str(code).unwrap();
        let rules = cerberus_domain::BuiltinRuleRegistry::all_rules();
        let checker = TestabilityChecker::new("crates/domain/src/lib.rs", "domain", &rules);
        let violations = checker.check_file(&syntax);

        assert!(has_rule(&violations, "TEST-005"));
        assert!(has_rule(&violations, "TEST-002"));
        assert!(has_rule(&violations, "TEST-003"));

        // Fallback test with empty rules
        let empty_rules: Vec<RuleDefinition> = Vec::new();
        let checker_empty = TestabilityChecker::new("crates/domain/src/lib.rs", "domain", &empty_rules);
        let violations_empty = checker_empty.check_file(&syntax);
        assert!(has_rule(&violations_empty, "TEST-005"));
        assert!(has_rule(&violations_empty, "TEST-002"));
        assert!(has_rule(&violations_empty, "TEST-003"));
    }

    #[test]
    fn test_testability_disabled_rule() {
        let code = r#"
            static LOCK: std::sync::Mutex<i32> = std::sync::Mutex::new(0);
        "#;
        let syntax: File = syn::parse_str(code).unwrap();
        let rules = vec![RuleDefinition {
            id: "TEST-002".into(),
            title: "Mutex".into(),
            version: "1.0".into(),
            category: Category::Testability,
            severity: Severity::Off,
            description: "off".into(),
            remediation: "none".into(),
        }];
        let checker = TestabilityChecker::new("crates/domain/src/lib.rs", "domain", &rules);
        let violations = checker.check_file(&syntax);
        assert!(violations.is_empty());
    }
}
