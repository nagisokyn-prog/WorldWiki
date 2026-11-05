extern crate alloc;

use alloc::string::String;
use alloc::vec::Vec;

#[derive(Clone, Debug, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct SemanticBlock {
    pub id: String,
    pub block_type: String,
    pub content: String,
    #[cfg_attr(feature = "serde", serde(default))]
    pub metadata: Option<String>,
}

impl SemanticBlock {
    pub fn new(id: impl Into<String>, block_type: impl Into<String>, content: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            block_type: block_type.into(),
            content: content.into(),
            metadata: None,
        }
    }

    pub fn with_metadata(mut self, metadata: impl Into<String>) -> Self {
        self.metadata = Some(metadata.into());
        self
    }

    /// Approximate word count calculation for the block content
    pub fn word_count(&self) -> usize {
        self.content
            .split(|c: char| c.is_whitespace())
            .filter(|s| !s.is_empty())
            .count()
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct SemanticDocument {
    pub version: u32,
    pub blocks: Vec<SemanticBlock>,
}

impl SemanticDocument {
    pub fn new(version: u32, blocks: Vec<SemanticBlock>) -> Self {
        Self { version, blocks }
    }

    pub fn empty() -> Self {
        Self {
            version: 1,
            blocks: Vec::new(),
        }
    }

    pub fn total_word_count(&self) -> usize {
        self.blocks.iter().map(|b| b.word_count()).sum()
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct InlineChange {
    pub position: usize,
    pub delete_count: usize,
    pub insert_text: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub enum DiffOperation {
    InsertBlock {
        index: usize,
        block: SemanticBlock,
    },
    DeleteBlock {
        index: usize,
        block_id: String,
    },
    UpdateBlock {
        index: usize,
        block_id: String,
        inline_changes: Vec<InlineChange>,
    },
    MoveBlock {
        from_index: usize,
        to_index: usize,
        block_id: String,
    },
}

#[derive(Clone, Debug, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct DocumentDiffResult {
    pub operations: Vec<DiffOperation>,
    pub word_count_delta: i64,
    pub has_structural_changes: bool,
}

impl DocumentDiffResult {
    pub fn empty() -> Self {
        Self {
            operations: Vec::new(),
            word_count_delta: 0,
            has_structural_changes: false,
        }
    }

    pub fn is_empty(&self) -> bool {
        self.operations.is_empty()
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub enum PatchError {
    BlockNotFound { id: String },
    IndexOutOfBounds { index: usize, len: usize },
    InlinePositionOutOfBounds { position: usize, len: usize },
    MismatchedBlockId { expected: String, actual: String },
}

