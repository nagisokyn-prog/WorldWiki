use cerberus_domain::{compute_fingerprint, Category, RuleDefinition, Severity, Violation};
use std::path::PathBuf;
use syn::visit::Visit;
use syn::{Expr, File, ItemFn, ItemImpl, Stmt, Visibility};

pub struct ErrorRulesChecker<'a> {
    file_path: &'a str,
    crate_name: &'a str,
    rules: &'a [RuleDefinition],
}

impl<'a> ErrorRulesChecker<'a> {
    pub fn new(file_path: &'a str, crate_name: &'a str, rules: &'a [RuleDefinition]) -> Self {
        Self {
            file_path,
            crate_name,
            rules,
        }
    }

    pub fn check_file(&self, syntax: &File) -> Vec<Violation> {
        let mut violations = Vec::new();
        let mut visitor = ErrorRulesVisitor {
            checker: self,
            violations: &mut violations,
            in_drop_impl: false,
        };
        visitor.visit_file(syntax);
        violations
    }

    fn check_stmt(&self, stmt: &Stmt, in_drop: bool, violations: &mut Vec<Violation>) {
        if let Stmt::Local(local) = stmt {
            // ERR-001: let _ = result;
            if self.is_rule_enabled("ERR-001") {
                if let syn::Pat::Wild(_) = &local.pat {
                    if let Some(init) = &local.init {
                        let expr = &init.expr;
                        let expr_str = quote::quote!(#expr).to_string();
                        // If it contains a method call or function call likely returning Result
                        if expr_str.contains("write")
                            || expr_str.contains("read")
                            || expr_str.contains("send")
                            || expr_str.contains("execute")
                            || expr_str.contains("save")
                            || expr_str.contains("flush")
                        {
                            let snippet = format!("let _ = {}", expr_str);
                            let fp = compute_fingerprint("ERR-001", "1.0", "wildcard_let", &snippet);

                            violations.push(Violation {
                                rule_id: "ERR-001".into(),
                                rule_version: "1.0".into(),
                                category: Category::ErrorHandling,
                                severity: self.get_severity("ERR-001", Severity::Deny),
                                file: PathBuf::from(self.file_path),
                                line: 1,
                                column: 1,
                                symbol: "wildcard_let".into(),
                                message: "Silent error suppression 'let _ = ...' drops critical operation errors.".into(),
                                snippet,
                                remediation: "Handle Result explicitly or propagate error via '?'; log failures before ignoring.".into(),
                                fingerprint: fp,
                            });
                        }
                    }
                }
            }
        }

        // ERR-002: Panic in Drop
        if in_drop && self.is_rule_enabled("ERR-002") {
            let stmt_str = quote::quote!(#stmt).to_string();
            if stmt_str.contains("unwrap (")
                || stmt_str.contains("expect (")
                || stmt_str.contains("panic !")
            {
                let snippet = stmt_str;
                let fp = compute_fingerprint("ERR-002", "1.0", "drop_panic", &snippet);

                violations.push(Violation {
                    rule_id: "ERR-002".into(),
                    rule_version: "1.0".into(),
                    category: Category::ErrorHandling,
                    severity: self.get_severity("ERR-002", Severity::Deny),
                    file: PathBuf::from(self.file_path),
                    line: 1,
                    column: 1,
                    symbol: "drop_panic".into(),
                    message: "Unwrapping or panicking inside 'Drop' implementation risks double-panic and immediate process abort during stack unwinding.".into(),
                    snippet,
                    remediation: "Handle errors gracefully inside Drop by logging via 'tracing::error!' without calling .unwrap() or panic!.".into(),
                    fingerprint: fp,
                });
            }
        }

        // ERR-005: Panic in library target (statement position)
        if self.is_rule_enabled("ERR-005") {
            let is_lib_target = self.crate_name.contains("domain")
                || self.crate_name.contains("ports")
                || self.file_path.ends_with("lib.rs")
                || !self.file_path.contains("bin");

            if is_lib_target {
                if let Stmt::Macro(stmt_macro) = stmt {
                    let macro_name = stmt_macro
                        .mac
                        .path
                        .segments
                        .last()
                        .map(|s| s.ident.to_string())
                        .unwrap_or_default();

                    if macro_name == "panic" || macro_name == "unimplemented" {
                        let snippet = format!("{}!(...)", macro_name);
                        let fp = compute_fingerprint("ERR-005", "1.0", &macro_name, &snippet);

                        violations.push(Violation {
                            rule_id: "ERR-005".into(),
                            rule_version: "1.0".into(),
                            category: Category::ErrorHandling,
                            severity: self.get_severity("ERR-005", Severity::Deny),
                            file: PathBuf::from(self.file_path),
                            line: 1,
                            column: 1,
                            symbol: macro_name,
                            message: "Direct 'panic!' or 'unimplemented!' macro invoked inside library crate. Libraries must return Result<T, E>.".into(),
                            snippet,
                            remediation: "Replace panic!/unimplemented! with structured Result::Err(Error) return value.".into(),
                            fingerprint: fp,
                        });
                    }
                }
            }
        }
    }

    fn check_pub_fn(&self, item_fn: &ItemFn, violations: &mut Vec<Violation>) {
        if !self.is_rule_enabled("ERR-003") {
            return;
        }

        if let Visibility::Public(_) = &item_fn.vis {
            let ret_str = quote::quote!(#item_fn.sig.output).to_string();
            if ret_str.contains("Result <") && ret_str.contains("String >") {
                let name = item_fn.sig.ident.to_string();
                let snippet = format!("pub fn {}(...) -> {}", name, ret_str);
                let fp = compute_fingerprint("ERR-003", "1.0", &name, &snippet);

                violations.push(Violation {
                    rule_id: "ERR-003".into(),
                    rule_version: "1.0".into(),
                    category: Category::ErrorHandling,
                    severity: self.get_severity("ERR-003", Severity::Warn),
                    file: PathBuf::from(self.file_path),
                    line: 1,
                    column: 1,
                    symbol: name,
                    message: "Public function returns untyped 'Result<T, String>'. Untyped string errors break type-safe error matching.".into(),
                    snippet,
                    remediation: "Define domain-specific typed error enum using thiserror (e.g., Result<T, DomainError>).".into(),
                    fingerprint: fp,
                });
            }
        }
    }

    fn check_library_panic(&self, expr: &Expr, violations: &mut Vec<Violation>) {
        if !self.is_rule_enabled("ERR-005") {
            return;
        }

        let is_lib_target = self.crate_name.contains("domain")
            || self.crate_name.contains("ports")
            || self.file_path.ends_with("lib.rs")
            || !self.file_path.contains("bin");
        if !is_lib_target {
            return;
        }

        if let Expr::Macro(expr_macro) = expr {
            let macro_name = expr_macro
                .mac
                .path
                .segments
                .last()
                .map(|s| s.ident.to_string())
                .unwrap_or_default();

            if macro_name == "panic" || macro_name == "unimplemented" {
                let snippet = format!("{}!(...)", macro_name);
                let fp = compute_fingerprint("ERR-005", "1.0", &macro_name, &snippet);

                violations.push(Violation {
                    rule_id: "ERR-005".into(),
                    rule_version: "1.0".into(),
                    category: Category::ErrorHandling,
                    severity: self.get_severity("ERR-005", Severity::Deny),
                    file: PathBuf::from(self.file_path),
                    line: 1,
                    column: 1,
                    symbol: macro_name,
                    message: "Direct 'panic!' or 'unimplemented!' macro invoked inside library crate. Libraries must return Result<T, E>.".into(),
                    snippet,
                    remediation: "Replace panic!/unimplemented! with structured Result::Err(Error) return value.".into(),
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

struct ErrorRulesVisitor<'a, 'b> {
    checker: &'a ErrorRulesChecker<'a>,
    violations: &'b mut Vec<Violation>,
    in_drop_impl: bool,
}

impl<'a, 'b> Visit<'_> for ErrorRulesVisitor<'a, 'b> {
    fn visit_item_impl(&mut self, item: &ItemImpl) {
        let prev_in_drop = self.in_drop_impl;
        if let Some((trait_path, _)) = &item.trait_ {
            let trait_name = quote::quote!(#trait_path).to_string();
            if trait_name.ends_with("Drop") {
                self.in_drop_impl = true;
            }
        }
        syn::visit::visit_item_impl(self, item);
        self.in_drop_impl = prev_in_drop;
    }

    fn visit_stmt(&mut self, item: &Stmt) {
        self.checker
            .check_stmt(item, self.in_drop_impl, self.violations);
        syn::visit::visit_stmt(self, item);
    }

    fn visit_item_fn(&mut self, item: &ItemFn) {
        self.checker.check_pub_fn(item, self.violations);
        syn::visit::visit_item_fn(self, item);
    }

    fn visit_impl_item(&mut self, item: &syn::ImplItem) {
        if let syn::ImplItem::Fn(method) = item {
            if let Visibility::Public(_) = &method.vis {
                let ret_str = quote::quote!(#method.sig.output).to_string();
                if ret_str.contains("Result <") && ret_str.contains("String >") {
                    let name = method.sig.ident.to_string();
                    let snippet = format!("pub fn {}(...) -> {}", name, ret_str);
                    let fp = compute_fingerprint("ERR-003", "1.0", &name, &snippet);

                    self.violations.push(Violation {
                        rule_id: "ERR-003".into(),
                        rule_version: "1.0".into(),
                        category: Category::ErrorHandling,
                        severity: self.checker.get_severity("ERR-003", Severity::Warn),
                        file: PathBuf::from(self.checker.file_path),
                        line: 1,
                        column: 1,
                        symbol: name,
                        message: "Public method returns untyped 'Result<T, String>'.".into(),
                        snippet,
                        remediation: "Define domain-specific typed error enum using thiserror.".into(),
                        fingerprint: fp,
                    });
                }
            }
        }
        syn::visit::visit_impl_item(self, item);
    }

    fn visit_expr(&mut self, item: &Expr) {
        self.checker.check_library_panic(item, self.violations);
        syn::visit::visit_expr(self, item);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_rules_comprehensive() {
        let code = r#"
            pub struct MyStruct;

            impl MyStruct {
                pub fn method_returning_string_err(&self) -> Result<(), String> {
                    Ok(())
                }
            }

            impl Drop for MyStruct {
                fn drop(&mut self) {
                    let _ = std::fs::read("file");
                    let _ = std::fs::write("file", b"data");
                    let _ = self.save();
                    panic!("Drop panic");
                }
            }

            pub fn pub_fn_returning_string_err() -> Result<u32, String> {
                let _ = std::fs::write("out", b"x");
                let x = panic!("expr panic");
                unimplemented!("expr unimpl");
                Ok(1)
            }
        "#;

        let syntax = syn::parse_file(code).unwrap();
        let checker = ErrorRulesChecker::new("src/lib.rs", "worldwiki-domain", &[]);
        let violations = checker.check_file(&syntax);

        assert!(violations.iter().any(|v| v.rule_id == "ERR-001"));
        assert!(violations.iter().any(|v| v.rule_id == "ERR-002"));
        assert!(violations.iter().any(|v| v.rule_id == "ERR-003"));
        assert!(violations.iter().any(|v| v.rule_id == "ERR-005"));
    }
}
