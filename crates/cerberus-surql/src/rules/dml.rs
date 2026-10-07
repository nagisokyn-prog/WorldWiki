use crate::ast::document::SurqlDocument;
use crate::ast::node::*;
use crate::config::SurqlConfig;
use crate::rules::{create_violation, SurqlRule};
use crate::schema::registry::SchemaRegistry;
use cerberus_domain::{Category, RuleDefinition, Severity, Violation};
use regex::Regex;

// SURQL-001: Loop Mutation without Batching in Stored Function
pub struct Surql001LoopMutation;
impl SurqlRule for Surql001LoopMutation {
    fn id(&self) -> &'static str {
        "SURQL-001"
    }

    fn definition(&self) -> RuleDefinition {
        RuleDefinition {
            id: self.id().into(),
            version: "1.0".into(),
            category: Category::Performance,
            severity: Severity::Deny,
            title: "Loop Mutation without Batching in Stored Function".into(),
            description: "FOR loop executing CREATE, RELATE or UPDATE statements inside stored function causes O(N) server round-trips.".into(),
            remediation: "Replace FOR mutation loop with batched INSERT INTO <table> [...] or INSERT RELATION statements.".into(),
        }
    }

    fn check(&self, doc: &SurqlDocument, _schema: &SchemaRegistry, _config: &SurqlConfig) -> Vec<Violation> {
        let mut violations = Vec::new();
        for stmt in &doc.statements {
            if let Statement::DefineFunction(func) = stmt {
                for body_stmt in &func.body_statements {
                    if let Statement::ForLoop(for_loop) = body_stmt {
                        for inner_stmt in &for_loop.body_statements {
                            match inner_stmt {
                                Statement::Relate(_) | Statement::Update(_) | Statement::Delete(_) => {
                                    violations.push(create_violation(
                                        self,
                                        doc,
                                        inner_stmt.span().start_line,
                                        inner_stmt.span().start_col,
                                        &func.name,
                                        &format!("FOR {} IN {} {{ ... }}", for_loop.iterator_var, for_loop.target_iterable),
                                        Some(&format!("Stored function '{}' performs mutating operation inside a FOR loop.", func.name)),
                                    ));
                                }
                                Statement::Other(other) if other.raw.to_uppercase().starts_with("CREATE") => {
                                    violations.push(create_violation(
                                        self,
                                        doc,
                                        other.span.start_line,
                                        other.span.start_col,
                                        &func.name,
                                        &format!("FOR {} IN {} {{ CREATE ... }}", for_loop.iterator_var, for_loop.target_iterable),
                                        Some(&format!("Stored function '{}' performs CREATE inside a FOR loop. Use batch INSERT instead.", func.name)),
                                    ));
                                }
                                _ => {}
                            }
                        }
                    }
                }
            }
        }
        violations
    }
}

// SURQL-002: Unprojected SELECT * in Ad-hoc Query
pub struct Surql002SelectStar;
impl SurqlRule for Surql002SelectStar {
    fn id(&self) -> &'static str {
        "SURQL-002"
    }

    fn definition(&self) -> RuleDefinition {
        RuleDefinition {
            id: self.id().into(),
            version: "1.0".into(),
            category: Category::Performance,
            severity: Severity::Warn,
            title: "Unprojected SELECT * in Ad-hoc Query".into(),
            description: "SELECT * fetches entire record payload without projection, increasing serialization and network bandwidth overhead.".into(),
            remediation: "Specify explicit field projection: SELECT id, field_a, field_b FROM <table>.".into(),
        }
    }

    fn check(&self, doc: &SurqlDocument, _schema: &SchemaRegistry, config: &SurqlConfig) -> Vec<Violation> {
        if !config.dml.warn_on_select_star {
            return Vec::new();
        }

        let mut violations = Vec::new();
        for stmt in &doc.statements {
            if let Statement::Select(select) = stmt {
                if select.is_wildcard {
                    let from = select.from_table.as_deref().unwrap_or("table");
                    if from.starts_with("type::table") {
                        continue;
                    }
                    violations.push(create_violation(
                        self,
                        doc,
                        select.span.start_line,
                        select.span.start_col,
                        from,
                        &format!("SELECT * FROM {}", from),
                        Some(&format!("Ad-hoc query on '{}' uses SELECT * without explicit field projection.", from)),
                    ));
                }
            }
        }
        violations
    }
}

