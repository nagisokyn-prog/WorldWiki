#![no_std]
#![allow(unstable_features)]

extern crate alloc;

pub mod inline_diff;
pub mod model;
pub mod myers;
pub mod patch;

#[cfg(any(kani, feature = "kani"))]
pub mod verify;

pub use inline_diff::{apply_inline_changes, compute_inline_diff, InlineApplyError};
pub use model::{
    DiffOperation, DocumentDiffResult, InlineChange, PatchError, SemanticBlock, SemanticDocument,
};
pub use myers::{myers_diff, EditOp};
pub use patch::{apply_patch, diff_documents};
