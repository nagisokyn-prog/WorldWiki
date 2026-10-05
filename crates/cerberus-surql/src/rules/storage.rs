use crate::ast::document::SurqlDocument;
use crate::ast::node::*;
use crate::config::SurqlConfig;
use crate::rules::{create_violation, SurqlRule};
use crate::schema::registry::SchemaRegistry;
use crate::schema::types::SurqlType;
use cerberus_domain::{Category, RuleDefinition, Severity, Violation};
use regex::Regex;

// SURQL-016: Heavy Data Type in Historical/Revision Table
pub struct Surql016HeavyTypeInHistoryTable;
impl SurqlRule for Surql016HeavyTypeInHistoryTable {
    fn id(&self) -> &'static str {
        "SURQL-016"
    }

    fn definition(&self) -> RuleDefinition {
        RuleDefinition {
            id: self.id().into(),
            version: "1.0".into(),
            category: Category::Performance,
            severity: Severity::Deny,
            title: "Heavy Data Type in Historical/Revision Table".into(),
            description: "Storing high-dimensional vectors (array<float>, vector) in revision/history tables causes exponential database size bloat.".into(),
            remediation: "Exclude embeddings from snapshot tables (OMIT embeddings) or keep vector data in active entity tables only.".into(),
        }
    }

    fn check(&self, doc: &SurqlDocument, _schema: &SchemaRegistry, config: &SurqlConfig) -> Vec<Violation> {
        let mut violations = Vec::new();
        let compiled_patterns: Vec<Regex> = config
            .heavy_data
            .historical_table_patterns
            .iter()
            .filter_map(|p| Regex::new(p).ok())
            .collect();

        for stmt in &doc.statements {
            if let Statement::DefineField(field) = stmt {
                let table = &field.table_name;

                // Step 1: Explicit allowlist
                let mut is_history = config.heavy_data.historical_tables.iter().any(|t| t == table);

                // Step 2: Explicit exemptions (override patterns)
                if config.heavy_data.exempt_tables.iter().any(|t| t == table) {
                    is_history = false;
                } else if !is_history {
                    // Step 3: Regex fallback
                    is_history = compiled_patterns.iter().any(|r| r.is_match(table));
                }

                if is_history {
                    let field_type_lower = field.raw_type.to_lowercase();
                    let is_heavy = config.heavy_data.heavy_field_types.iter().any(|ht| {
                        field_type_lower.contains(&ht.to_lowercase())
                    }) || field.field_name.to_lowercase().contains("embedding");

                    if is_heavy {
                        violations.push(create_violation(
                            self,
                            doc,
                            field.span.start_line,
                            field.span.start_col,
                            &format!("{}.{}", field.table_name, field.field_name),
                            &format!("DEFINE FIELD {} ON {} TYPE {}", field.field_name, field.table_name, field.raw_type),
                            Some(&format!("Heavy data type/embeddings field '{}.{}' declared on historical table '{}'.", field.table_name, field.field_name, table)),
                        ));
                    }
                }
            }
        }
        violations
    }
}

// SURQL-017: Unindexed Foreign Key Record Field
pub struct Surql017UnindexedForeignKey;
impl SurqlRule for Surql017UnindexedForeignKey {
    fn id(&self) -> &'static str {
        "SURQL-017"
    }

    fn definition(&self) -> RuleDefinition {
        RuleDefinition {
            id: self.id().into(),
            version: "1.0".into(),
            category: Category::Performance,
            severity: Severity::Warn,
            title: "Unindexed Foreign Key Record Field".into(),
            description: "Field typed as record<target_table> lacks corresponding B-Tree index, degrading relation lookups to full table scans.".into(),
            remediation: "Define B-Tree index on foreign key field: DEFINE INDEX idx_name ON TABLE table FIELDS fk_field.".into(),
        }
    }

    fn check(&self, doc: &SurqlDocument, schema: &SchemaRegistry, _config: &SurqlConfig) -> Vec<Violation> {
        let mut violations = Vec::new();
        for stmt in &doc.statements {
            if let Statement::DefineField(field) = stmt {
                let surql_type = SurqlType::parse(&field.raw_type);
                let is_fk = match &surql_type {
                    SurqlType::Record(_) => true,
                    SurqlType::Option(inner) => matches!(**inner, SurqlType::Record(_)),
                    _ => false,
                };

                if is_fk {
                    let has_index = schema.has_index_on_field(&field.table_name, &field.field_name);
                    if !has_index {
                        violations.push(create_violation(
                            self,
                            doc,
                            field.span.start_line,
                            field.span.start_col,
                            &format!("{}.{}", field.table_name, field.field_name),
                            &format!("DEFINE FIELD {} ON {} TYPE {}", field.field_name, field.table_name, field.raw_type),
                            Some(&format!("Foreign key field '{}.{}' (type record<...>) lacks a B-Tree index.", field.table_name, field.field_name)),
                        ));
                    }
                }
            }
        }
        violations
    }
}