// SURQL-003: SELECT * in Stored Function Hot-Path
pub struct Surql003FunctionSelectStar;
impl SurqlRule for Surql003FunctionSelectStar {
    fn id(&self) -> &'static str {
        "SURQL-003"
    }

    fn definition(&self) -> RuleDefinition {
        RuleDefinition {
            id: self.id().into(),
            version: "1.0".into(),
            category: Category::Performance,
            severity: Severity::Deny,
            title: "SELECT * in Stored Function Hot-Path".into(),
            description: "SELECT * inside DEFINE FUNCTION on server hot-path retrieves all fields including heavy contents/blobs.".into(),
            remediation: "Explicitly project required fields in stored functions.".into(),
        }
    }

    fn check(&self, doc: &SurqlDocument, _schema: &SchemaRegistry, config: &SurqlConfig) -> Vec<Violation> {
        if !config.dml.disallow_select_star_in_functions {
            return Vec::new();
        }

        let mut violations = Vec::new();
        for stmt in &doc.statements {
            if let Statement::DefineFunction(func) = stmt {
                for body_stmt in &func.body_statements {
                    if let Statement::Select(select) = body_stmt {
                        if select.is_wildcard {
                            let from = select.from_table.as_deref().unwrap_or("table");
                            violations.push(create_violation(
                                self,
                                doc,
                                select.span.start_line,
                                select.span.start_col,
                                &func.name,
                                &format!("SELECT * FROM {}", from),
                                Some(&format!("Stored function '{}' executes SELECT * from '{}' on server hot-path.", func.name, from)),
                            ));
                        }
                    }
                }
            }
        }
        violations
    }
}

// SURQL-004: Unbounded Non-Aggregating SELECT in Function
pub struct Surql004UnboundedFunctionSelect;
impl SurqlRule for Surql004UnboundedFunctionSelect {
    fn id(&self) -> &'static str {
        "SURQL-004"
    }

    fn definition(&self) -> RuleDefinition {
        RuleDefinition {
            id: self.id().into(),
            version: "1.0".into(),
            category: Category::Performance,
            severity: Severity::Warn,
            title: "Unbounded Non-Aggregating SELECT in Function".into(),
            description: "Non-aggregating SELECT inside DEFINE FUNCTION without LIMIT clause risks full table scans under load.".into(),
            remediation: "Add explicit LIMIT clause to prevent unbounded query execution.".into(),
        }
    }

    fn check(&self, doc: &SurqlDocument, _schema: &SchemaRegistry, config: &SurqlConfig) -> Vec<Violation> {
        if !config.dml.require_limit_in_functions {
            return Vec::new();
        }

        let mut violations = Vec::new();
        for stmt in &doc.statements {
            if let Statement::DefineFunction(func) = stmt {
                for body_stmt in &func.body_statements {
                    if let Statement::Select(select) = body_stmt {
                        if select.limit.is_none() && select.group_by.is_none() {
                            let from = select.from_table.as_deref().unwrap_or("table");
                            violations.push(create_violation(
                                self,
                                doc,
                                select.span.start_line,
                                select.span.start_col,
                                &func.name,
                                &format!("SELECT ... FROM {}", from),
                                Some(&format!("Stored function '{}' performs non-aggregating query on '{}' without LIMIT clause.", func.name, from)),
                            ));
                        }
                    }
                }
            }
        }
        violations
    }
}

