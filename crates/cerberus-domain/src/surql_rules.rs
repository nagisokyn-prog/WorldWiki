use crate::rules::{Category, RuleDefinition, Severity};

#[inline]
fn r(id: &str, cat: Category, sev: Severity, title: &str, desc: &str, rem: &str) -> RuleDefinition {
    RuleDefinition {
        id: id.into(),
        version: "1.0".into(),
        category: cat,
        severity: sev,
        title: title.into(),
        description: desc.into(),
        remediation: rem.into(),
    }
}

pub fn all_surql_rules() -> Vec<RuleDefinition> {
    vec![
        // DML & Mutations
        r(
            "SURQL-001",
            Category::Performance,
            Severity::Deny,
            "Loop Mutation without Batching in Stored Function",
            "FOR loop executing CREATE, RELATE or UPDATE statements inside stored function causes O(N) server round-trips.",
            "Replace FOR mutation loop with batched INSERT INTO <table> [...] or INSERT RELATION statements.",
        ),
        r(
            "SURQL-002",
            Category::Performance,
            Severity::Warn,
            "Unprojected SELECT * in Ad-hoc Query",
            "SELECT * fetches entire record payload without projection, increasing serialization and network bandwidth overhead.",
            "Specify explicit field projection: SELECT id, field_a, field_b FROM <table>.",
        ),
        r(
            "SURQL-003",
            Category::Performance,
            Severity::Deny,
            "SELECT * in Stored Function Hot-Path",
            "SELECT * inside DEFINE FUNCTION on server hot-path retrieves all fields including heavy contents/blobs.",
            "Explicitly project required fields in stored functions.",
        ),
        r(
            "SURQL-004",
            Category::Performance,
            Severity::Warn,
            "Unbounded Non-Aggregating SELECT in Function",
            "Non-aggregating SELECT inside DEFINE FUNCTION without LIMIT clause risks full table scans under load.",
            "Add explicit LIMIT clause to prevent unbounded query execution.",
        ),
        r(
            "SURQL-005",
            Category::Performance,
            Severity::Warn,
            "Subquery in Projection List (N+1 Hazard)",
            "Subqueries in SELECT projection (e.g. (SELECT ... FROM ->edge)) execute per result row, inducing N+1 query overhead.",
            "Flatten graph traversal or compute aggregate in separate step with JOIN/GROUP.",
        ),
        r(
            "SURQL-006",
            Category::DataIntegrity,
            Severity::Deny,
            "Mutation Sequence without Transaction Boundary",
            "Multiple related mutating statements (e.g. DELETE followed by RELATE/CREATE) without BEGIN TRANSACTION risk partial data corruption on failure.",
            "Wrap related mutating operations in BEGIN TRANSACTION ... COMMIT blocks.",
        ),

        // DDL & Typing
        r(
            "SURQL-007",
            Category::DataIntegrity,
            Severity::Deny,
            "Schemaless Table Definition under Strict Schema",
            "DEFINE TABLE without SCHEMAFULL disables server-side type enforcement under strict schema rules.",
            "Add SCHEMAFULL to DEFINE TABLE statement, or configure strict_schema = false in .cerberus.toml for dynamic log buffers.",
        ),
        r(
            "SURQL-008",
            Category::Convention,
            Severity::Deny,
            "Non-Idempotent DDL Statement",
            "DEFINE TABLE, FIELD, INDEX, EVENT or FUNCTION without OVERWRITE breaks repeated schema migration applications.",
            "Add OVERWRITE keyword to all DEFINE statements.",
        ),
        r(
            "SURQL-009",
            Category::Architecture,
            Severity::Deny,
            "Nullable Relation Endpoints in Graph Edge",
            "System fields 'in' and 'out' on TYPE RELATION tables cannot be nullable or optional. Graph edges require valid source and destination records.",
            "Define 'in' and 'out' fields with exact record types: TYPE record<from_table> and TYPE record<to_table> without | null.",
        ),
        r(
            "SURQL-010",
            Category::Robustness,
            Severity::Deny,
            "Three-Valued Boolean Logic Hazard",
            "TYPE bool | null introduces SQL three-valued logic (TRUE, FALSE, UNKNOWN/NULL) and causes silent misses in WHERE flag != true.",
            "Use TYPE bool DEFAULT false or TYPE option<bool> for uninitialized flags without explicit NULL.",
        ),
        r(
            "SURQL-011",
            Category::Convention,
            Severity::Deny,
            "Nullable Collection Anti-Pattern",
            "Collections (array, object) typed as | null break client iteration. Collections must default to empty containers instead of null.",
            "Use TYPE array<T> DEFAULT [] or TYPE object DEFAULT {}.",
        ),
        r(
            "SURQL-012",
            Category::Robustness,
            Severity::Warn,
            "Naked option<T> JSON Compatibility Hazard",
            "TYPE option<T> accepts missing fields (NONE), but rejects explicit JSON null. Clients sending { \"field\": null } will encounter type errors.",
            "Use TYPE option<T | null> if clients may send null, or ensure API clients omit null keys.",
        ),

        // Aggregates & Mutation Hazards
        r(
            "SURQL-013",
            Category::Robustness,
            Severity::Deny,
            "Scalar Context for Aggregate Function",
            "Aggregate functions (math::sum, math::max, count) in SELECT without GROUP BY or GROUP ALL return unaggregated per-row outputs.",
            "Add GROUP BY or GROUP ALL clause to aggregate across entire table or partition.",
        ),
        r(
            "SURQL-014",
            Category::Performance,
            Severity::Warn,
            "Unbounded Subquery First Index Access",
            "Accessing [0] on subquery (SELECT ...)[0] without LIMIT 1 forces the database to materialize all matching rows before indexing.",
            "Add LIMIT 1 inside the inner subquery: (SELECT ... LIMIT 1)[0].",
        ),
        r(
            "SURQL-015",
            Category::DataIntegrity,
            Severity::Deny,
            "Mass Mutation without WHERE Clause",
            "UPDATE <table> or DELETE <table> without WHERE clause mutates the entire table.",
            "Provide explicit WHERE clause or target single record by ID (UPDATE table:record_id).",
        ),

        // Storage & Schema Cross-Checks
        r(
            "SURQL-016",
            Category::Performance,
            Severity::Deny,
            "Heavy Data Type in Historical/Revision Table",
            "Storing high-dimensional vectors (array<float>, vector) in revision/history tables causes exponential database size bloat.",
            "Exclude embeddings from snapshot tables (OMIT embeddings) or keep vector data in active entity tables only.",
        ),
        r(
            "SURQL-017",
            Category::Performance,
            Severity::Warn,
            "Unindexed Foreign Key Record Field",
            "Field typed as record<target_table> lacks corresponding B-Tree index, degrading relation lookups to full table scans.",
            "Define B-Tree index on foreign key field: DEFINE INDEX idx_name ON TABLE table FIELDS fk_field.",
        ),
        r(
            "SURQL-018",
            Category::Performance,
            Severity::Warn,
            "Unindexed ORDER BY Sort Field",
            "Sorting by fields that do not participate in any table index causes expensive in-memory sort under load.",
            "Add B-Tree index covering the sorted fields.",
        ),
        r(
            "SURQL-019",
            Category::Architecture,
            Severity::Warn,
            "Array Record Contains instead of Graph Edge",
            "Checking relations via WHERE array_field CONTAINS id loses graph traversal performance for dynamic many-to-many links.",
            "Use native graph edges (->relation->) for dynamic many-to-many relationships. Retain array<record<T>> only when strict sequence order is required.",
        ),
        r(
            "SURQL-020",
            Category::Robustness,
            Severity::Deny,
            "Untyped Parameter in Stored Function",
            "Stored function parameter without type annotation defaults to any, bypassing server-side argument validation.",
            "Add explicit type annotation to function parameter: $param: string, $id: record<user>.",
        ),

        // Full-Text Search (BM25)
        r(
            "SURQL-021",
            Category::Performance,
            Severity::Warn,
            "Unranked Predicate Reference in FTS Query",
            "Full-text search query specifies predicate reference (@1@) in WHERE without referencing search::score(1) in ORDER BY.",
            "Add ORDER BY search::score(1) DESC to rank search results by BM25 relevance.",
        ),
        r(
            "SURQL-022",
            Category::Robustness,
            Severity::Deny,
            "Dangling Search Score Function Reference",
            "search::score(id) or search::highlight(..., id) called with predicate ID that is not defined in the WHERE clause.",
            "Ensure the numeric ID passed to search::score(N) matches a predicate (@N@) in the WHERE clause.",
        ),
        r(
            "SURQL-023",
            Category::Robustness,
            Severity::Deny,
            "Full-Text Operator on Unindexed Field",
            "Using @@ or @id@ operators on field that lacks a DEFINE INDEX ... FULLTEXT ANALYZER ... BM25 index.",
            "Create FULLTEXT index on field or verify field name.",
        ),
        r(
            "SURQL-024",
            Category::Performance,
            Severity::Warn,
            "Linear String Scan on Full-Text Indexed Field",
            "Using string::lowercase(...) CONTAINS on a field that already has a FULLTEXT index ignores index acceleration.",
            "Use @@ or @id@ operator to utilize the full-text BM25 index.",
        ),
        r(
            "SURQL-025",
            Category::Performance,
            Severity::Warn,
            "Multiple FTS Indexes in OR Predicate",
            "Evaluating field_a @1@ $q OR field_b @2@ $q across separate indexes triggers multiple index scans and bitmap merges.",
            "Create single composite FULLTEXT index covering both fields: FIELDS field_a, field_b FULLTEXT ANALYZER ... BM25.",
        ),
        r(
            "SURQL-026",
            Category::DataIntegrity,
            Severity::Deny,
            "Datetime Coerced to String in DateTime Field",
            "Saving type::string(time::now()) into schema field typed as datetime breaks chronological ordering and comparison.",
            "Pass native datetime value (time::now()) directly to datetime fields without type::string coercion.",
        ),

        // Rust Security Rule
        r(
            "SEC-011",
            Category::Security,
            Severity::Deny,
            "SQL Injection via Client-Side String Formatting",
            "Building SurrealQL query strings via format!, println!, or string concatenation instead of parameterized .bind() calls.",
            "Use parameterized queries: db.query(\"SELECT * FROM table WHERE field = $val\").bind((\"val\", value)).",
        ),
    ]
}
