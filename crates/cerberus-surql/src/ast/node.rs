use std::ops::Range;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SourceSpan {
    pub byte_range: Range<usize>,
    pub start_line: usize,
    pub start_col: usize,
    pub end_line: usize,
    pub end_col: usize,
}

#[derive(Debug, Clone)]
pub enum Statement {
    DefineTable(DefineTableNode),
    DefineField(DefineFieldNode),
    DefineIndex(DefineIndexNode),
    DefineFunction(DefineFunctionNode),
    Select(SelectNode),
    Update(UpdateNode),
    Delete(DeleteNode),
    Relate(RelateNode),
    ForLoop(ForLoopNode),
    Transaction(TransactionNode),
    Other(OtherNode),
}

impl Statement {
    pub fn span(&self) -> &SourceSpan {
        match self {
            Self::DefineTable(n) => &n.span,
            Self::DefineField(n) => &n.span,
            Self::DefineIndex(n) => &n.span,
            Self::DefineFunction(n) => &n.span,
            Self::Select(n) => &n.span,
            Self::Update(n) => &n.span,
            Self::Delete(n) => &n.span,
            Self::Relate(n) => &n.span,
            Self::ForLoop(n) => &n.span,
            Self::Transaction(n) => &n.span,
            Self::Other(n) => &n.span,
        }
    }
}

#[derive(Debug, Clone)]
pub struct DefineTableNode {
    pub span: SourceSpan,
    pub name: String,
    pub is_overwrite: bool,
    pub is_schemfull: bool,
    pub is_schemaless: bool,
    pub relation: Option<RelationEndpoints>,
}

#[derive(Debug, Clone)]
pub struct RelationEndpoints {
    pub in_table: String,
    pub out_table: String,
}

#[derive(Debug, Clone)]
pub struct DefineFieldNode {
    pub span: SourceSpan,
    pub field_name: String,
    pub table_name: String,
    pub is_overwrite: bool,
    pub raw_type: String,
    pub is_nullable: bool,
    pub is_optional: bool,
    pub default_expr: Option<String>,
}

#[derive(Debug, Clone)]
pub struct DefineIndexNode {
    pub span: SourceSpan,
    pub index_name: String,
    pub table_name: String,
    pub is_overwrite: bool,
    pub fields: Vec<String>,
    pub is_fulltext: bool,
    pub analyzer: Option<String>,
    pub is_bm25: bool,
}

#[derive(Debug, Clone)]
pub struct DefineFunctionNode {
    pub span: SourceSpan,
    pub name: String,
    pub is_overwrite: bool,
    pub parameters: Vec<FunctionParam>,
    pub return_type: Option<String>,
    pub body_statements: Vec<Statement>,
}

#[derive(Debug, Clone)]
pub struct FunctionParam {
    pub name: String,
    pub raw_type: Option<String>,
}

#[derive(Debug, Clone)]
pub struct SelectNode {
    pub span: SourceSpan,
    pub is_wildcard: bool,
    pub projected_fields: Vec<String>,
    pub from_table: Option<String>,
    pub where_clause: Option<String>,
    pub group_by: Option<String>,
    pub order_by: Option<String>,
    pub limit: Option<String>,
    pub function_calls: Vec<FunctionCallInfo>,
    pub subqueries: Vec<SelectNode>,
    pub is_subquery_zero_indexed: bool,
}

#[derive(Debug, Clone)]
pub struct FunctionCallInfo {
    pub name: String,
    pub full_call: String,
    pub span: SourceSpan,
}

#[derive(Debug, Clone)]
pub struct UpdateNode {
    pub span: SourceSpan,
    pub target: String,
    pub is_record_id: bool,
    pub has_where: bool,
    pub where_clause: Option<String>,
    pub set_assignments: Vec<(String, String)>,
}

#[derive(Debug, Clone)]
pub struct DeleteNode {
    pub span: SourceSpan,
    pub target: String,
    pub is_record_id: bool,
    pub has_where: bool,
    pub where_clause: Option<String>,
}