// SURQL-005: Subquery in Projection List (N+1 Hazard)
pub struct Surql005ProjectionSubqueryNPlusOne;
impl SurqlRule for Surql005ProjectionSubqueryNPlusOne {
    fn id(&self) -> &'static str {
        "SURQL-005"
    }

    fn definition(&self) -> RuleDefinition {
        RuleDefinition {
            id: self.id().into(),
            version: "1.0".into(),
            category: Category::Performance,
            severity: Severity::Warn,
            title: "Subquery in Projection List (N+1 Hazard)".into(),
            description: "Subqueries in SELECT projection (e.g. (SELECT ... FROM ->edge)) execute per result row, inducing N+1 query overhead.".into(),
            remediation: "Flatten graph traversal or compute aggregate in separate step with JOIN/GROUP.".into(),
        }
    }

    fn check(&self, doc: &SurqlDocument, _schema: &SchemaRegistry, _config: &SurqlConfig) -> Vec<Violation> {
        let mut violations = Vec::new();
        let sub_re = Regex::new(r"\(\s*SELECT\s+.*?\s+FROM\s+.*?\)\s+AS\s+").unwrap();

        for stmt in &doc.statements {
            let (raw_text, span, symbol) = match stmt {
                Statement::Select(_) => (doc.source(), stmt.span(), "SELECT"),
                Statement::DefineFunction(f) => (doc.source(), stmt.span(), f.name.as_str()),
                _ => continue,
            };

            let snippet = &raw_text[span.byte_range.clone()];
            if sub_re.is_match(snippet) {
                violations.push(create_violation(
                    self,
                    doc,
                    span.start_line,
                    span.start_col,
                    symbol,
                    snippet,
                    Some("Subquery detected in SELECT projection list. This executes per-row (N+1 query hazard)."),
                ));
            }
        }
        violations
    }
}

// SURQL-006: Mutation Sequence without Transaction Boundary
pub struct Surql006MutationBlockWithoutTx;
impl SurqlRule for Surql006MutationBlockWithoutTx {
    fn id(&self) -> &'static str {
        "SURQL-006"
    }

    fn definition(&self) -> RuleDefinition {
        RuleDefinition {
            id: self.id().into(),
            version: "1.0".into(),
            category: Category::DataIntegrity,
            severity: Severity::Deny,
            title: "Mutation Sequence without Transaction Boundary".into(),
            description: "Multiple related mutating statements (e.g. DELETE followed by RELATE/CREATE) without BEGIN TRANSACTION risk partial data corruption on failure.".into(),
            remediation: "Wrap related mutating operations in BEGIN TRANSACTION ... COMMIT blocks.".into(),
        }
    }

    fn check(&self, doc: &SurqlDocument, _schema: &SchemaRegistry, _config: &SurqlConfig) -> Vec<Violation> {
        let mut violations = Vec::new();
        for stmt in &doc.statements {
            if let Statement::DefineFunction(func) = stmt {
                let mut mutation_count = 0;
                let mut has_transaction = false;

                for body_stmt in &func.body_statements {
                    match body_stmt {
                        Statement::Transaction(_) => has_transaction = true,
                        Statement::Delete(_) | Statement::Relate(_) | Statement::Update(_) | Statement::ForLoop(_) => {
                            mutation_count += 1;
                        }
                        Statement::Other(o) => {
                            let upper = o.raw.to_uppercase();
                            if upper.starts_with("CREATE") || upper.starts_with("INSERT") || upper.starts_with("DELETE") || upper.starts_with("UPDATE") || upper.starts_with("RELATE") {
                                mutation_count += 1;
                            }
                        }
                        _ => {}
                    }
                }

                let func_snippet = &doc.source()[func.span.byte_range.clone()];
                let func_upper = func_snippet.to_uppercase();
                if func_upper.contains("BEGIN TRANSACTION") || func_upper.contains("BEGIN;") || func_upper.contains("BEGIN\n") {
                    has_transaction = true;
                }

                if mutation_count >= 2 && !has_transaction {
                    violations.push(create_violation(
                        self,
                        doc,
                        func.span.start_line,
                        func.span.start_col,
                        &func.name,
                        &format!("DEFINE FUNCTION {}", func.name),
                        Some(&format!("Stored function '{}' executes {} mutation operations without a transaction boundary (BEGIN TRANSACTION ... COMMIT).", func.name, mutation_count)),
                    ));
                }
            }
        }
        violations
    }
}

