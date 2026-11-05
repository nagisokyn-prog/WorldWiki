#![no_std]

extern crate alloc;

pub mod crossref;
pub mod fsm_lexer;
pub mod types;

pub use crossref::resolve_cross_references;
pub use fsm_lexer::extract_entity_mentions;
pub use types::{CrossReference, ExtractedEntityMention, ResolvedCrossReference, TargetMetadata};