#[derive(Debug, Clone)]
pub struct RelateNode {
    pub span: SourceSpan,
    pub from: String,
    pub relation_table: String,
    pub to: String,
}

#[derive(Debug, Clone)]
pub struct ForLoopNode {
    pub span: SourceSpan,
    pub iterator_var: String,
    pub target_iterable: String,
    pub body_statements: Vec<Statement>,
}

#[derive(Debug, Clone)]
pub struct TransactionNode {
    pub span: SourceSpan,
    pub body_statements: Vec<Statement>,
}

#[derive(Debug, Clone)]
pub struct OtherNode {
    pub span: SourceSpan,
    pub raw: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn dummy_span(start: usize, end: usize) -> SourceSpan {
        SourceSpan {
            byte_range: start..end,
            start_line: 1,
            start_col: 1,
            end_line: 1,
            end_col: 10,
        }
    }

    #[test]
    fn test_statement_span_dispatch() {
        let span = dummy_span(0, 10);
        let s_table = Statement::DefineTable(DefineTableNode {
            span: span.clone(),
            name: "users".to_string(),
            is_overwrite: true,
            is_schemfull: true,
            is_schemaless: false,
            relation: None,
        });
        assert_eq!(s_table.span(), &span);

        let s_field = Statement::DefineField(DefineFieldNode {
            span: span.clone(),
            field_name: "name".to_string(),
            table_name: "users".to_string(),
            is_overwrite: false,
            raw_type: "string".to_string(),
            is_nullable: false,
            is_optional: false,
            default_expr: None,
        });
        assert_eq!(s_field.span(), &span);

        let s_index = Statement::DefineIndex(DefineIndexNode {
            span: span.clone(),
            index_name: "idx".to_string(),
            table_name: "users".to_string(),
            is_overwrite: false,
            fields: vec!["name".to_string()],
            is_fulltext: false,
            analyzer: None,
            is_bm25: false,
        });
        assert_eq!(s_index.span(), &span);

        let s_func = Statement::DefineFunction(DefineFunctionNode {
            span: span.clone(),
            name: "fn::test".to_string(),
            is_overwrite: false,
            parameters: Vec::new(),
            return_type: None,
            body_statements: Vec::new(),
        });
        assert_eq!(s_func.span(), &span);

        let s_select = Statement::Select(SelectNode {
            span: span.clone(),
            is_wildcard: true,
            projected_fields: Vec::new(),
            from_table: Some("users".to_string()),
            where_clause: None,
            group_by: None,
            order_by: None,
            limit: None,
            function_calls: Vec::new(),
            subqueries: Vec::new(),
            is_subquery_zero_indexed: false,
        });
        assert_eq!(s_select.span(), &span);

        let s_update = Statement::Update(UpdateNode {
            span: span.clone(),
            target: "users".to_string(),
            is_record_id: false,
            has_where: false,
            where_clause: None,
            set_assignments: Vec::new(),
        });
        assert_eq!(s_update.span(), &span);

        let s_delete = Statement::Delete(DeleteNode {
            span: span.clone(),
            target: "users".to_string(),
            is_record_id: false,
            has_where: false,
            where_clause: None,
        });
        assert_eq!(s_delete.span(), &span);

        let s_relate = Statement::Relate(RelateNode {
            span: span.clone(),
            from: "u1".to_string(),
            relation_table: "follows".to_string(),
            to: "u2".to_string(),
        });
        assert_eq!(s_relate.span(), &span);

        let s_for = Statement::ForLoop(ForLoopNode {
            span: span.clone(),
            iterator_var: "$u".to_string(),
            target_iterable: "$users".to_string(),
            body_statements: Vec::new(),
        });
        assert_eq!(s_for.span(), &span);

        let s_tx = Statement::Transaction(TransactionNode {
            span: span.clone(),
            body_statements: Vec::new(),
        });
        assert_eq!(s_tx.span(), &span);

        let s_other = Statement::Other(OtherNode {
            span: span.clone(),
            raw: "INFO FOR DB;".to_string(),
        });
        assert_eq!(s_other.span(), &span);
    }
}