// SURQL-013: Scalar Context for Aggregate Function
pub struct Surql013ScalarAggregateWithoutGroup;
impl SurqlRule for Surql013ScalarAggregateWithoutGroup {
    fn id(&self) -> &'static str {
        "SURQL-013"
    }

    fn definition(&self) -> RuleDefinition {
        RuleDefinition {
            id: self.id().into(),
            version: "1.0".into(),
            category: Category::Robustness,
            severity: Severity::Deny,
            title: "Scalar Context for Aggregate Function".into(),
            description: "Aggregate functions (math::sum, math::max, count) in SELECT without GROUP BY or GROUP ALL return unaggregated per-row outputs.".into(),
            remediation: "Add GROUP BY or GROUP ALL clause to aggregate across entire table or partition.".into(),
        }
    }

    fn check(&self, doc: &SurqlDocument, _schema: &SchemaRegistry, _config: &SurqlConfig) -> Vec<Violation> {
        let mut violations = Vec::new();
        let agg_re = Regex::new(r"^(math::(sum|mean|max|min|median|mode|stddev|variance)|count)$").unwrap();

        for stmt in &doc.statements {
            let select_nodes: Vec<&SelectNode> = match stmt {
                Statement::Select(s) => vec![s],
                Statement::DefineFunction(f) => f
                    .body_statements
                    .iter()
                    .filter_map(|bs| if let Statement::Select(s) = bs { Some(s) } else { None })
                    .collect(),
                _ => Vec::new(),
            };

            for select in select_nodes {
                if select.group_by.is_none() {
                    for call in &select.function_calls {
                        if agg_re.is_match(&call.name) {
                            violations.push(create_violation(
                                self,
                                doc,
                                select.span.start_line,
                                select.span.start_col,
                                &call.name,
                                &call.full_call,
                                Some(&format!("Aggregate function '{}()' called in SELECT projection without GROUP BY or GROUP ALL.", call.name)),
                            ));
                        }
                    }
                }
            }
        }
        violations
    }
}

// SURQL-014: Unbounded Subquery First Index Access
pub struct Surql014UnboundedSubqueryIndex;
impl SurqlRule for Surql014UnboundedSubqueryIndex {
    fn id(&self) -> &'static str {
        "SURQL-014"
    }

    fn definition(&self) -> RuleDefinition {
        RuleDefinition {
            id: self.id().into(),
            version: "1.0".into(),
            category: Category::Performance,
            severity: Severity::Warn,
            title: "Unbounded Subquery First Index Access".into(),
            description: "Accessing [0] on subquery (SELECT ...)[0] without LIMIT 1 forces the database to materialize all matching rows before indexing.".into(),
            remediation: "Add LIMIT 1 inside the inner subquery: (SELECT ... LIMIT 1)[0].".into(),
        }
    }

    fn check(&self, doc: &SurqlDocument, _schema: &SchemaRegistry, _config: &SurqlConfig) -> Vec<Violation> {
        let mut violations = Vec::new();
        let subquery_0_re = Regex::new(r"\(\s*SELECT\b([^)]+?)\)\s*\[\s*0\s*\]").unwrap();

        for stmt in &doc.statements {
            let span = stmt.span();
            let snippet = &doc.source()[span.byte_range.clone()];

            for cap in subquery_0_re.captures_iter(snippet) {
                if let Some(inner) = cap.get(1) {
                    let inner_str = inner.as_str().to_uppercase();
                    if !inner_str.contains("LIMIT 1") {
                        violations.push(create_violation(
                            self,
                            doc,
                            span.start_line,
                            span.start_col,
                            "[0]",
                            cap.get(0).map(|m| m.as_str()).unwrap_or(""),
                            Some("Subquery index '[0]' applied without 'LIMIT 1' inside subquery. This materializes full selection before indexing."),
                        ));
                    }
                }
            }
        }
        violations
    }
}

