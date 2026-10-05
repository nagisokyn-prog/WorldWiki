use crate::ast::document::SurqlDocument;
use crate::ast::node::*;
use crate::config::SurqlConfig;
use crate::rules::{create_violation, SurqlRule};
use crate::schema::registry::SchemaRegistry;
use cerberus_domain::{Category, RuleDefinition, Severity, Violation};
use regex::Regex;

// SURQL-021: Unranked Predicate Reference in FTS Query
pub struct Surql021UnrankedPredicateSearch;
impl SurqlRule for Surql021UnrankedPredicateSearch {
    fn id(&self) -> &'static str {
        "SURQL-021"
    }

    fn definition(&self) -> RuleDefinition {
        RuleDefinition {
            id: self.id().into(),
            version: "1.0".into(),
            category: Category::Performance,
            severity: Severity::Warn,
            title: "Unranked Predicate Reference in FTS Query".into(),
            description: "Full-text search query specifies predicate reference (@1@) in WHERE without referencing search::score(1) in ORDER BY.".into(),
            remediation: "Add ORDER BY search::score(1) DESC to rank search results by BM25 relevance.".into(),
        }
    }

    fn check(&self, doc: &SurqlDocument, _schema: &SchemaRegistry, config: &SurqlConfig) -> Vec<Violation> {
        if !config.fts.require_score_on_predicate {
            return Vec::new();
        }

        let mut violations = Vec::new();
        let pred_re = Regex::new(r"@([0-9]+)@").unwrap();

        for stmt in &doc.statements {
            if let Statement::Select(select) = stmt {
                if let Some(where_c) = &select.where_clause {
                    for cap in pred_re.captures_iter(where_c) {
                        if let Some(idx_match) = cap.get(1) {
                            let id_str = idx_match.as_str();
                            let score_call = format!("search::score({})", id_str);
                            let has_order_score = select
                                .order_by
                                .as_deref()
                                .map(|o| o.contains(&score_call))
                                .unwrap_or(false);

                            if !has_order_score {
                                violations.push(create_violation(
                                    self,
                                    doc,
                                    select.span.start_line,
                                    select.span.start_col,
                                    &format!("@{}@", id_str),
                                    &format!("WHERE ... @{}@ ...", id_str),
                                    Some(&format!("Full-text search predicate '@{}@' used without 'ORDER BY search::score({}) DESC'.", id_str, id_str)),
                                ));
                            }
                        }
                    }
                }
            }
        }
        violations
    }
}

// SURQL-022: Dangling Search Score Function Reference
pub struct Surql022DanglingScoreFunction;
impl SurqlRule for Surql022DanglingScoreFunction {
    fn id(&self) -> &'static str {
        "SURQL-022"
    }

    fn definition(&self) -> RuleDefinition {
        RuleDefinition {
            id: self.id().into(),
            version: "1.0".into(),
            category: Category::Robustness,
            severity: Severity::Deny,
            title: "Dangling Search Score Function Reference".into(),
            description: "search::score(id) or search::highlight(..., id) called with predicate ID that is not defined in the WHERE clause.".into(),
            remediation: "Ensure the numeric ID passed to search::score(N) matches a predicate (@N@) in the WHERE clause.".into(),
        }
    }

    fn check(&self, doc: &SurqlDocument, _schema: &SchemaRegistry, _config: &SurqlConfig) -> Vec<Violation> {
        let mut violations = Vec::new();
        let score_re = Regex::new(r"search::(score|highlight)\s*\((?:[^,)]*,\s*)*([0-9]+)\)").unwrap();
        let pred_re = Regex::new(r"@([0-9]+)@").unwrap();

        for stmt in &doc.statements {
            let span = stmt.span();
            let snippet = &doc.source()[span.byte_range.clone()];

            let declared_preds: Vec<String> = pred_re
                .captures_iter(snippet)
                .filter_map(|c| c.get(1).map(|m| m.as_str().to_string()))
                .collect();

            for cap in score_re.captures_iter(snippet) {
                if let Some(called_id_match) = cap.get(2) {
                    let called_id = called_id_match.as_str();
                    if !declared_preds.iter().any(|p| p == called_id) {
                        violations.push(create_violation(
                            self,
                            doc,
                            span.start_line,
                            span.start_col,
                            &format!("search::score({})", called_id),
                            cap.get(0).map(|m| m.as_str()).unwrap_or(""),
                            Some(&format!("search::score({}) called, but predicate '@{}@' is not declared in the WHERE clause.", called_id, called_id)),
                        ));
                    }
                }
            }
        }
        violations
    }
}

