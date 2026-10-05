pub mod ddl;
pub mod dml;
pub mod fts;
pub mod functions;
pub mod storage;

use crate::ast::document::SurqlDocument;
use crate::config::SurqlConfig;
use crate::schema::registry::SchemaRegistry;
use cerberus_domain::{compute_location_fingerprint, RuleDefinition, Violation};

pub trait SurqlRule: Send + Sync {
    fn id(&self) -> &'static str;
    fn definition(&self) -> RuleDefinition;
    fn check(
        &self,
        doc: &SurqlDocument,
        schema: &SchemaRegistry,
        config: &SurqlConfig,
    ) -> Vec<Violation>;
}

pub fn create_violation(
    rule: &dyn SurqlRule,
    doc: &SurqlDocument,
    line: usize,
    column: usize,
    symbol: &str,
    snippet: &str,
    custom_msg: Option<&str>,
) -> Violation {
    let def = rule.definition();
    let file_str = doc.file_path().to_string_lossy().to_string();
    let fingerprint =
        compute_location_fingerprint(&def.id, &def.version, &file_str, symbol, snippet);

    let message = if let Some(msg) = custom_msg {
        msg.to_string()
    } else {
        def.description.clone()
    };

    Violation {
        rule_id: def.id,
        rule_version: def.version,
        category: def.category,
        severity: def.severity,
        file: doc.file_path().to_path_buf(),
        line,
        column,
        symbol: symbol.to_string(),
        snippet: snippet.to_string(),
        message,
        remediation: def.remediation,
        fingerprint,
    }
}

pub fn all_rules() -> Vec<Box<dyn SurqlRule>> {
    vec![
        // DML & Mutations
        Box::new(dml::Surql001LoopMutation),
        Box::new(dml::Surql002SelectStar),
        Box::new(dml::Surql003FunctionSelectStar),
        Box::new(dml::Surql004UnboundedFunctionSelect),
        Box::new(dml::Surql005ProjectionSubqueryNPlusOne),
        Box::new(dml::Surql006MutationBlockWithoutTx),
        Box::new(dml::Surql013ScalarAggregateWithoutGroup),
        Box::new(dml::Surql014UnboundedSubqueryIndex),
        Box::new(dml::Surql015MassMutationWithoutWhere),
        // DDL & Typing
        Box::new(ddl::Surql007SchemalessTable),
        Box::new(ddl::Surql008NonIdempotentDdl),
        Box::new(ddl::Surql009NullableRelationEndpoints),
        Box::new(ddl::Surql010ThreeValuedBoolean),
        Box::new(ddl::Surql011NullableCollection),
        Box::new(ddl::Surql012NakedOptionJsonHazard),
        // Storage & Schema Cross-Checks
        Box::new(storage::Surql016HeavyTypeInHistoryTable),
        Box::new(storage::Surql017UnindexedForeignKey),
        Box::new(storage::Surql018UnindexedOrderBy),
        Box::new(storage::Surql019ArrayContainsInsteadOfEdge),
        // Functions
        Box::new(functions::Surql020UntypedFunctionParam),
        Box::new(functions::Surql026DatetimeCoercedToString),
        // FTS & BM25
        Box::new(fts::Surql021UnrankedPredicateSearch),
        Box::new(fts::Surql022DanglingScoreFunction),
        Box::new(fts::Surql023FtsOperatorOnUnindexedField),
        Box::new(fts::Surql024StringScanOnFtsField),
        Box::new(fts::Surql025MultipleFtsIndexesInOr),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;
    use std::path::PathBuf;

    #[test]
    fn test_all_rules_have_unique_ids_and_metadata() {
        let rules = all_rules();
        assert_eq!(rules.len(), 26);

        let mut seen = HashSet::new();
        for rule in &rules {
            let id = rule.id();
            assert!(seen.insert(id), "Duplicate rule ID: {}", id);

            let def = rule.definition();
            assert_eq!(def.id, id);
            assert!(!def.title.is_empty());
            assert!(!def.description.is_empty());
            assert!(!def.remediation.is_empty());
        }
    }

    #[test]
    fn test_create_violation_custom_and_default_msg() {
        let rules = all_rules();
        let rule = &rules[0];
        let doc = SurqlDocument::new("SELECT 1;".to_string(), PathBuf::from("test.surql"), Vec::new());

        let v1 = create_violation(rule.as_ref(), &doc, 1, 1, "test_sym", "SELECT 1;", Some("custom message"));
        assert_eq!(v1.message, "custom message");
        assert_eq!(v1.line, 1);
        assert_eq!(v1.symbol, "test_sym");

        let v2 = create_violation(rule.as_ref(), &doc, 1, 1, "test_sym", "SELECT 1;", None);
        assert_eq!(v2.message, rule.definition().description);
    }
}