// SURQL-015: Mass Mutation without WHERE Clause
pub struct Surql015MassMutationWithoutWhere;
impl SurqlRule for Surql015MassMutationWithoutWhere {
    fn id(&self) -> &'static str {
        "SURQL-015"
    }

    fn definition(&self) -> RuleDefinition {
        RuleDefinition {
            id: self.id().into(),
            version: "1.0".into(),
            category: Category::DataIntegrity,
            severity: Severity::Deny,
            title: "Mass Mutation without WHERE Clause".into(),
            description: "UPDATE <table> or DELETE <table> without WHERE clause mutates the entire table.".into(),
            remediation: "Provide explicit WHERE clause or target single record by ID (UPDATE table:record_id).".into(),
        }
    }

    fn check(&self, doc: &SurqlDocument, _schema: &SchemaRegistry, _config: &SurqlConfig) -> Vec<Violation> {
        let mut violations = Vec::new();
        for stmt in &doc.statements {
            match stmt {
                Statement::Update(u) if !u.is_record_id && !u.has_where => {
                    violations.push(create_violation(
                        self,
                        doc,
                        u.span.start_line,
                        u.span.start_col,
                        &u.target,
                        &format!("UPDATE {}", u.target),
                        Some(&format!("Mass UPDATE statement on table '{}' without WHERE clause.", u.target)),
                    ));
                }
                Statement::Delete(d) if !d.is_record_id && !d.has_where => {
                    violations.push(create_violation(
                        self,
                        doc,
                        d.span.start_line,
                        d.span.start_col,
                        &d.target,
                        &format!("DELETE {}", d.target),
                        Some(&format!("Mass DELETE statement on table '{}' without WHERE clause.", d.target)),
                    ));
                }
                _ => {}
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
    fn test_dml_rules_unit() {
        let surql = r#"
            DEFINE FUNCTION OVERWRITE fn::bad() {
                FOR $x IN $arr {
                    DELETE orders;
                };
                RETURN (SELECT * FROM orders);
                RETURN (SELECT id FROM orders);
            };
            SELECT * FROM orders;
            SELECT id, (SELECT id FROM ->orders) AS o FROM users;
            UPDATE users SET a = 1;
            DELETE users;
            SELECT count() FROM users;
            SELECT (SELECT id FROM users)[0] AS u FROM orders;
        "#;
        let doc = SurqlParser::parse(surql, PathBuf::from("test.surql"));
        let schema = SchemaRegistry::new();
        let config = SurqlConfig::default();

        let v01 = Surql001LoopMutation.check(&doc, &schema, &config);
        assert!(!v01.is_empty());

        let v02 = Surql002SelectStar.check(&doc, &schema, &config);
        assert!(!v02.is_empty());

        let v03 = Surql003FunctionSelectStar.check(&doc, &schema, &config);
        assert!(!v03.is_empty());

        let v04 = Surql004UnboundedFunctionSelect.check(&doc, &schema, &config);
        assert!(!v04.is_empty());

        let v05 = Surql005ProjectionSubqueryNPlusOne.check(&doc, &schema, &config);
        assert!(!v05.is_empty());

        let v13 = Surql013ScalarAggregateWithoutGroup.check(&doc, &schema, &config);
        assert!(!v13.is_empty());

        let v14 = Surql014UnboundedSubqueryIndex.check(&doc, &schema, &config);
        assert!(!v14.is_empty());

        let v15 = Surql015MassMutationWithoutWhere.check(&doc, &schema, &config);
        assert_eq!(v15.len(), 2);
    }
}