// SURQL-023: Full-Text Operator on Unindexed Field
pub struct Surql023FtsOperatorOnUnindexedField;
impl SurqlRule for Surql023FtsOperatorOnUnindexedField {
    fn id(&self) -> &'static str {
        "SURQL-023"
    }

    fn definition(&self) -> RuleDefinition {
        RuleDefinition {
            id: self.id().into(),
            version: "1.0".into(),
            category: Category::Robustness,
            severity: Severity::Deny,
            title: "Full-Text Operator on Unindexed Field".into(),
            description: "Using @@ or @id@ operators on field that lacks a DEFINE INDEX ... FULLTEXT ANALYZER ... BM25 index.".into(),
            remediation: "Create FULLTEXT index on field or verify field name.".into(),
        }
    }

    fn check(&self, doc: &SurqlDocument, schema: &SchemaRegistry, _config: &SurqlConfig) -> Vec<Violation> {
        let mut violations = Vec::new();
        let fts_re = Regex::new(r"([a-zA-Z0-9_]+)\s*(?:@@|@[0-9]+@)").unwrap();

        for stmt in &doc.statements {
            if let Statement::Select(select) = stmt {
                if let (Some(where_c), Some(from)) = (&select.where_clause, &select.from_table) {
                    for cap in fts_re.captures_iter(where_c) {
                        if let Some(col) = cap.get(1) {
                            let col_name = col.as_str();
                            if !schema.has_fts_index_on_field(from, col_name) {
                                violations.push(create_violation(
                                    self,
                                    doc,
                                    select.span.start_line,
                                    select.span.start_col,
                                    col_name,
                                    cap.get(0).map(|m| m.as_str()).unwrap_or(""),
                                    Some(&format!("Full-text operator applied to field '{}' of table '{}', which lacks a FULLTEXT BM25 index.", col_name, from)),
                                ));
                            }
                        }
                    }
                }
            }
        }
        violations
    }
}

// SURQL-024: Linear String Scan on Full-Text Indexed Field
pub struct Surql024StringScanOnFtsField;
impl SurqlRule for Surql024StringScanOnFtsField {
    fn id(&self) -> &'static str {
        "SURQL-024"
    }

    fn definition(&self) -> RuleDefinition {
        RuleDefinition {
            id: self.id().into(),
            version: "1.0".into(),
            category: Category::Performance,
            severity: Severity::Warn,
            title: "Linear String Scan on Full-Text Indexed Field".into(),
            description: "Using string::lowercase(...) CONTAINS on a field that already has a FULLTEXT index ignores index acceleration.".into(),
            remediation: "Use @@ or @id@ operator to utilize the full-text BM25 index.".into(),
        }
    }

    fn check(&self, doc: &SurqlDocument, schema: &SchemaRegistry, _config: &SurqlConfig) -> Vec<Violation> {
        let mut violations = Vec::new();
        let scan_re = Regex::new(r"(?i)string::lowercase\s*\(\s*([a-zA-Z0-9_]+)\s*\)\s+CONTAINS").unwrap();

        for stmt in &doc.statements {
            if let Statement::Select(select) = stmt {
                if let (Some(where_c), Some(from)) = (&select.where_clause, &select.from_table) {
                    for cap in scan_re.captures_iter(where_c) {
                        if let Some(col) = cap.get(1) {
                            let col_name = col.as_str();
                            if schema.has_fts_index_on_field(from, col_name) {
                                violations.push(create_violation(
                                    self,
                                    doc,
                                    select.span.start_line,
                                    select.span.start_col,
                                    col_name,
                                    cap.get(0).map(|m| m.as_str()).unwrap_or(""),
                                    Some(&format!("Linear scan (string::lowercase({}) CONTAINS) used on field that has a FULLTEXT index. Use @@ instead.", col_name)),
                                ));
                            }
                        }
                    }
                }
            }
        }
        violations
    }
}

