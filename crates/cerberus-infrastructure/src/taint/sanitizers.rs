use syn::ItemFn;

pub struct TaintSanitizerChecker;

impl TaintSanitizerChecker {
    pub fn is_sanitizer_fn(item_fn: &ItemFn) -> bool {
        // 1. Explicit attribute: #[arch_guard(sanitizes)]
        for attr in &item_fn.attrs {
            let attr_str = quote::quote!(#attr).to_string();
            if attr_str.contains("arch_guard") && attr_str.contains("sanitizes") {
                return true;
            }
        }

        // 2. Known sanitizer function names
        let fn_name = item_fn.sig.ident.to_string();
        if fn_name == "validate_safe_path" || fn_name == "sanitize_filename" || fn_name.starts_with("sanitize_") {
            return true;
        }

        false
    }

    pub fn expr_is_sanitization(expr_str: &str) -> bool {
        expr_str.contains("validate_safe_path")
            || expr_str.contains("sanitize_filename")
            || expr_str.contains("parse :: < u64 >")
            || expr_str.contains("parse :: < i64 >")
            || expr_str.contains("parse :: < usize >")
            || expr_str.contains("parse :: < u32 >")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitizer_checks() {
        assert!(TaintSanitizerChecker::expr_is_sanitization("validate_safe_path(p)"));
        assert!(TaintSanitizerChecker::expr_is_sanitization("input.parse :: < u64 > ()"));
        assert!(!TaintSanitizerChecker::expr_is_sanitization("raw_user_input"));

        let code = r#"
            #[arch_guard(sanitizes)]
            fn custom_clean(x: &str) -> String { x.to_string() }
        "#;
        let item_fn: syn::ItemFn = syn::parse_str(code).unwrap();
        assert!(TaintSanitizerChecker::is_sanitizer_fn(&item_fn));

        let code_named = "fn sanitize_input(x: &str) -> String { x.to_string() }";
        let item_named: syn::ItemFn = syn::parse_str(code_named).unwrap();
        assert!(TaintSanitizerChecker::is_sanitizer_fn(&item_named));

        let code_unsanitized = "fn do_work(x: &str) {}";
        let item_unsanitized: syn::ItemFn = syn::parse_str(code_unsanitized).unwrap();
        assert!(!TaintSanitizerChecker::is_sanitizer_fn(&item_unsanitized));
    }
}

