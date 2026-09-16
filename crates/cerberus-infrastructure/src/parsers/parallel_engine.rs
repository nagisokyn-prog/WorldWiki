use arch_guard_domain::Violation;
use arch_guard_ports::{AstEnginePort, AstParserPort, ScannedSourceFile};
use rayon::prelude::*;
use std::sync::Arc;

pub struct ParallelAstEngineAdapter {
    parsers: Vec<Arc<dyn AstParserPort>>,
}

impl ParallelAstEngineAdapter {
    pub fn new(parsers: Vec<Arc<dyn AstParserPort>>) -> Self {
        Self { parsers }
    }
}

impl AstEnginePort for ParallelAstEngineAdapter {
    fn parse_batch(&self, files: &[ScannedSourceFile]) -> (Vec<Violation>, Vec<String>) {
        let results: Vec<Result<Vec<Violation>, String>> = files
            .par_iter()
            .map(|file| {
                for parser in &self.parsers {
                    if parser.can_parse(&file.path) {
                        return parser.parse_file(&file.path, &file.crate_name);
                    }
                }
                Ok(Vec::new())
            })
            .collect();

        let mut violations = Vec::new();
        let mut parse_errors = Vec::new();

        for res in results {
            match res {
                Ok(file_violations) => violations.extend(file_violations),
                Err(err) => parse_errors.push(err),
            }
        }

        (violations, parse_errors)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use arch_guard_domain::{Category, Severity};
    use std::path::{Path, PathBuf};

    struct TestParser;
    impl AstParserPort for TestParser {
        fn can_parse(&self, path: &Path) -> bool {
            path.extension().and_then(|s| s.to_str()) == Some("test")
        }
        fn parse_file(&self, path: &Path, _crate_name: &str) -> Result<Vec<Violation>, String> {
            if path.to_string_lossy().contains("error") {
                return Err("Failed to parse".into());
            }
            Ok(vec![Violation {
                rule_id: "TEST-001".into(),
                rule_version: "1.0".into(),
                category: Category::Architecture,
                severity: Severity::Deny,
                file: path.to_path_buf(),
                line: 1,
                column: 1,
                symbol: "sym".into(),
                snippet: "snip".into(),
                message: "msg".into(),
                remediation: "rem".into(),
                fingerprint: "fp".into(),
            }])
        }
    }

    #[test]
    fn test_parallel_engine_batch_processing() {
        let parsers: Vec<Arc<dyn AstParserPort>> = vec![Arc::new(TestParser)];
        let engine = ParallelAstEngineAdapter::new(parsers);

        let files = vec![
            ScannedSourceFile {
                path: PathBuf::from("file1.test"),
                crate_name: "crate1".into(),
            },
            ScannedSourceFile {
                path: PathBuf::from("file_error.test"),
                crate_name: "crate1".into(),
            },
            ScannedSourceFile {
                path: PathBuf::from("ignored.txt"),
                crate_name: "crate1".into(),
            },
        ];

        let (violations, errors) = engine.parse_batch(&files);
        assert_eq!(violations.len(), 1);
        assert_eq!(errors.len(), 1);
        assert_eq!(violations[0].rule_id, "TEST-001");
    }
}

