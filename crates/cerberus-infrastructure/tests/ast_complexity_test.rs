use cerberus_domain::{FileMetrics, PressureWeights, Severity};
use cerberus_infrastructure::{AstComplexityAnalyzer, RustAstComplexityVisitor};
use std::path::PathBuf;

#[test]
fn test_rust_ast_complexity_analysis() {
    let code = r#"
use std::path::Path;
use std::collections::HashMap;

pub fn complex_function(val: i32) -> Result<String, ()> {
    if val > 10 && val < 20 {
        for i in 0..val {
            if i % 2 == 0 {
                println!("Even");
            }
        }
    } else {
        match val {
            1 => println!("One"),
            2 => println!("Two"),
            _ => return Err(()),
        }
    }
    Ok("done".to_string())
}
"#;
    let path = PathBuf::from("src/test.rs");
    let weights = PressureWeights::default();
    let metrics = AstComplexityAnalyzer::analyze_rust_file(code, &path, 0.05, &weights)
        .expect("Should analyze");

    assert_eq!(metrics.functions, 1);
    assert!(metrics.cyclomatic >= 6);
    assert_eq!(metrics.dependencies, 2);
    assert!(metrics.ast_depth >= 4);
    assert!(metrics.pressure_score > 0.0);
}

#[test]
fn test_threshold_violations() {
    let file_metrics = FileMetrics {
        file_path: PathBuf::from("src/god.rs"),
        sloc: 500,
        functions: 30,
        cyclomatic: 40,
        dependencies: 20,
        ast_depth: 10,
        distance_d: 0.9,
        pressure_score: 350.0,
    };

    let violations = AstComplexityAnalyzer::check_thresholds(
        &file_metrics,
        200,
        350,
        150.0,
        300.0,
    );

    assert_eq!(violations.len(), 2);
    assert_eq!(violations[0].rule_id, "ARCH-031");
    assert_eq!(violations[0].severity, Severity::Deny);
    assert_eq!(violations[1].rule_id, "ARCH-030");
    assert_eq!(violations[1].severity, Severity::Deny);

    let warn_file_metrics = FileMetrics {
        file_path: PathBuf::from("src/warn.rs"),
        sloc: 250,
        functions: 10,
        cyclomatic: 15,
        dependencies: 5,
        ast_depth: 4,
        distance_d: 0.2,
        pressure_score: 200.0,
    };

    let warn_violations = AstComplexityAnalyzer::check_thresholds(
        &warn_file_metrics,
        200,
        350,
        150.0,
        300.0,
    );

    assert_eq!(warn_violations.len(), 2);
    assert_eq!(warn_violations[0].rule_id, "ARCH-031");
    assert_eq!(warn_violations[0].severity, Severity::Warn);
    assert_eq!(warn_violations[1].rule_id, "ARCH-030");
    assert_eq!(warn_violations[1].severity, Severity::Warn);
}

#[test]
fn test_ast_complexity_all_constructs_and_errors() {
    let code = r#"
mod inner {
    pub fn inner_fn() {}
}

pub trait MyTrait {
    fn trait_fn(&self);
}

pub struct MyStruct;

impl MyStruct {
    #[test]
    fn ignored_test_fn(&self) {}

    pub fn loop_and_try(&self) -> Result<(), ()> {
        let mut x = 0;
        while x < 5 {
            x += 1;
        }
        loop {
            if x == 10 || x == 20 {
                break;
            }
        }
        let _ = Some(1).ok_or(())?;
        Ok(())
    }
}
"#;
    let path = PathBuf::from("src/all.rs");
    let weights = PressureWeights::default();
    let metrics = AstComplexityAnalyzer::analyze_rust_file(code, &path, 0.0, &weights)
        .expect("Should analyze");

    assert_eq!(metrics.functions, 3);
    assert!(metrics.cyclomatic >= 4);

    let broken_code = "fn broken( { ";
    assert!(AstComplexityAnalyzer::analyze_rust_file(broken_code, &path, 0.0, &weights).is_err());

    let default_visitor = RustAstComplexityVisitor::default();
    assert_eq!(default_visitor.function_count, 0);
}

#[test]
fn test_ast_complexity_test_modules_and_ai_slop_edges() {
    use cerberus_infrastructure::ast::AiSlopVisitor;
    use syn::visit::Visit;

    let code = r#"
#[cfg(test)]
mod tests {
    #[test]
    fn test_something() {
        let s = "hello".to_string();
        let _ = s.clone();
    }
}

#[test]
fn top_level_test() {
    let s = "hello".to_string();
    let _ = s.clone();
    let _ = s.clone();
    let _ = s.clone();
    let _ = s.clone();
    let _ = s.clone();
}

static RWLOCK_GLOBAL: std::sync::RwLock<i32> = std::sync::RwLock::new(0);

lazy_static::lazy_static! {
    static ref PURE_STRING: String = "pure".to_string();
}
"#;
    let path = PathBuf::from("src/test_edges.rs");
    let weights = PressureWeights::default();
    let metrics = AstComplexityAnalyzer::analyze_rust_file(code, &path, 0.0, &weights).unwrap();
    assert_eq!(metrics.functions, 0);

    let parsed = syn::parse_str(code).unwrap();
    let mut slop = AiSlopVisitor::new(&path, "crate");
    slop.visit_file(&parsed);
    assert!(slop.violations.iter().any(|v| v.rule_id == "SLOP-001" && v.symbol == "RWLOCK_GLOBAL"));
    // top_level_test with 5 clones is marked #[test], so it must NOT trigger SLOP-001
    assert!(!slop.violations.iter().any(|v| v.symbol == "top_level_test"));
}