// SURQL-025: Multiple FTS Indexes in OR Predicate
pub struct Surql025MultipleFtsIndexesInOr;
impl SurqlRule for Surql025MultipleFtsIndexesInOr {
    fn id(&self) -> &'static str {
        "SURQL-025"
    }

    fn definition(&self) -> RuleDefinition {
        RuleDefinition {
            id: self.id().into(),
            version: "1.0".into(),
            category: Category::Performance,
            severity: Severity::Warn,
            title: "Multiple FTS Indexes in OR Predicate".into(),
            description: "Evaluating field_a @1@ $q OR field_b @2@ $q across separate indexes triggers multiple index scans and bitmap merges.".into(),
            remediation: "Create single composite FULLTEXT index covering both fields: FIELDS field_a, field_b FULLTEXT ANALYZER ... BM25.".into(),
        }
    }

    fn check(&self, doc: &SurqlDocument, _schema: &SchemaRegistry, config: &SurqlConfig) -> Vec<Violation> {
        if !config.fts.warn_on_split_index_or {
            return Vec::new();
        }

        let mut violations = Vec::new();
        let or_fts_re = Regex::new(r"([a-zA-Z0-9_]+)\s+@[0-9]+@\s+[^\s)]+\s+OR\s+([a-zA-Z0-9_]+)\s+@[0-9]+@").unwrap();

        for stmt in &doc.statements {
            let span = stmt.span();
            let snippet = &doc.source()[span.byte_range.clone()];

            for cap in or_fts_re.captures_iter(snippet) {
                if let (Some(f1), Some(f2)) = (cap.get(1), cap.get(2)) {
                    violations.push(create_violation(
                        self,
                        doc,
                        span.start_line,
                        span.start_col,
                        &format!("{} OR {}", f1.as_str(), f2.as_str()),
                        cap.get(0).map(|m| m.as_str()).unwrap_or(""),
                        Some(&format!("Separate FTS predicates ({} @1@ $q OR {} @2@ $q) incur index split penalty. Merge into single multi-field index.", f1.as_str(), f2.as_str())),
                    ));
                }
            }
        }
        violations
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ast::parser::SurqlParser;
    use std::path::PathBuf;

    #[test]
    fn test_fts_rules_unit() {
        let surql = r#"
            SELECT search::score(2) AS s FROM articles WHERE title @1@ 'rust';
            SELECT * FROM articles WHERE content @@ 'rust';
            SELECT * FROM articles WHERE string::lowercase(title) CONTAINS 'rust';
            SELECT * FROM articles WHERE title @1@ $q OR body @2@ $q ORDER BY search::score(1) DESC, search::score(2) DESC;
        "#;
        let doc = SurqlParser::parse(surql, PathBuf::from("test.surql"));
        let mut schema = SchemaRegistry::new();
        schema.indexes.insert(
            "articles".to_string(),
            vec![
                crate::schema::registry::IndexMeta {
                    name: "idx_art_title".to_string(),
                    table_name: "articles".to_string(),
                    fields: vec!["title".to_string()],
                    is_fulltext: true,
                    analyzer: Some("ru_en".to_string()),
                    is_bm25: true,
                },
                crate::schema::registry::IndexMeta {
                    name: "idx_art_body".to_string(),
                    table_name: "articles".to_string(),
                    fields: vec!["body".to_string()],
                    is_fulltext: true,
                    analyzer: Some("ru_en".to_string()),
                    is_bm25: true,
                },
            ],
        );
        let config = SurqlConfig::default();

        let v21 = Surql021UnrankedPredicateSearch.check(&doc, &schema, &config);
        assert_eq!(v21.len(), 1);
        assert_eq!(v21[0].rule_id, "SURQL-021");

        let v22 = Surql022DanglingScoreFunction.check(&doc, &schema, &config);
        assert_eq!(v22.len(), 1);
        assert_eq!(v22[0].rule_id, "SURQL-022");

        let v23 = Surql023FtsOperatorOnUnindexedField.check(&doc, &schema, &config);
        assert_eq!(v23.len(), 1);
        assert_eq!(v23[0].rule_id, "SURQL-023");

        let v24 = Surql024StringScanOnFtsField.check(&doc, &schema, &config);
        assert_eq!(v24.len(), 1);
        assert_eq!(v24[0].rule_id, "SURQL-024");

        let v25 = Surql025MultipleFtsIndexesInOr.check(&doc, &schema, &config);
        assert_eq!(v25.len(), 1);
        assert_eq!(v25[0].rule_id, "SURQL-025");
    }
}
