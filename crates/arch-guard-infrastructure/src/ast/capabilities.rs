use arch_guard_domain::{compute_fingerprint, Category, Severity, Violation};
use std::path::Path;
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
        let func_str = quote::quote!(#node.func).to_string();

        if self.is_build_rs {
            // Build.rs sandbox checks
            if func_str.contains("Command::new") {
                let call_str = quote::quote!(#node).to_string();
                if call_str.contains("curl") || call_str.contains("wget") || call_str.contains("nc") {
                    let snippet = call_str;
                    let symbol = "build_rs_command".to_string();
                    let fingerprint = compute_fingerprint("SEC-001", "1.0", &symbol, &snippet);

                    self.violations.push(Violation {
                        rule_id: "SEC-001".into(),
                        rule_version: "1.0".into(),
                        category: Category::Security,
                        severity: Severity::Deny,
                        file: self.current_file.to_path_buf(),
                        line: 1,
                        column: 1,
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
