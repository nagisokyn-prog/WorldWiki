use arch_guard_domain::Violation;
use std::path::Path;
use std::process::Command;
use syn::visit::{self, Visit};
use syn::{ItemMacro, Macro};

pub struct MacroVisitor<'a> {
    pub current_file: &'a Path,
    pub crate_name: &'a str,
    pub violations: Vec<Violation>,
}

impl<'a> MacroVisitor<'a> {
    pub fn new(current_file: &'a Path, crate_name: &'a str) -> Self {
        Self {
            current_file,
            crate_name,
            violations: Vec::new(),
        }
    }

    /// Tier 2: Run nightly cargo rustc -Zunpretty=expanded for deep macro inspection
    pub fn run_cargo_expand(crate_dir: &Path) -> Result<String, String> {
        let output = Command::new("cargo")
            .args(["+nightly", "rustc", "--profile=check", "--", "-Zunpretty=expanded"])
            .current_dir(crate_dir)
            .output()
            .map_err(|e| format!("Failed to run cargo rustc -Zunpretty=expanded: {}", e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("cargo expand failed: {}", stderr));
        }

        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    }
}

impl<'a, 'ast> Visit<'ast> for MacroVisitor<'a> {
    fn visit_item_macro(&mut self, node: &'ast ItemMacro) {
        let _tokens = &node.mac.tokens;
        visit::visit_item_macro(self, node);
    }

    fn visit_macro(&mut self, node: &'ast Macro) {
        let _tokens = &node.tokens;
        visit::visit_macro(self, node);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_macro_visitor_traversal() {
        let code = r#"
            macro_rules! my_macro {
                () => {};
            }
            fn test() {
                println!("hello");
            }
        "#;
        let syntax_tree = syn::parse_file(code).unwrap();
        let mut visitor = MacroVisitor::new(Path::new("test.rs"), "my-crate");
        visitor.visit_file(&syntax_tree);
        assert_eq!(visitor.violations.len(), 0);
    }

    #[test]
    fn test_run_cargo_expand_invalid_dir() {
        let invalid_dir = Path::new("non_existent_crate_path_123");
        let res = MacroVisitor::run_cargo_expand(invalid_dir);
        assert!(res.is_err());

        // Execute on existing directory (returns Err on non-nightly or Ok on nightly)
        let _ = MacroVisitor::run_cargo_expand(Path::new("."));
    }
}


