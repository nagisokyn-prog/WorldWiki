#![no_std]

extern crate alloc;

pub mod inline_diff;
pub mod model;
pub mod myers;
pub mod patch;

pub use inline_diff::{apply_inline_changes, compute_inline_diff, InlineApplyError};
pub use model::{
    DiffOperation, DocumentDiffResult, InlineChange, PatchError, SemanticBlock, SemanticDocument,
};
pub use myers::{myers_diff, EditOp};
pub use patch::{apply_patch, diff_documents};
