use std::path::PathBuf;
use syn::visit::{self, Visit};
use syn::{ExprCall, ExprForLoop, ExprMethodCall, File, ItemFn, ItemMod};

use super::context::BevyScanContext;
use super::helpers::expr_to_path_string;
use cerberus_domain::{compute_fingerprint, Category, RuleDefinition, Severity, Violation};

pub struct BevySchedChecker<'a> {
    file_path: &'a str,
    rules: &'a [RuleDefinition],
    ctx: &'a BevyScanContext,
}

impl<'a> BevySchedChecker<'a> {
    pub fn new(file_path: &'a str, rules: &'a [RuleDefinition], ctx: &'a BevyScanContext) -> Self {
        Self {
            file_path,
            rules,
            ctx,
        }
    }

    pub fn check_file(&self, syntax: &File) -> Vec<Violation> {
        if !self.ctx.is_bevy_project {
            return Vec::new();
        }

        let mut violations = Vec::new();
        let mut visitor = SchedVisitor {
            checker: self,
            violations: &mut violations,
            in_test_mod: false,
        };
        visitor.visit_file(syntax);
        violations
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

struct LoopComplexityVisitor {
    heavy_loop_found: bool,
}

impl<'ast> Visit<'ast> for LoopComplexityVisitor {
    fn visit_expr_for_loop(&mut self, for_node: &'ast ExprForLoop) {
        let body = &for_node.body;
        let body_str = quote::quote!(#body).to_string();
        // Heuristic: math operations count or nested loop
        let math_count = body_str.matches('+').count()
            + body_str.matches('*').count()
            + body_str.matches('/').count()
            + body_str.matches("sqrt").count()
            + body_str.matches("sin").count()
            + body_str.matches("cos").count();
        if math_count > 10 || body_str.contains("for ") {
            self.heavy_loop_found = true;
        }
        visit::visit_expr_for_loop(self, for_node);
    }
}

struct SchedVisitor<'a, 'b> {
    checker: &'a BevySchedChecker<'a>,
    violations: &'b mut Vec<Violation>,
    in_test_mod: bool,
}

impl<'a, 'b, 'ast> Visit<'ast> for SchedVisitor<'a, 'b> {
    fn visit_item_mod(&mut self, node: &'ast ItemMod) {
        let prev = self.in_test_mod;
        for a in &node.attrs {
            let s = quote::quote!(#a).to_string();
            if s.contains("cfg") && s.contains("test") {
                self.in_test_mod = true;
                break;
            }
        }
        visit::visit_item_mod(self, node);
        self.in_test_mod = prev;
    }

    fn visit_item_fn(&mut self, node: &'ast ItemFn) {
        if self.in_test_mod {
            visit::visit_item_fn(self, node);
            return;
        }

        let fn_name = node.sig.ident.to_string();
        let fn_str = quote::quote!(#node).to_string();

        // BEVY-SCHED-003: Heavy loop in Update system without TaskPool
        let is_non_system_file = self.checker.file_path.contains("infrastructure")
            || self.checker.file_path.contains("domain")
            || self.checker.file_path.contains("ports");
        if !is_non_system_file && self.checker.is_rule_enabled("BEVY-SCHED-003") {
            let is_update = self.checker.ctx.update_systems.contains(&fn_name)
                || (!self.checker.ctx.startup_systems.contains(&fn_name)
                    && !fn_name.contains("setup")
                    && !fn_name.contains("init")
                    && !fn_name.contains("startup")
                    && !fn_name.contains("generate"));

            let has_task_pool = fn_str.contains("AsyncComputeTaskPool")
                || fn_str.contains("IoTaskPool")
                || fn_str.contains("ComputeTaskPool");

            if is_update && !has_task_pool {
                let mut loop_visitor = LoopComplexityVisitor {
                    heavy_loop_found: false,
                };
                loop_visitor.visit_item_fn(node);

                if loop_visitor.heavy_loop_found {
                    let snippet = format!("fn {}() {{ ... }}", fn_name);
                    let fp = compute_fingerprint("BEVY-SCHED-003", "1.0", &fn_name, &snippet);
                    self.violations.push(Violation {
                        rule_id: "BEVY-SCHED-003".into(),
                        rule_version: "1.0".into(),
                        category: Category::BevySched,
                        severity: self.checker.get_severity("BEVY-SCHED-003", Severity::Warn),
                        file: PathBuf::from(self.checker.file_path),
                        line: 1,
                        column: 1,
                        symbol: fn_name.clone(),
                        message: format!(
                            "Heavy computation loop detected in system '{}' without AsyncComputeTaskPool.",
                            fn_name
                        ),
                        snippet,
                        remediation: "Offload heavy loop with AsyncComputeTaskPool::get().spawn(async move { ... }).".into(),
                        fingerprint: fp,
                    });
                }
            }
        }

        visit::visit_item_fn(self, node);
    }

    fn visit_expr_call(&mut self, node: &'ast ExprCall) {
        if self.in_test_mod {
            visit::visit_expr_call(self, node);
            return;
        }

        let path = expr_to_path_string(&node.func).unwrap_or_default();

        if (path.ends_with("thread::sleep") || path == "sleep")
            && self.checker.is_rule_enabled("BEVY-SCHED-001")
        {
            let snippet = quote::quote!(#node).to_string();
            let fp = compute_fingerprint("BEVY-SCHED-001", "1.0", "thread_sleep", &snippet);
            self.violations.push(Violation {
                rule_id: "BEVY-SCHED-001".into(),
                rule_version: "1.0".into(),
                category: Category::BevySched,
                severity: self.checker.get_severity("BEVY-SCHED-001", Severity::Deny),
                file: PathBuf::from(self.checker.file_path),
                line: 1,
                column: 1,
                symbol: "sleep".into(),
                message: "std::thread::sleep() inside Bevy system blocks the entire game loop and thread pool.".into(),
                snippet,
                remediation: "Use Bevy Timer (Res<Time>) or async tasks instead of blocking thread sleep.".into(),
                fingerprint: fp,
            });
        }

        if (path.ends_with("block_on") || path.contains("tokio::runtime::Runtime::block_on"))
            && self.checker.is_rule_enabled("BEVY-SCHED-002")
        {
            let snippet = quote::quote!(#node).to_string();
            let fp = compute_fingerprint("BEVY-SCHED-002", "1.0", "block_on", &snippet);
            self.violations.push(Violation {
                rule_id: "BEVY-SCHED-002".into(),
                rule_version: "1.0".into(),
                category: Category::BevySched,
                severity: self.checker.get_severity("BEVY-SCHED-002", Severity::Deny),
                file: PathBuf::from(self.checker.file_path),
                line: 1,
                column: 1,
                symbol: "block_on".into(),
                message: "tokio::block_on() inside Bevy system causes nested executor deadlocks.".into(),
                snippet,
                remediation: "Bridge async operations with crossbeam_channel or non-blocking try_recv() in systems.".into(),
                fingerprint: fp,
            });
        }

        let is_non_system_file = self.checker.file_path.contains("infrastructure")
            || self.checker.file_path.contains("domain")
            || self.checker.file_path.contains("ports");

        if !is_non_system_file
            && (path.contains("Runtime::new")
                || path.contains("Builder::new_multi_thread")
                || path.contains("Builder::new_current_thread"))
            && self.checker.is_rule_enabled("BEVY-SCHED-004")
        {
            let snippet = quote::quote!(#node).to_string();
            let fp = compute_fingerprint("BEVY-SCHED-004", "1.0", "runtime_new", &snippet);
            self.violations.push(Violation {
                rule_id: "BEVY-SCHED-004".into(),
                rule_version: "1.0".into(),
                category: Category::BevySched,
                severity: self.checker.get_severity("BEVY-SCHED-004", Severity::Deny),
                file: PathBuf::from(self.checker.file_path),
                line: 1,
                column: 1,
                symbol: "Runtime::new".into(),
                message: "Creating Tokio Runtime inside system body leaks memory and threads every tick.".into(),
                snippet,
                remediation: "Initialize Runtime once during Startup and store as a Bevy Resource.".into(),
                fingerprint: fp,
            });
        }

        visit::visit_expr_call(self, node);
    }

    fn visit_expr_method_call(&mut self, node: &'ast ExprMethodCall) {
        if self.in_test_mod {
            visit::visit_expr_method_call(self, node);
            return;
        }

        if node.method == "block_on" && self.checker.is_rule_enabled("BEVY-SCHED-002") {
            let snippet = quote::quote!(#node).to_string();
            let fp = compute_fingerprint("BEVY-SCHED-002", "1.0", "block_on", &snippet);
            self.violations.push(Violation {
                rule_id: "BEVY-SCHED-002".into(),
                rule_version: "1.0".into(),
                category: Category::BevySched,
                severity: self.checker.get_severity("BEVY-SCHED-002", Severity::Deny),
                file: PathBuf::from(self.checker.file_path),
                line: 1,
                column: 1,
                symbol: "block_on".into(),
                message: "Calling .block_on() inside Bevy system causes nested executor deadlocks.".into(),
                snippet,
                remediation: "Bridge async operations with crossbeam_channel or non-blocking try_recv() in systems.".into(),
                fingerprint: fp,
            });
        }

        visit::visit_expr_method_call(self, node);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use indoc::indoc;

    fn has_rule(violations: &[Violation], rule_id: &str) -> bool {
        for v in violations {
            if v.rule_id == rule_id {
                return true;
            }
        }
        false
    }

    fn check_code(code: &str) -> Vec<Violation> {
        let file: syn::File = syn::parse_str(code).unwrap();
        let ctx = BevyScanContext {
            is_bevy_project: true,
            bevy_version: Some(semver::Version::new(0, 19, 1)),
            update_systems: std::collections::HashSet::new(),
            startup_systems: std::collections::HashSet::new(),
        };
        let rules = cerberus_domain::BuiltinRuleRegistry::all_rules();
        let checker = BevySchedChecker::new("src/systems.rs", &rules, &ctx);
        checker.check_file(&file)
    }

    #[test]
    fn test_non_bevy_project_returns_empty() {
        let bad = indoc! {r#"
            fn tick_system() {
                std::thread::sleep(std::time::Duration::from_millis(100));
            }
        "#};
        let file: syn::File = syn::parse_str(bad).unwrap();
        let ctx = BevyScanContext {
            is_bevy_project: false,
            bevy_version: None,
            update_systems: std::collections::HashSet::new(),
            startup_systems: std::collections::HashSet::new(),
        };
        let rules = cerberus_domain::BuiltinRuleRegistry::all_rules();
        let checker = BevySchedChecker::new("src/systems.rs", &rules, &ctx);
        assert!(checker.check_file(&file).is_empty());
    }

    #[test]
    fn test_test_module_ignored() {
        let code = indoc! {r#"
            #[cfg(test)]
            mod tests {
                fn helper() {
                    std::thread::sleep(std::time::Duration::from_millis(100));
                }
            }
        "#};
        let violations = check_code(code);
        assert!(violations.is_empty());
    }

    #[test]
    fn test_bevy_sched_001_thread_sleep() {
        let bad = indoc! {r#"
            fn tick_system() {
                std::thread::sleep(std::time::Duration::from_millis(100));
            }
        "#};
        let violations = check_code(bad);
        assert!(has_rule(&violations, "BEVY-SCHED-001"));

        let good = indoc! {r#"
            fn normal_system(time: Res<Time>) {
                let dt = time.delta_seconds();
            }
        "#};
        let violations_good = check_code(good);
        assert!(!has_rule(&violations_good, "BEVY-SCHED-001"));
    }

    #[test]
    fn test_bevy_sched_002_block_on() {
        let bad = indoc! {r#"
            fn query_api_system() {
                let rt = get_runtime();
                let res = rt.block_on(async { fetch_data().await });
            }
        "#};
        let violations = check_code(bad);
        assert!(has_rule(&violations, "BEVY-SCHED-002"));
    }

    #[test]
    fn test_bevy_sched_003_heavy_loop() {
        let bad = indoc! {r#"
            fn simulate_particles_update() {
                for i in 0..1000 {
                    for j in 0..1000 {
                        let _ = i * j + (i + j) / 2;
                    }
                }
            }
        "#};
        let violations = check_code(bad);
        assert!(has_rule(&violations, "BEVY-SCHED-003"));

        let good = indoc! {r#"
            fn simulate_particles_update(pool: Res<AsyncComputeTaskPool>) {
                for i in 0..1000 {
                    for j in 0..1000 {
                        let _ = i * j;
                    }
                }
            }
        "#};
        let violations_good = check_code(good);
        assert!(!has_rule(&violations_good, "BEVY-SCHED-003"));
    }

    #[test]
    fn test_bevy_sched_004_runtime_new() {
        let bad = indoc! {r#"
            fn tick_runtime_system() {
                let rt = tokio::runtime::Runtime::new().unwrap();
                let b = tokio::runtime::Builder::new_multi_thread().build().unwrap();
            }
        "#};
        let violations = check_code(bad);
        assert!(has_rule(&violations, "BEVY-SCHED-004"));
    }

    #[test]
    fn test_bevy_sched_002_call_block_on() {
        let bad = indoc! {r#"
            fn sync_system() {
                tokio::runtime::Runtime::block_on(async {});
            }
        "#};
        let violations = check_code(bad);
        assert!(has_rule(&violations, "BEVY-SCHED-002"));
    }

    #[test]
    fn test_bevy_sched_003_setup_heavy_loop_good() {
        let good = indoc! {r#"
            fn setup_world() {
                for i in 0..1000 {
                    for j in 0..1000 {
                        let _ = i * j + (i + j) / 2;
                    }
                }
            }
        "#};
        let violations_good = check_code(good);
        assert!(!has_rule(&violations_good, "BEVY-SCHED-003"));
    }

    #[test]
    fn test_bevy_sched_disabled_rule() {
        let code = indoc! {r#"
            fn tick_system() {
                std::thread::sleep(std::time::Duration::from_millis(100));
            }
        "#};
        let file: syn::File = syn::parse_str(code).unwrap();
        let ctx = BevyScanContext {
            is_bevy_project: true,
            bevy_version: Some(semver::Version::new(0, 19, 1)),
            update_systems: std::collections::HashSet::new(),
            startup_systems: std::collections::HashSet::new(),
        };
        let rules = vec![RuleDefinition {
            id: "BEVY-SCHED-001".into(),
            title: "Thread sleep".into(),
            version: "1.0".into(),
            category: Category::BevySched,
            severity: Severity::Off,
            description: "Thread sleep".into(),
            remediation: "Timer".into(),
        }];
        let checker = BevySchedChecker::new("src/systems.rs", &rules, &ctx);
        let violations = checker.check_file(&file);
        assert!(violations.is_empty());
    }

    #[test]
    fn test_bevy_sched_fallback_when_empty_rules() {
        let bad = indoc! {r#"
            fn tick_system() {
                std::thread::sleep(std::time::Duration::from_millis(100));
                let rt = tokio::runtime::Runtime::new().unwrap();
            }
        "#};
        let file: syn::File = syn::parse_str(bad).unwrap();
        let ctx = BevyScanContext {
            is_bevy_project: true,
            bevy_version: Some(semver::Version::new(0, 19, 1)),
            update_systems: std::collections::HashSet::new(),
            startup_systems: std::collections::HashSet::new(),
        };
        let rules: Vec<RuleDefinition> = Vec::new();
        let checker = BevySchedChecker::new("src/systems.rs", &rules, &ctx);
        let violations = checker.check_file(&file);
        assert!(has_rule(&violations, "BEVY-SCHED-001"));
        assert!(has_rule(&violations, "BEVY-SCHED-004"));
    }
}
