use std::path::PathBuf;
use syn::visit::{self, Visit};
use syn::{ExprAsync, ExprAwait, ExprCall, ExprClosure, ExprMethodCall, File, ImplItemFn, ItemFn, TraitItemFn};

use super::context::BevyScanContext;
use super::helpers::expr_to_path_string;
use cerberus_domain::{compute_fingerprint, Category, RuleDefinition, Severity, Violation};

pub struct BevyAsyncChecker<'a> {
    file_path: &'a str,
    rules: &'a [RuleDefinition],
    ctx: &'a BevyScanContext,
}

impl<'a> BevyAsyncChecker<'a> {
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
        let mut visitor = AsyncVisitor {
            checker: self,
            violations: &mut violations,
            in_async_fn: false,
            current_fn_name: String::new(),
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

struct AsyncVisitor<'a, 'b> {
    checker: &'a BevyAsyncChecker<'a>,
    violations: &'b mut Vec<Violation>,
    in_async_fn: bool,
    current_fn_name: String,
}

impl<'a, 'b, 'ast> Visit<'ast> for AsyncVisitor<'a, 'b> {
    fn visit_item_fn(&mut self, node: &'ast ItemFn) {
        let prev_async = self.in_async_fn;
        let prev_fn = self.current_fn_name.clone();

        self.in_async_fn = node.sig.asyncness.is_some();
        self.current_fn_name = node.sig.ident.to_string();

        // BEVY-ASYNC-003: Blocking I/O in synchronous Bevy system
        if !self.in_async_fn && self.checker.is_rule_enabled("BEVY-ASYNC-003") {
            let fn_str = quote::quote!(#node).to_string();
            let has_task_pool = fn_str.contains("IoTaskPool")
                || fn_str.contains("AsyncComputeTaskPool")
                || fn_str.contains("crossbeam");

            if !has_task_pool
                && (fn_str.contains("surrealdb")
                    || fn_str.contains("sqlx ::")
                    || fn_str.contains("reqwest :: blocking")
                    || fn_str.contains("reqwest :: Client"))
            {
                let snippet = format!("fn {}(...) {{ I/O call }}", self.current_fn_name);
                let fp = compute_fingerprint("BEVY-ASYNC-003", "1.0", &self.current_fn_name, &snippet);
                self.violations.push(Violation {
                    rule_id: "BEVY-ASYNC-003".into(),
                    rule_version: "1.0".into(),
                    category: Category::BevyAsync,
                    severity: self.checker.get_severity("BEVY-ASYNC-003", Severity::Warn),
                    file: PathBuf::from(self.checker.file_path),
                    line: 1,
                    column: 1,
                    symbol: self.current_fn_name.clone(),
                    message: format!(
                        "Direct synchronous blocking database/network call in system '{}' without channel bridge.",
                        self.current_fn_name
                    ),
                    snippet,
                    remediation: "Spawn I/O task on IoTaskPool and bridge results using crossbeam_channel receiver in system.".into(),
                    fingerprint: fp,
                });
            }
        }

        visit::visit_item_fn(self, node);

        self.in_async_fn = prev_async;
        self.current_fn_name = prev_fn;
    }

    fn visit_impl_item_fn(&mut self, node: &'ast ImplItemFn) {
        let prev_async = self.in_async_fn;
        let prev_fn = self.current_fn_name.clone();

        self.in_async_fn = node.sig.asyncness.is_some();
        self.current_fn_name = node.sig.ident.to_string();

        visit::visit_impl_item_fn(self, node);

        self.in_async_fn = prev_async;
        self.current_fn_name = prev_fn;
    }

    fn visit_trait_item_fn(&mut self, node: &'ast TraitItemFn) {
        let prev_async = self.in_async_fn;
        let prev_fn = self.current_fn_name.clone();

        self.in_async_fn = node.sig.asyncness.is_some();
        self.current_fn_name = node.sig.ident.to_string();

        visit::visit_trait_item_fn(self, node);

        self.in_async_fn = prev_async;
        self.current_fn_name = prev_fn;
    }

    fn visit_expr_async(&mut self, node: &'ast ExprAsync) {
        let prev_async = self.in_async_fn;
        self.in_async_fn = true;

        visit::visit_expr_async(self, node);

        self.in_async_fn = prev_async;
    }

    fn visit_expr_closure(&mut self, node: &'ast ExprClosure) {
        let prev_async = self.in_async_fn;
        if node.asyncness.is_some() {
            self.in_async_fn = true;
        }

        visit::visit_expr_closure(self, node);

        self.in_async_fn = prev_async;
    }

    fn visit_expr_await(&mut self, node: &'ast ExprAwait) {
        // BEVY-ASYNC-001: .await in non-async fn
        if !self.in_async_fn && self.checker.is_rule_enabled("BEVY-ASYNC-001") {
            let snippet = quote::quote!(#node).to_string();
            let fp = compute_fingerprint("BEVY-ASYNC-001", "1.0", "await", &snippet);
            self.violations.push(Violation {
                rule_id: "BEVY-ASYNC-001".into(),
                rule_version: "1.0".into(),
                category: Category::BevyAsync,
                severity: self.checker.get_severity("BEVY-ASYNC-001", Severity::Deny),
                file: PathBuf::from(self.checker.file_path),
                line: 1,
                column: 1,
                symbol: "await".into(),
                message: ".await invoked inside synchronous Bevy system. Bevy systems are synchronous functions.".into(),
                snippet,
                remediation: "Offload async work to IoTaskPool or AsyncComputeTaskPool and poll results synchronously.".into(),
                fingerprint: fp,
            });
        }

        visit::visit_expr_await(self, node);
    }

    fn visit_expr_call(&mut self, node: &'ast ExprCall) {
        let path = expr_to_path_string(&node.func).unwrap_or_default();

        // BEVY-ASYNC-002: Runtime::new() inside system
        let is_non_system_file = self.checker.file_path.contains("infrastructure")
            || self.checker.file_path.contains("domain")
            || self.checker.file_path.contains("ports");

        if !is_non_system_file
            && (path.contains("Runtime::new")
                || path.contains("tokio::runtime::Runtime::new")
                || path.contains("Builder::new_multi_thread")
                || path.contains("Builder::new_current_thread"))
            && self.checker.is_rule_enabled("BEVY-ASYNC-002")
        {
            let snippet = quote::quote!(#node).to_string();
            let fp = compute_fingerprint("BEVY-ASYNC-002", "1.0", "runtime_new", &snippet);
            self.violations.push(Violation {
                rule_id: "BEVY-ASYNC-002".into(),
                rule_version: "1.0".into(),
                category: Category::BevyAsync,
                severity: self.checker.get_severity("BEVY-ASYNC-002", Severity::Deny),
                file: PathBuf::from(self.checker.file_path),
                line: 1,
                column: 1,
                symbol: "Runtime::new".into(),
                message: "Tokio Runtime created inside Bevy system body leaks memory each frame.".into(),
                snippet,
                remediation: "Create Tokio Runtime once in Startup system and store as a Resource.".into(),
                fingerprint: fp,
            });
        }

        visit::visit_expr_call(self, node);
    }

    fn visit_expr_method_call(&mut self, node: &'ast ExprMethodCall) {
        // BEVY-ASYNC-004: Task::detach() without cancellation
        if node.method == "detach" && self.checker.is_rule_enabled("BEVY-ASYNC-004") {
            let recv = &node.receiver;
            let recv_str = quote::quote!(#recv).to_string();
            if recv_str.contains("spawn") || recv_str.contains("task") {
                let snippet = quote::quote!(#node).to_string();
                let fp = compute_fingerprint("BEVY-ASYNC-004", "1.0", "detach", &snippet);
                self.violations.push(Violation {
                    rule_id: "BEVY-ASYNC-004".into(),
                    rule_version: "1.0".into(),
                    category: Category::BevyAsync,
                    severity: self.checker.get_severity("BEVY-ASYNC-004", Severity::Warn),
                    file: PathBuf::from(self.checker.file_path),
                    line: 1,
                    column: 1,
                    symbol: "detach".into(),
                    message: "Task::detach() without CancellationToken or handle tracking risks zombie tasks across state changes.".into(),
                    snippet,
                    remediation: "Store Task<T> in a Component or Resource, or cancel upon State change.".into(),
                    fingerprint: fp,
                });
            }
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
        let checker = BevyAsyncChecker::new("src/async_sys.rs", &rules, &ctx);
        checker.check_file(&file)
    }

    #[test]
    fn test_non_bevy_project_returns_empty() {
        let bad = indoc! {r#"
            fn query_backend() {
                let rt = tokio::runtime::Runtime::new().unwrap();
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
        let checker = BevyAsyncChecker::new("src/async_sys.rs", &rules, &ctx);
        assert!(checker.check_file(&file).is_empty());
    }

    #[test]
    fn test_bevy_async_001_await_in_sync_fn() {
        let bad = indoc! {r#"
            fn sync_system() {
                fetch_data().await;
            }
        "#};
        let violations = check_code(bad);
        assert!(has_rule(&violations, "BEVY-ASYNC-001"));
    }

    #[test]
    fn test_bevy_async_002_runtime_new() {
        let bad = indoc! {r#"
            fn query_backend() {
                let rt = tokio::runtime::Runtime::new().unwrap();
            }
        "#};
        let violations = check_code(bad);
        assert!(has_rule(&violations, "BEVY-ASYNC-002"));
    }

    #[test]
    fn test_bevy_async_003_blocking_io_in_system() {
        let bad = indoc! {r#"
            fn db_fetch_system() {
                let client = reqwest::Client::new();
            }
        "#};
        let violations = check_code(bad);
        assert!(has_rule(&violations, "BEVY-ASYNC-003"));

        let good = indoc! {r#"
            fn db_fetch_system(pool: Res<IoTaskPool>, rx: Res<crossbeam::Receiver<Data>>) {
                if let Ok(data) = rx.try_recv() {
                    println!("{:?}", data);
                }
            }
        "#};
        let violations_good = check_code(good);
        assert!(!has_rule(&violations_good, "BEVY-ASYNC-003"));
    }

    #[test]
    fn test_bevy_async_004_task_detach() {
        let bad = indoc! {r#"
            fn spawn_bg_task() {
                IoTaskPool::get().spawn(async move {
                    do_work().await;
                }).detach();
            }
        "#};
        let violations = check_code(bad);
        assert!(has_rule(&violations, "BEVY-ASYNC-004"));

        let good = indoc! {r#"
            fn spawn_bg_task(mut commands: Commands) {
                let task = IoTaskPool::get().spawn(async move {
                    do_work().await;
                });
                commands.spawn(TaskHolder(task));
            }
        "#};
        let violations_good = check_code(good);
        assert!(!has_rule(&violations_good, "BEVY-ASYNC-004"));
    }

    #[test]
    fn test_bevy_async_002_builder() {
        let bad = indoc! {r#"
            fn query_backend() {
                let rt = tokio::runtime::Builder::new_multi_thread().build().unwrap();
            }
        "#};
        let violations = check_code(bad);
        assert!(has_rule(&violations, "BEVY-ASYNC-002"));
    }

    #[test]
    fn test_bevy_async_disabled_rule() {
        let code = indoc! {r#"
            fn sync_system() {
                fetch_data().await;
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
            id: "BEVY-ASYNC-001".into(),
            title: "await".into(),
            version: "1.0".into(),
            category: Category::BevyAsync,
            severity: Severity::Off,
            description: "await".into(),
            remediation: "Offload".into(),
        }];
        let checker = BevyAsyncChecker::new("src/async_sys.rs", &rules, &ctx);
        let violations = checker.check_file(&file);
        assert!(violations.is_empty());
    }

    #[test]
    fn test_bevy_async_impl_methods_allowed() {
        let code = indoc! {r#"
            struct Repo;
            impl Repo {
                pub async fn save_data(&self) {
                    fetch_data().await;
                }
            }
        "#};
        let violations = check_code(code);
        assert!(!has_rule(&violations, "BEVY-ASYNC-001"), "async fn in impl should not trigger BEVY-ASYNC-001");
    }

    #[test]
    fn test_bevy_async_blocks_allowed() {
        let code = indoc! {r#"
            fn trigger_sync() {
                let _ = async move {
                    fetch_data().await;
                };
            }
        "#};
        let violations = check_code(code);
        assert!(!has_rule(&violations, "BEVY-ASYNC-001"), "await in async block should not trigger BEVY-ASYNC-001");
    }

    #[test]
    fn test_bevy_async_non_bevy_project_empty() {
        let code = indoc! {r#"
            fn sync_system() {
                fetch_data().await;
            }
        "#};
        let file: syn::File = syn::parse_str(code).unwrap();
        let ctx = BevyScanContext {
            is_bevy_project: false,
            bevy_version: None,
            update_systems: std::collections::HashSet::new(),
            startup_systems: std::collections::HashSet::new(),
        };
        let rules: Vec<RuleDefinition> = Vec::new();
        let checker = BevyAsyncChecker::new("src/non_bevy.rs", &rules, &ctx);
        let violations = checker.check_file(&file);
        assert!(violations.is_empty());
    }

    #[test]
    fn test_bevy_async_trait_methods_allowed() {
        let code = indoc! {r#"
            trait RepositoryPort {
                async fn fetch(&self);
            }
        "#};
        let violations = check_code(code);
        assert!(!has_rule(&violations, "BEVY-ASYNC-001"));
    }

    #[test]
    fn test_bevy_async_closure_allowed() {
        let code = indoc! {r#"
            fn test_closure() {
                let _f = async || {
                    fetch_data().await;
                };
            }
        "#};
        let violations = check_code(code);
        assert!(!has_rule(&violations, "BEVY-ASYNC-001"));
    }

    #[test]
    fn test_bevy_async_fallback_when_empty_rules() {
        let bad = indoc! {r#"
            fn sync_system() {
                fetch_data().await;
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
        let checker = BevyAsyncChecker::new("src/async_sys.rs", &rules, &ctx);
        let violations = checker.check_file(&file);
        assert!(has_rule(&violations, "BEVY-ASYNC-001"));
        assert!(has_rule(&violations, "BEVY-ASYNC-002"));
    }
}
