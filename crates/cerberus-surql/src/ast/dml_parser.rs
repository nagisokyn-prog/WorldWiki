pub use crate::ast::mutation_parser::MutationParser;
pub use crate::ast::query_parser::QueryParser;

use crate::ast::node::*;

/// Facade for SurrealQL Query and Mutation parsers.
pub struct DmlParser;

impl DmlParser {
    #[inline]
    pub fn parse_select(raw: &str, span: SourceSpan) -> SelectNode {
        QueryParser::parse_select(raw, span)
    }

    #[inline]
    pub fn parse_update(raw: &str, span: SourceSpan) -> UpdateNode {
        MutationParser::parse_update(raw, span)
    }

    #[inline]
    pub fn parse_delete(raw: &str, span: SourceSpan) -> DeleteNode {
        MutationParser::parse_delete(raw, span)
    }

    #[inline]
    pub fn parse_relate(raw: &str, span: SourceSpan) -> RelateNode {
        MutationParser::parse_relate(raw, span)
    }

    #[inline]
    pub fn parse_for_loop<F>(raw: &str, span: SourceSpan, parse_body: F) -> ForLoopNode
    where
        F: FnOnce(&str, usize) -> Vec<Statement>,
    {
        MutationParser::parse_for_loop(raw, span, parse_body)
    }
}