// SURQL-018: Unindexed ORDER BY Sort Field
pub struct Surql018UnindexedOrderBy;
impl SurqlRule for Surql018UnindexedOrderBy {
    fn id(&self) -> &'static str {
        "SURQL-018"
    }

    fn definition(&self) -> RuleDefinition {
        RuleDefinition {
            id: self.id().into(),
            version: "1.0".into(),
            category: Category::Performance,
            severity: Severity::Warn,
            title: "Unindexed ORDER BY Sort Field".into(),
            description: "Sorting by fields that do not participate in any table index causes expensive in-memory sort under load.".into(),
            remediation: "Add B-Tree index covering the sorted fields.".into(),
        }
    }

    fn check(&self, doc: &SurqlDocument, schema: &SchemaRegistry, _config: &SurqlConfig) -> Vec<Violation> {
        let mut violations = Vec::new();
        let field_re = Regex::new(r"([a-zA-Z0-9_]+)").unwrap();

        for stmt in &doc.statements {
            if let Statement::Select(select) = stmt {
                if let (Some(order), Some(from)) = (&select.order_by, &select.from_table) {
                    if !order.contains("search::score") && !order.contains("rand()") {
                        if let Some(first_col_cap) = field_re.captures(order) {
                            if let Some(col) = first_col_cap.get(1) {
                                let col_name = col.as_str();
                                if col_name != "id" && !schema.has_index_on_field(from, col_name) {
                                    violations.push(create_violation(
                                        self,
                                        doc,
                                        select.span.start_line,
                                        select.span.start_col,
                                        from,
                                        &format!("SELECT ... FROM {} ORDER BY {}", from, order),
                                        Some(&format!("ORDER BY on field '{}' of table '{}' is not covered by any index.", col_name, from)),
                                    ));
                                }
                            }
                        }
                    }
                }
            }
        }
        violations
    }
}

// SURQL-019: Array Record Contains instead of Graph Edge
pub struct Surql019ArrayContainsInsteadOfEdge;
impl SurqlRule for Surql019ArrayContainsInsteadOfEdge {
    fn id(&self) -> &'static str {
        "SURQL-019"
    }

    fn definition(&self) -> RuleDefinition {
        RuleDefinition {
            id: self.id().into(),
            version: "1.0".into(),
            category: Category::Architecture,
            severity: Severity::Warn,
            title: "Array Record Contains instead of Graph Edge".into(),
            description: "Checking relations via WHERE array_field CONTAINS id loses graph traversal performance for dynamic many-to-many links.".into(),
            remediation: "Use native graph edges (->relation->) for dynamic many-to-many relationships. Retain array<record<T>> only when strict sequence order is required.".into(),
        }
    }

    fn check(&self, doc: &SurqlDocument, _schema: &SchemaRegistry, _config: &SurqlConfig) -> Vec<Violation> {
        let mut violations = Vec::new();
        let contains_re = Regex::new(r"(?i)([a-zA-Z0-9_]+)\s+CONTAINS\s+(\$[a-zA-Z0-9_]+|[a-zA-Z0-9_]+:[a-zA-Z0-9_]+)").unwrap();

        for stmt in &doc.statements {
            let span = stmt.span();
            let snippet = &doc.source()[span.byte_range.clone()];

            for cap in contains_re.captures_iter(snippet) {
                if let (Some(field), Some(target)) = (cap.get(1), cap.get(2)) {
                    let field_name = field.as_str();
                    if field_name.ends_with("_ids") || field_name.ends_with("ids") || field_name == "participants" {
                        violations.push(create_violation(
                            self,
                            doc,
                            span.start_line,
                            span.start_col,
                            field_name,
                            cap.get(0).map(|m| m.as_str()).unwrap_or(""),
                            Some(&format!("CONTAINS operator on array field '{}' for target '{}'. Consider native graph edges (->rel->) unless array order is required.", field_name, target.as_str())),
                        ));
                    }
                }
            }
        }
        violations
    }
}
