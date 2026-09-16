use cerberus_domain::{
    compute_fingerprint, Category, Severity, Violation,
};
use std::path::Path;
use syn::visit::{self, Visit};
use syn::{ExprMethodCall, ItemFn, ItemMacro, ItemStatic};

pub struct AiSlopVisitor<'a> {
    pub file_path: &'a Path,
    pub crate_name: &'a str,
    pub current_fn_clones: usize,
    pub violations: Vec<Violation>,
}

impl<'a> Default for AiSlopVisitor<'a> {
    fn default() -> Self {
        Self::new(Path::new(""), "")
    }
}

impl<'a> AiSlopVisitor<'a> {
    pub fn new(file_path: &'a Path, crate_name: &'a str) -> Self {
        Self {
            file_path,
            crate_name,
            current_fn_clones: 0,
            violations: Vec::new(),
        }
    }
}

impl<'a, 'ast> Visit<'ast> for AiSlopVisitor<'a> {
    fn visit_item_fn(&mut self, node: &'ast ItemFn) {
        let prev_clones = self.current_fn_clones;
        self.current_fn_clones = 0;

        visit::visit_item_fn(self, node);

        if self.current_fn_clones >= 4 {
            let fn_name = node.sig.ident.to_string();
            let snippet = format!("fn {}() ({} .clone() calls)", fn_name, self.current_fn_clones);
            let fingerprint = compute_fingerprint("SLOP-001", "1.0", &fn_name, &snippet);
            self.violations.push(Violation {
                rule_id: "SLOP-001".into(),
                rule_version: "1.0".into(),
                category: Category::Convention,
                severity: Severity::Warn,
                file: self.file_path.to_path_buf(),
                line: 1,
                column: 1,
                symbol: fn_name,
                snippet,
                message: format!(
                    "High .clone() density detected ({} clones in a single function). Possible borrow checker circumvention (Memory Tax).",
                    self.current_fn_clones
                ),
                remediation: "Pass references (&T, &str, Cow) or borrow data instead of defensive cloning.".into(),
                fingerprint,
            });
        }

        self.current_fn_clones = prev_clones;
    }

    fn visit_expr_method_call(&mut self, node: &'ast ExprMethodCall) {
        if node.method == "clone" {
            self.current_fn_clones += 1;
        }
        visit::visit_expr_method_call(self, node);
    }

    fn visit_item_static(&mut self, node: &'ast ItemStatic) {
        let type_str = quote::quote!(#node.ty).to_string();
        if type_str.contains("Mutex") || type_str.contains("RwLock") {
            let ident = node.ident.to_string();
            let snippet = quote::quote!(#node).to_string();
            let fingerprint = compute_fingerprint("SLOP-001", "1.0", &ident, &snippet);
            self.violations.push(Violation {
                rule_id: "SLOP-001".into(),
                rule_version: "1.0".into(),
                category: Category::Convention,
                severity: Severity::Warn,
                file: self.file_path.to_path_buf(),
                line: 1,
                column: 1,
                symbol: ident,
                snippet,
                message: "Global mutable lock (static Mutex/RwLock) detected. Risk of hidden side-effects and deadlocks.".into(),
                remediation: "Pass shared state explicitly via dependency injection or service structs.".into(),
                fingerprint,
            });
        }
        visit::visit_item_static(self, node);
    }

    fn visit_item_macro(&mut self, node: &'ast ItemMacro) {
        let mac_name = node.mac.path.segments.last().map(|s| s.ident.to_string()).unwrap_or_default();
        if mac_name == "lazy_static" {
            let tokens_str = node.mac.tokens.to_string();
            if tokens_str.contains("Mutex") || tokens_str.contains("RwLock") {
                let snippet = "lazy_static! { ... Mutex/RwLock ... }".to_string();
                let fingerprint = compute_fingerprint("SLOP-001", "1.0", "lazy_static", &snippet);
                self.violations.push(Violation {
                    rule_id: "SLOP-001".into(),
                    rule_version: "1.0".into(),
                    category: Category::Convention,
                    severity: Severity::Warn,
                    file: self.file_path.to_path_buf(),
                    line: 1,
                    column: 1,
                    symbol: "lazy_static".into(),
                    snippet,
                    message: "Global mutable state in lazy_static! (Mutex/RwLock) detected.".into(),
                    remediation: "Encapsulate state inside application services rather than global statics.".into(),
                    fingerprint,
                });
            }
        }
        visit::visit_item_macro(self, node);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use syn::parse_str;

    #[test]
    fn test_ai_slop_clone_density_and_globals() {
        let code = r#"
pub fn excessive_cloning(s: String) -> String {
    let a = s.clone();
    let b = a.clone();
    let c = b.clone();
    let d = c.clone();
    d
}

pub static GLOBAL_LOCK: std::sync::Mutex<i32> = std::sync::Mutex::new(0);

lazy_static::lazy_static! {
    static ref SHARED: std::sync::RwLock<Vec<u8>> = std::sync::RwLock::new(Vec::new());
}
"#;
        let parsed = parse_str(code).unwrap();
        let path = Path::new("src/slop.rs");
        let mut visitor = AiSlopVisitor::new(path, "domain");
        visitor.visit_file(&parsed);

        assert_eq!(visitor.violations.len(), 3);
        assert!(visitor.violations.iter().all(|v| v.rule_id == "SLOP-001"));

        // Default visitor test
        let def = AiSlopVisitor::default();
        assert_eq!(def.current_fn_clones, 0);
    }
}
