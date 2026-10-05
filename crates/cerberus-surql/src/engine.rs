use crate::ast::document::SurqlDocument;
use crate::ast::parser::SurqlParser;
use crate::bridge::rust_scanner::RustSurqlInlineScanner;
use crate::config::SurqlConfig;
use crate::rules::{all_rules, SurqlRule};
use crate::schema::collector::SchemaCollector;
use crate::schema::registry::SchemaRegistry;
use cerberus_domain::Violation;
use cerberus_ports::{SurqlLinterPort, SurqlScanRequest, SurqlScanResult};
use rayon::prelude::*;
use std::fs;
use std::path::Path;

pub struct SurqlEngine {
    config: SurqlConfig,
    rules: Vec<Box<dyn SurqlRule>>,
}

impl SurqlEngine {
    pub fn new(config: SurqlConfig) -> Self {
        Self {
            config,
            rules: all_rules(),
        }
    }

    pub fn with_default_config() -> Self {
        Self::new(SurqlConfig::default())
    }

    pub fn inspect_document(&self, doc: &SurqlDocument, schema: &SchemaRegistry) -> Vec<Violation> {
        let mut violations = Vec::new();
        for rule in &self.rules {
            violations.extend(rule.check(doc, schema, &self.config));
        }
        violations
    }
}

impl Default for SurqlEngine {
    fn default() -> Self {
        Self::with_default_config()
    }
}

impl SurqlLinterPort for SurqlEngine {
    fn scan(&self, request: &SurqlScanRequest) -> Result<SurqlScanResult, String> {
        if !self.config.enabled {
            return Ok(SurqlScanResult::default());
        }

        // 1. Read and parse all .surql documents
        let docs: Vec<SurqlDocument> = request
            .surql_files
            .par_iter()
            .filter_map(|p| {
                if let Ok(content) = fs::read_to_string(p) {
                    Some(SurqlParser::parse(&content, p.clone()))
                } else {
                    None
                }
            })
            .collect();

        // 2. Pass 1: Build combined schema registry
        let schema = SchemaCollector::collect(&docs);

        // 3. Pass 2: Audit all .surql documents
        let mut all_violations: Vec<Violation> = docs
            .par_iter()
            .flat_map(|doc| self.inspect_document(doc, &schema))
            .collect();

        // 4. Scan inline SURQL queries in Rust files
        let rust_scanner = RustSurqlInlineScanner::new(&self.rules, &schema, &self.config);
        let rust_violations: Vec<Violation> = request
            .rust_files
            .par_iter()
            .flat_map(|rf| rust_scanner.scan_file(rf))
            .collect();

        all_violations.extend(rust_violations);

        Ok(SurqlScanResult {
            violations: all_violations,
            scanned_surql_count: request.surql_files.len(),
            scanned_rust_count: request.rust_files.len(),
        })
    }

    fn scan_surql_content(&self, content: &str, file_path: &Path) -> Result<Vec<Violation>, String> {
        let doc = SurqlParser::parse(content, file_path.to_path_buf());
        let schema = SchemaCollector::collect(std::slice::from_ref(&doc));
        Ok(self.inspect_document(&doc, &schema))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn test_engine_default_and_disabled() {
        let engine_default = SurqlEngine::default();
        assert!(engine_default.config.enabled);

        let cfg = SurqlConfig {
            enabled: false,
            ..Default::default()
        };
        let engine_disabled = SurqlEngine::new(cfg);

        let req = SurqlScanRequest {
            surql_files: vec![Path::new("dummy.surql").to_path_buf()],
            rust_files: vec![],
            workspace_root: Path::new(".").to_path_buf(),
        };
        let res = engine_disabled.scan(&req).unwrap();
        assert!(res.violations.is_empty());
        assert_eq!(res.scanned_surql_count, 0);
    }

    #[test]
    fn test_engine_scan_missing_and_existing_files() {
        let dir = tempdir().unwrap();
        let surql_file = dir.path().join("users.surql");
        fs::write(&surql_file, "SELECT * FROM users;").unwrap();
        let missing_file = dir.path().join("missing.surql");

        let engine = SurqlEngine::with_default_config();
        let req = SurqlScanRequest {
            surql_files: vec![surql_file, missing_file],
            rust_files: vec![],
            workspace_root: dir.path().to_path_buf(),
        };

        let res = engine.scan(&req).unwrap();
        assert_eq!(res.scanned_surql_count, 2);
        assert!(res.violations.iter().any(|v| v.rule_id == "SURQL-002"));
    }
}

