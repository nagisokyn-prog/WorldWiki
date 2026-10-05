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
    pub limit: Option<usize>,
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
