use cerberus_domain::{
    compute_fingerprint, Category, Severity, Violation,
};
use std::path::Path;
use syn::visit::{self, Visit};
use syn::{ExprIndex, ExprMethodCall};

pub struct PanicVectorVisitor<'a> {
    pub file_path: &'a Path,
    pub unwrap_count: usize,
    pub expect_count: usize,
    pub index_count: usize,
    pub violations: Vec<Violation>,
}

impl<'a> Default for PanicVectorVisitor<'a> {
    fn default() -> Self {
        Self::new(Path::new(""))
    }
}

impl<'a> PanicVectorVisitor<'a> {
    pub fn new(file_path: &'a Path) -> Self {
        Self {
            file_path,
            unwrap_count: 0,
            expect_count: 0,
            index_count: 0,
            violations: Vec::new(),
        }
    }
}

impl<'a, 'ast> Visit<'ast> for PanicVectorVisitor<'a> {
    fn visit_expr_method_call(&mut self, node: &'ast ExprMethodCall) {
        let method_name = node.method.to_string();
        if method_name == "unwrap" {
            self.unwrap_count += 1;
            let snippet = quote::quote!(#node).to_string();
            let fingerprint = compute_fingerprint("ROB-001", "1.0", "unwrap", &snippet);
            self.violations.push(Violation {
                rule_id: "ROB-001".into(),
                rule_version: "1.0".into(),
                category: Category::Robustness,
                severity: Severity::Warn,
                file: self.file_path.to_path_buf(),
                line: 1,
                column: 1,
                symbol: "unwrap".into(),
                snippet,
                message: "Direct .unwrap() call detected. Can cause runtime panic without I/O error handling.".into(),
                remediation: "Use ? operator, match, if let, or unwrap_or_default() to handle possible None/Err safely.".into(),
                fingerprint,
            });
        } else if method_name == "expect" {
            self.expect_count += 1;
            let snippet = quote::quote!(#node).to_string();
            let fingerprint = compute_fingerprint("ROB-001", "1.0", "expect", &snippet);
            self.violations.push(Violation {
                rule_id: "ROB-001".into(),
                rule_version: "1.0".into(),
                category: Category::Robustness,
                severity: Severity::Warn,
                file: self.file_path.to_path_buf(),
                line: 1,
                column: 1,
                symbol: "expect".into(),
                snippet,
                message: "Direct .expect() call detected. Can trigger panic on runtime failure.".into(),
                remediation: "Handle errors explicitly using Result and propagate via ? operator.".into(),
                fingerprint,
            });
        }

        visit::visit_expr_method_call(self, node);
    }

    fn visit_expr_index(&mut self, node: &'ast ExprIndex) {
        self.index_count += 1;
        let snippet = quote::quote!(#node).to_string();
        let fingerprint = compute_fingerprint("ROB-001", "1.0", "slice_index", &snippet);
        self.violations.push(Violation {
            rule_id: "ROB-001".into(),
            rule_version: "1.0".into(),
            category: Category::Robustness,
            severity: Severity::Warn,
            file: self.file_path.to_path_buf(),
            line: 1,
            column: 1,
            symbol: "slice_index".into(),
            snippet,
            message: "Unchecked slice indexing (vec[i]) risks panic on Out-Of-Bounds access.".into(),
            remediation: "Use .get(i) and handle Option<&T> safely.".into(),
            fingerprint,
        });

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
}
