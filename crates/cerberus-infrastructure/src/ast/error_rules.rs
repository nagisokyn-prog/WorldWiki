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
                            let fp =
                                compute_fingerprint("ERR-001", "1.0", "wildcard_let", &snippet);

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
            if is_untyped_result_error(&item_fn.sig.output) {
                let name = item_fn.sig.ident.to_string();
                let ret_str = quote::quote!(#item_fn.sig.output).to_string();
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
    fn check_expr(&self, expr: &Expr, violations: &mut Vec<Violation>) {
        self.check_library_panic(expr, violations);

        if let Expr::MethodCall(mc) = expr {
            let method_name = mc.method.to_string();
            let receiver_str = quote::quote!(#mc.receiver).to_string();

            // SDB-009: res.take(0).unwrap_or_default() or res.take(0).unwrap_or(None)
            if self.is_rule_enabled("SDB-009")
                && (method_name == "unwrap_or_default" || method_name == "unwrap_or")
                && (receiver_str.contains("take (") || receiver_str.contains(". take"))
            {
                let snippet = quote::quote!(#mc).to_string();
                let fp = compute_fingerprint("SDB-009", "1.0", "res_take_swallow", &snippet);
                violations.push(Violation {
                    rule_id: "SDB-009".into(),
                    rule_version: "1.0".into(),
                    category: Category::DataIntegrity,
                    severity: self.get_severity("SDB-009", Severity::Deny),
                    file: PathBuf::from(self.file_path),
                    line: 1,
                    column: 1,
                    symbol: "res_take_swallow".into(),
                    message: "SurrealDB Response statement take without error check. res.take(index).unwrap_or_default() suppresses SQL runtime errors.".into(),
                    snippet,
                    remediation: "Propagate statement execution errors with res.take(index)? or map to domain error.".into(),
                    fingerprint: fp,
                });
            }

            // ERR-004: unwrap_or_default() on fallible operations
            if self.is_rule_enabled("ERR-004")
                && (method_name == "unwrap_or_default" || method_name == "unwrap_or")
                && (receiver_str.contains("take (")
                    || receiver_str.contains("query (")
                    || receiver_str.contains("read (")
                    || receiver_str.contains("write (")
                    || receiver_str.contains("send (")
                    || receiver_str.contains("execute (")
                    || receiver_str.contains("from_str (")
                    || receiver_str.contains("from_slice (")
                    || receiver_str.contains("parse (")
                    || receiver_str.contains("lock (")
                    || receiver_str.contains(". save"))
            {
                let snippet = quote::quote!(#mc).to_string();
                let fp = compute_fingerprint("ERR-004", "1.0", "result_swallow", &snippet);
                violations.push(Violation {
                    rule_id: "ERR-004".into(),
                    rule_version: "1.0".into(),
                    category: Category::ErrorHandling,
                    severity: self.get_severity("ERR-004", Severity::Deny),
                    file: PathBuf::from(self.file_path),
                    line: 1,
                    column: 1,
                    symbol: "result_swallow".into(),
                    message: "Calling .unwrap_or_default() / .unwrap_or() on fallible Result suppresses errors into empty default state.".into(),
                    snippet,
                    remediation: "Propagate Result with ? operator or map to explicit domain error enum.".into(),
                    fingerprint: fp,
                });
            }

            // ERR-006: Lossy .ok()? on database/IO
            if self.is_rule_enabled("ERR-006")
                && method_name == "ok"
                && (receiver_str.contains("query (")
                    || receiver_str.contains("take (")
                    || receiver_str.contains("read (")
                    || receiver_str.contains("write (")
                    || receiver_str.contains("select (")
                    || receiver_str.contains("fetch (")
                    || receiver_str.contains("send (")
                    || receiver_str.contains("recv (")
                    || receiver_str.contains("execute ("))
            {
                let snippet = quote::quote!(#mc).to_string();
                let fp = compute_fingerprint("ERR-006", "1.0", "lossy_ok", &snippet);
                violations.push(Violation {
                    rule_id: "ERR-006".into(),
                    rule_version: "1.0".into(),
                    category: Category::ErrorHandling,
                    severity: self.get_severity("ERR-006", Severity::Deny),
                    file: PathBuf::from(self.file_path),
                    line: 1,
                    column: 1,
                    symbol: "lossy_ok".into(),
                    message:
                        "Calling .ok()? on database query erases critical failure reason into None."
                            .into(),
                    snippet,
                    remediation:
                        "Propagate fallible Result with ? instead of erasing context into Option."
                            .into(),
                    fingerprint: fp,
                });
            }
        }
    }

    fn check_item_impl(&self, item: &ItemImpl, violations: &mut Vec<Violation>) {
        if self.is_rule_enabled("ERR-007") {
            if let Some((trait_path, _)) = &item.trait_ {
                let trait_str = quote::quote!(#trait_path).to_string();
                let self_ty = &item.self_ty;
                let self_str = quote::quote!(#self_ty).to_string();
                if (trait_str.contains("From <") || trait_str.starts_with("From<"))
                    && (trait_str.contains("for String") || self_str == "String")
                {
                    let snippet = quote::quote!(#item).to_string();
                    let fp =
                        compute_fingerprint("ERR-007", "1.0", "raw_string_ipc_error", &snippet);
                    violations.push(Violation {
                        rule_id: "ERR-007".into(),
                        rule_version: "1.0".into(),
                        category: Category::ErrorHandling,
                        severity: self.get_severity("ERR-007", Severity::Deny),
                        file: PathBuf::from(self.file_path),
                        line: 1,
                        column: 1,
                        symbol: "raw_string_ipc_error".into(),
                        message: "Converting domain error into raw 'String' for Tauri IPC is prohibited. Use structured IpcError.".into(),
                        snippet,
                        remediation: "Implement structured IpcError { code, message, details } contract instead of raw String conversion.".into(),
                        fingerprint: fp,
                    });
                }
            }
        }
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
        self.checker.check_item_impl(item, self.violations);
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
            if self.checker.is_rule_enabled("ERR-003") {
                if let Visibility::Public(_) = &method.vis {
                    if is_untyped_result_error(&method.sig.output) {
                        let name = method.sig.ident.to_string();
                        let ret_str = quote::quote!(#method.sig.output).to_string();
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
                            remediation: "Define domain-specific typed error enum using thiserror."
                                .into(),
                            fingerprint: fp,
                        });
                    }
                }
            }
        }
        syn::visit::visit_impl_item(self, item);
    }

    fn visit_expr(&mut self, item: &Expr) {
        self.checker.check_expr(item, self.violations);
        syn::visit::visit_expr(self, item);
    }
}

fn is_untyped_result_error(output: &syn::ReturnType) -> bool {
    if let syn::ReturnType::Type(_, ty) = output {
        if let syn::Type::Path(type_path) = ty.as_ref() {
            if let Some(seg) = type_path.path.segments.last() {
                if seg.ident == "Result" {
                    if let syn::PathArguments::AngleBracketed(args) = &seg.arguments {
                        if let Some(syn::GenericArgument::Type(err_ty)) = args.args.iter().nth(1) {
                            return is_string_type(err_ty);
                        }
                    }
                }
            }
        }
    }
    false
}

fn is_string_type(ty: &syn::Type) -> bool {
    if let syn::Type::Path(type_path) = ty {
        if let Some(seg) = type_path.path.segments.last() {
            return seg.ident == "String";
        }
    }
    false
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

    fn count_rule(violations: &[Violation], rule_id: &str) -> usize {
        let mut count = 0;
        for v in violations {
            if v.rule_id == rule_id {
                count += 1;
            }
        }
        count
    }

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

        assert!(has_rule(&violations, "ERR-001"));
        assert!(has_rule(&violations, "ERR-002"));
        assert!(has_rule(&violations, "ERR-003"));
        assert!(has_rule(&violations, "ERR-005"));
    }

    #[test]
    fn test_err_003_no_false_positive_for_typed_errors_with_string_payload() {
        let code = r#"
            pub struct MyService;

            impl MyService {
                pub fn get_string(&self) -> Result<String, MyTypedError> {
                    Ok("ok".to_string())
                }
                pub fn get_option_string(&self) -> Result<Option<String>, MyTypedError> {
                    Ok(Some("ok".to_string()))
                }
                pub fn get_vec_string(&self) -> Result<Vec<String>, MyTypedError> {
                    Ok(vec![])
                }
                pub fn get_map(&self) -> Result<std::collections::HashMap<String, String>, MyTypedError> {
                    Ok(Default::default())
                }
            }

            pub fn standalone_valid_string_result() -> Result<String, MyTypedError> {
                Ok("ok".to_string())
            }
        "#;

        let syntax = syn::parse_file(code).unwrap();
        let checker = ErrorRulesChecker::new("src/lib.rs", "worldwiki-application", &[]);
        let violations = checker.check_file(&syntax);

        assert!(
            violations.is_empty(),
            "Expected 0 violations for typed error with string payload, got: {:?}",
            violations
        );
    }

    #[test]
    fn test_error_rules_disabled_via_severity_off() {
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
                    panic!("Drop panic");
                }
            }

            pub fn pub_fn_returning_string_err() -> Result<u32, String> {
                panic!("expr panic");
            }
        "#;

        let syntax = syn::parse_file(code).unwrap();
        let off_rules = vec![
            RuleDefinition {
                id: "ERR-001".into(),
                version: "1.0".into(),
                category: Category::ErrorHandling,
                severity: Severity::Off,
                title: "Wildcard".into(),
                description: "".into(),
                remediation: "".into(),
            },
            RuleDefinition {
                id: "ERR-002".into(),
                version: "1.0".into(),
                category: Category::ErrorHandling,
                severity: Severity::Off,
                title: "Drop panic".into(),
                description: "".into(),
                remediation: "".into(),
            },
            RuleDefinition {
                id: "ERR-003".into(),
                version: "1.0".into(),
                category: Category::ErrorHandling,
                severity: Severity::Off,
                title: "String err".into(),
                description: "".into(),
                remediation: "".into(),
            },
            RuleDefinition {
                id: "ERR-005".into(),
                version: "1.0".into(),
                category: Category::ErrorHandling,
                severity: Severity::Off,
                title: "Lib panic".into(),
                description: "".into(),
                remediation: "".into(),
            },
        ];

        let checker = ErrorRulesChecker::new("src/lib.rs", "worldwiki-domain", &off_rules);
        let violations = checker.check_file(&syntax);
        assert!(
            violations.is_empty(),
            "Expected 0 violations when all error rules are Off"
        );
    }

    #[test]
    fn test_error_rules_binary_crate_allows_panic() {
        let code = r#"
            fn main() {
                let _ = std::fs::write("test.txt", b"hi");
                panic!("Fatal CLI crash");
            }

            fn helper() {
                unimplemented!("cli unimpl");
            }
        "#;

        let syntax = syn::parse_file(code).unwrap();
        let checker = ErrorRulesChecker::new("src/bin/main.rs", "my-cli-bin", &[]);
        let violations = checker.check_file(&syntax);

        assert!(
            !has_rule(&violations, "ERR-005"),
            "Binary target must not trigger ERR-005 for panic!/unimplemented!"
        );
    }

    #[test]
    fn test_error_rules_private_items_and_diverse_return_types() {
        let code = r#"
            pub struct Foo;

            impl std::fmt::Display for Foo {
                fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                    write!(f, "Foo")
                }
            }

            impl Foo {
                // Private method returning String error is not part of public API
                fn private_method(&self) -> Result<(), String> {
                    Ok(())
                }

                pub fn returns_ref(&self) -> &'static str {
                    "hello"
                }

                pub fn returns_tuple(&self) -> (i32, i32) {
                    (1, 2)
                }

                pub fn returns_unit(&self) {}

                pub fn returns_single_arg_result(&self) -> Result<()> {
                    Ok(())
                }

                pub fn returns_str_error(&self) -> Result<(), &'static str> {
                    Ok(())
                }

                pub fn returns_tuple_error(&self) -> Result<(), (i32, i32)> {
                    Ok(())
                }

                pub fn returns_unit_error(&self) -> Result<(), ()> {
                    Ok(())
                }
            }

            // Private function returning String error
            fn private_fn() -> Result<u32, String> {
                let _uninit;
                let _ = 42;
                Ok(0)
            }
        "#;

        let syntax = syn::parse_file(code).unwrap();
        let checker = ErrorRulesChecker::new("src/lib.rs", "worldwiki-domain", &[]);
        let violations = checker.check_file(&syntax);
        assert!(
            violations.is_empty(),
            "Private methods/functions or non-String error types must not trigger any violations: {:?}",
            violations
        );
    }

    #[test]
    fn test_err_001_and_002_additional_triggers() {
        let code = r#"
            pub struct DropTester;

            impl Drop for DropTester {
                fn drop(&mut self) {
                    let _ = self.send();
                    let _ = self.execute();
                    let _ = self.flush();
                    let opt: Option<i32> = None;
                    let _ = opt.unwrap();
                    let res: Result<i32, ()> = Ok(1);
                    let _ = res.expect("failed");
                }
            }
        "#;

        let syntax = syn::parse_file(code).unwrap();
        let checker = ErrorRulesChecker::new("src/lib.rs", "worldwiki-domain", &[]);
        let violations = checker.check_file(&syntax);

        let err001_count = count_rule(&violations, "ERR-001");
        let err002_count = count_rule(&violations, "ERR-002");

        assert_eq!(
            err001_count, 3,
            "Expected 3 ERR-001 violations (send, execute, flush)"
        );
        assert_eq!(
            err002_count, 2,
            "Expected 2 ERR-002 violations (unwrap, expect)"
        );
    }
}
