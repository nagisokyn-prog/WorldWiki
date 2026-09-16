use arch_guard_domain::{compute_fingerprint, Category, Severity, Violation};
use std::path::Path;
use syn::visit::{self, Visit};
use syn::{Block, ExprAwait, Local, Pat};

pub struct MutexGuardVisitor<'a> {
    pub current_file: &'a Path,
    pub scope_stack: Vec<Vec<syn::Ident>>,
    pub violations: Vec<Violation>,
}

impl<'a> MutexGuardVisitor<'a> {
    pub fn new(current_file: &'a Path) -> Self {
        Self {
            current_file,
            scope_stack: Vec::new(),
            violations: Vec::new(),
        }
    }
}

impl<'a, 'ast> Visit<'ast> for MutexGuardVisitor<'a> {
    fn visit_block(&mut self, node: &'ast Block) {
        self.scope_stack.push(Vec::new());
        visit::visit_block(self, node);
        self.scope_stack.pop();
    }

    fn visit_local(&mut self, node: &'ast Local) {
        if is_std_mutex_lock_expression(&node.init) {
            if let Pat::Ident(pat_ident) = &node.pat {
                if let Some(current_scope) = self.scope_stack.last_mut() {
                    current_scope.push(pat_ident.ident.clone());
                }
            }
        }
        visit::visit_local(self, node);
    }

    fn visit_expr_await(&mut self, node: &'ast ExprAwait) {
        let active_count: usize = self.scope_stack.iter().map(|s| s.len()).sum();
        if active_count > 0 {
            let snippet = quote::quote!(#node).to_string();
            let symbol = "async_await".to_string();
            let fingerprint = compute_fingerprint("ASYNC-001", "1.0", &symbol, &snippet);

            self.violations.push(Violation {
                rule_id: "ASYNC-001".into(),
                rule_version: "1.0".into(),
                category: Category::Robustness,
                severity: Severity::Deny,
                file: self.current_file.to_path_buf(),
                line: 1,
                column: 1,
                symbol,
                snippet,
                message: "Holding std::sync::MutexGuard across .await point causes Tokio worker starvation and deadlocks".into(),
                remediation: "Use tokio::sync::Mutex or explicitly drop the guard before .await.".into(),
                fingerprint,
            });
        }
        visit::visit_expr_await(self, node);
    }
}

pub fn is_std_mutex_lock_expression(init: &Option<syn::LocalInit>) -> bool {
    if let Some(local_init) = init {
        let mut current_expr: &syn::Expr = &local_init.expr;
        while let syn::Expr::MethodCall(method_call) = current_expr {
            let method_name = method_call.method.to_string();
            if matches!(method_name.as_str(), "lock" | "read" | "write") {
                let receiver = &method_call.receiver;
                let receiver_str = quote::quote!(#receiver).to_string();
                let is_tokio = receiver_str.contains("tokio");
                let expr = &local_init.expr;
                let has_await = quote::quote!(#expr).to_string().contains("await");
                return !is_tokio && !has_await;
            }
            current_expr = &method_call.receiver;
        }
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_async_rules_mutex_guard_across_await_async001() {
        let code_violating = r#"
            async fn foo() {
                let guard = my_mutex.lock().unwrap();
                do_something_async().await;
            }
        "#;
        let file: syn::File = syn::parse_str(code_violating).unwrap();
        let mut visitor = MutexGuardVisitor::new(Path::new("src/async_service.rs"));
        visitor.visit_file(&file);
        assert_eq!(visitor.violations.len(), 1);
        assert_eq!(visitor.violations[0].rule_id, "ASYNC-001");

        let code_clean = r#"
            async fn foo() {
                let guard = tokio_mutex.lock().await;
                do_something_async().await;
            }
        "#;
        let file_clean: syn::File = syn::parse_str(code_clean).unwrap();
        let mut visitor_clean = MutexGuardVisitor::new(Path::new("src/async_service.rs"));
        visitor_clean.visit_file(&file_clean);
        assert!(visitor_clean.violations.is_empty());
    }
}

