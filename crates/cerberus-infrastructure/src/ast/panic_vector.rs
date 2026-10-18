use cerberus_domain::{
    compute_fingerprint, Category, Severity, Violation,
};
use std::path::Path;
use syn::spanned::Spanned;
use syn::visit::{self, Visit};
use syn::{ExprIndex, ExprMethodCall, ItemFn, ItemMod};

pub struct PanicVectorVisitor<'a> {
    pub file_path: &'a Path,
    pub unwrap_count: usize,
    pub expect_count: usize,
    pub index_count: usize,
    pub violations: Vec<Violation>,
    in_test_context: bool,
    is_test_file: bool,
}

impl<'a> Default for PanicVectorVisitor<'a> {
    fn default() -> Self {
        Self::new(Path::new(""))
    }
}

impl<'a> PanicVectorVisitor<'a> {
    pub fn new(file_path: &'a Path) -> Self {
        let path_str = file_path.to_string_lossy().to_lowercase();
        let is_test_file = path_str.contains("/tests/")
            || path_str.contains("\\tests\\")
            || path_str.contains("/benches/")
            || path_str.contains("\\benches\\")
            || path_str.ends_with("_test.rs")
            || path_str.ends_with("_spec.rs");

        Self {
            file_path,
            unwrap_count: 0,
            expect_count: 0,
            index_count: 0,
            violations: Vec::new(),
            in_test_context: false,
            is_test_file,
        }
    }

    fn is_test_attribute(attr: &syn::Attribute) -> bool {
        let path = attr.path();
        if path.is_ident("test") {
            return true;
        }
        let full = quote::quote!(#path).to_string();
        if full.contains("test") {
            return true;
        }
        if full.contains("cfg") {
            let meta = quote::quote!(#attr).to_string();
            if meta.contains("test") {
                return true;
            }
        }
        false
    }
}

impl<'a, 'ast> Visit<'ast> for PanicVectorVisitor<'a> {
    fn visit_item_mod(&mut self, node: &'ast ItemMod) {
        let prev = self.in_test_context;
        if node.attrs.iter().any(Self::is_test_attribute) {
            self.in_test_context = true;
        }
        visit::visit_item_mod(self, node);
        self.in_test_context = prev;
    }

    fn visit_item_fn(&mut self, node: &'ast ItemFn) {
        let prev = self.in_test_context;
        if node.attrs.iter().any(Self::is_test_attribute) {
            self.in_test_context = true;
        }
        visit::visit_item_fn(self, node);
        self.in_test_context = prev;
    }

    fn visit_expr_method_call(&mut self, node: &'ast ExprMethodCall) {
        let method_name = node.method.to_string();
        if method_name == "unwrap" {
            self.unwrap_count += 1;
            if !self.is_test_file && !self.in_test_context {
                let snippet = quote::quote!(#node).to_string();
                let fingerprint = compute_fingerprint("ROB-001", "1.0", "unwrap", &snippet);
                let span = node.span();
                self.violations.push(Violation {
                    rule_id: "ROB-001".into(),
                    rule_version: "1.0".into(),
                    category: Category::Robustness,
                    severity: Severity::Warn,
                    file: self.file_path.to_path_buf(),
                    line: span.start().line,
                    column: span.start().column + 1,
                    symbol: "unwrap".into(),
                    snippet,
                    message: "Direct .unwrap() call detected. Can cause runtime panic without I/O error handling.".into(),
                    remediation: "Use ? operator, match, if let, or unwrap_or_default() to handle possible None/Err safely.".into(),
                    fingerprint,
                });
            }
        } else if method_name == "expect" {
            self.expect_count += 1;
            if !self.is_test_file && !self.in_test_context {
                let snippet = quote::quote!(#node).to_string();
                let fingerprint = compute_fingerprint("ROB-001", "1.0", "expect", &snippet);
                let span = node.span();
                self.violations.push(Violation {
                    rule_id: "ROB-001".into(),
                    rule_version: "1.0".into(),
                    category: Category::Robustness,
                    severity: Severity::Warn,
                    file: self.file_path.to_path_buf(),
                    line: span.start().line,
                    column: span.start().column + 1,
                    symbol: "expect".into(),
                    snippet,
                    message: "Direct .expect() call detected. Can trigger panic on runtime failure.".into(),
                    remediation: "Handle errors explicitly using Result and propagate via ? operator.".into(),
                    fingerprint,
                });
            }
        }

        visit::visit_expr_method_call(self, node);
    }

    fn visit_expr_index(&mut self, node: &'ast ExprIndex) {
        self.index_count += 1;
        if !self.is_test_file && !self.in_test_context {
            let snippet = quote::quote!(#node).to_string();
            let fingerprint = compute_fingerprint("ROB-001", "1.0", "slice_index", &snippet);
            let span = node.span();
            self.violations.push(Violation {
                rule_id: "ROB-001".into(),
                rule_version: "1.0".into(),
                category: Category::Robustness,
                severity: Severity::Warn,
                file: self.file_path.to_path_buf(),
                line: span.start().line,
                column: span.start().column + 1,
                symbol: "slice_index".into(),
                snippet,
                message: "Unchecked slice indexing (vec[i]) risks panic on Out-Of-Bounds access.".into(),
                remediation: "Use .get(i) and handle Option<&T> safely.".into(),
                fingerprint,
            });
        }

        visit::visit_expr_index(self, node);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use syn::parse_str;

    #[test]
    fn test_panic_vector_detector() {
        let code = r#"
pub fn risky(v: Vec<i32>, opt: Option<String>) {
    let first = v[0];
    let val = opt.unwrap();
    let res: Result<i32, ()> = Ok(1);
    let num = res.expect("must be ok");
}
"#;
        let parsed = parse_str(code).unwrap();
        let path = Path::new("src/risky.rs");
        let mut visitor = PanicVectorVisitor::new(path);
        visitor.visit_file(&parsed);

        assert_eq!(visitor.unwrap_count, 1);
        assert_eq!(visitor.expect_count, 1);
        assert_eq!(visitor.index_count, 1);
        assert_eq!(visitor.violations.len(), 3);
        assert!(visitor.violations.iter().all(|v| v.rule_id == "ROB-001"));

        // Test Default
        let def = PanicVectorVisitor::default();
        assert_eq!(def.unwrap_count, 0);
    }

    #[test]
    fn test_panic_vector_skips_test_functions_and_cfg_test() {
        let code = r#"
#[test]
fn unit_test() {
    let opt: Option<i32> = Some(1);
    let val = opt.unwrap();
}

#[cfg(test)]
mod tests {
    fn inner() {
        let opt: Option<i32> = Some(1);
        let val = opt.expect("test");
    }
}
"#;
        let parsed = parse_str(code).unwrap();
        let path = Path::new("src/module.rs");
        let mut visitor = PanicVectorVisitor::new(path);
        visitor.visit_file(&parsed);

        // Counts are collected for metrics, but violations are 0!
        assert_eq!(visitor.unwrap_count, 1);
        assert_eq!(visitor.expect_count, 1);
        assert_eq!(visitor.violations.len(), 0);
    }
}
