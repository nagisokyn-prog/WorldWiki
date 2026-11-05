use worldwiki_document_core::{
    apply_patch, DiffOperation, DocumentDiffResult, InlineChange, PatchError, SemanticBlock,
    SemanticDocument,
};

#[test]
fn test_patch_fails_on_missing_block() {
    let doc = SemanticDocument::new(
        1,
        vec![SemanticBlock::new("p1", "paragraph", "Текст")],
    );

    let invalid_diff = DocumentDiffResult {
        operations: vec![DiffOperation::UpdateBlock {
            index: 0,
            block_id: "non_existent_id".to_string(),
            inline_changes: vec![InlineChange {
                position: 0,
                delete_count: 0,
                insert_text: "Х".to_string(),
            }],
            new_block_type: None,
            new_metadata: None,
        }],
        word_count_delta: 0,
        has_structural_changes: false,
    };

    let result = apply_patch(&doc, &invalid_diff);
    assert!(matches!(result, Err(PatchError::BlockNotFound { .. })));
}

#[test]
fn test_patch_fails_on_delete_missing_block() {
    let doc = SemanticDocument::new(
        1,
        vec![SemanticBlock::new("p1", "paragraph", "Текст")],
    );

    let invalid_diff = DocumentDiffResult {
        operations: vec![DiffOperation::DeleteBlock {
            index: 0,
            block_id: "missing_block".to_string(),
        }],
        word_count_delta: 0,
        has_structural_changes: true,
    };

    let result = apply_patch(&doc, &invalid_diff);
    assert!(matches!(result, Err(PatchError::BlockNotFound { .. })));
}

#[test]
fn test_patch_fails_on_corrupted_move_id() {
    let doc = SemanticDocument::new(
        1,
        vec![
            SemanticBlock::new("p1", "paragraph", "Текст 1"),
            SemanticBlock::new("p2", "paragraph", "Текст 2"),
        ],
    );

    let invalid_diff = DocumentDiffResult {
        operations: vec![DiffOperation::MoveBlock {
            from_index: 0,
            to_index: 1,
            block_id: "fake_id".to_string(),
        }],
        word_count_delta: 0,
        has_structural_changes: true,
    };

    let result = apply_patch(&doc, &invalid_diff);
    assert!(matches!(
        result,
        Err(PatchError::BlockNotFound { .. }) | Err(PatchError::MismatchedBlockId { .. })
    ));
}

#[test]
fn test_patch_fails_on_move_index_out_of_bounds() {
    let doc = SemanticDocument::new(
        1,
        vec![SemanticBlock::new("p1", "paragraph", "Текст")],
    );

    let invalid_diff = DocumentDiffResult {
        operations: vec![DiffOperation::MoveBlock {
            from_index: 999,
            to_index: 0,
            block_id: "p1".to_string(),
        }],
        word_count_delta: 0,
        has_structural_changes: true,
    };

    let result = apply_patch(&doc, &invalid_diff);
    assert!(matches!(result, Err(PatchError::IndexOutOfBounds { .. })));
}

#[test]
fn test_patch_fails_on_move_deleted_block() {
    let doc = SemanticDocument::new(
        1,
        vec![SemanticBlock::new("p1", "paragraph", "Текст")],
    );

    let invalid_diff = DocumentDiffResult {
        operations: vec![
            DiffOperation::DeleteBlock {
                index: 0,
                block_id: "p1".to_string(),
            },
            DiffOperation::MoveBlock {
                from_index: 0,
                to_index: 0,
                block_id: "p1".to_string(),
            },
        ],
        word_count_delta: 0,
        has_structural_changes: true,
    };

    let result = apply_patch(&doc, &invalid_diff);
    assert!(matches!(result, Err(PatchError::BlockNotFound { id }) if id == "p1"));
}

