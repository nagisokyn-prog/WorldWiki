use worldwiki_document_core::{
    apply_inline_changes, apply_patch, compute_inline_diff, diff_documents, DiffOperation,
    DocumentDiffResult, InlineApplyError, InlineChange, PatchError, SemanticBlock,
    SemanticDocument,
};

#[test]
fn test_model_constructors_and_helpers() {
    let block = SemanticBlock::new("b1", "heading", "Заголовок")
        .with_metadata("{\"level\": 1}");
    assert_eq!(block.metadata.as_deref(), Some("{\"level\": 1}"));

    let empty_doc = SemanticDocument::empty();
    assert_eq!(empty_doc.version, 1);
    assert!(empty_doc.blocks.is_empty());
    assert_eq!(empty_doc.total_word_count(), 0);

    let empty_diff = DocumentDiffResult::empty();
    assert!(empty_diff.is_empty());
    assert_eq!(empty_diff.word_count_delta, 0);
    assert!(!empty_diff.has_structural_changes);
}

#[test]
fn test_inline_diff_identical_and_trailing_change() {
    // 1. Identical text early return
    let changes = compute_inline_diff("абвгде", "абвгде");
    assert!(changes.is_empty());

    // 2. Trailing change (at the very end of string to trigger `in_change` after loop)
    let changes_end = compute_inline_diff("Привет мир", "Привет миру!");
    assert!(!changes_end.is_empty());
    let applied = apply_inline_changes("Привет мир", &changes_end).unwrap();
    assert_eq!(applied, "Привет миру!");
}

#[test]
fn test_inline_apply_errors() {
    let changes_pos_oob = vec![InlineChange {
        position: 999,
        delete_count: 0,
        insert_text: "Тест".into(),
    }];
    assert_eq!(
        apply_inline_changes("Короткий текст", &changes_pos_oob),
        Err(InlineApplyError::PositionOutOfBounds)
    );

    let changes_del_oob = vec![InlineChange {
        position: 5,
        delete_count: 100,
        insert_text: "Тест".into(),
    }];
    assert_eq!(
        apply_inline_changes("Короткий текст", &changes_del_oob),
        Err(InlineApplyError::DeleteCountOutOfBounds)
    );

    let changes_overflow = vec![InlineChange {
        position: 1,
        delete_count: usize::MAX,
        insert_text: "Тест".into(),
    }];
    assert_eq!(
        apply_inline_changes("Короткий текст", &changes_overflow),
        Err(InlineApplyError::DeleteCountOutOfBounds)
    );

    let changes_overlapping = vec![
        InlineChange {
            position: 2,
            delete_count: 5,
            insert_text: "А".into(),
        },
        InlineChange {
            position: 4,
            delete_count: 2,
            insert_text: "Б".into(),
        },
    ];
    assert_eq!(
        apply_inline_changes("Короткий текст", &changes_overlapping),
        Err(InlineApplyError::DeleteCountOutOfBounds)
    );
}

#[test]
fn test_move_block_with_content_modifications() {
    let doc_a = SemanticDocument::new(
        1,
        vec![
            SemanticBlock::new("b1", "p", "Абзац 1"),
            SemanticBlock::new("b2", "p", "Исходный текст перемещаемого абзаца"),
            SemanticBlock::new("b3", "p", "Абзац 3"),
        ],
    );

    // b2 is moved to index 2 AND its text is modified
    let doc_b = SemanticDocument::new(
        1,
        vec![
            SemanticBlock::new("b1", "p", "Абзац 1"),
            SemanticBlock::new("b3", "p", "Абзац 3"),
            SemanticBlock::new("b2", "p", "Отредактированный текст перемещаемого абзаца"),
        ],
    );

    let diff = diff_documents(&doc_a, &doc_b);
    let patched = apply_patch(&doc_a, &diff).expect("Must apply move + edit cleanly");
    assert_eq!(patched.blocks.len(), 3);
    assert_eq!(patched.blocks[2].id, "b2");
    assert_eq!(patched.blocks[2].content, "Отредактированный текст перемещаемого абзаца");
}

#[test]
fn test_move_block_with_metadata_modification() {
    let doc_a = SemanticDocument::new(
        1,
        vec![
            SemanticBlock::new("b1", "p", "Абзац 1"),
            SemanticBlock::new("b2", "p", "Текст").with_metadata("old"),
            SemanticBlock::new("b3", "p", "Абзац 3"),
        ],
    );

    let doc_b = SemanticDocument::new(
        1,
        vec![
            SemanticBlock::new("b1", "p", "Абзац 1"),
            SemanticBlock::new("b3", "p", "Абзац 3"),
            SemanticBlock::new("b2", "heading", "Текст").with_metadata("new"),
        ],
    );

    let diff = diff_documents(&doc_a, &doc_b);
    let patched = apply_patch(&doc_a, &diff).expect("Must apply move + type/metadata cleanly");
    assert_eq!(patched.blocks.len(), 3);
    assert_eq!(patched.blocks[2].id, "b2");
    assert_eq!(patched.blocks[2].block_type, "heading");
    assert_eq!(patched.blocks[2].metadata.as_deref(), Some("new"));
}

#[test]
fn test_patch_apply_inline_position_out_of_bounds_error() {
    let doc = SemanticDocument::new(
        1,
        vec![SemanticBlock::new("b1", "p", "Короткий текст")],
    );

    let invalid_diff = DocumentDiffResult {
        operations: vec![DiffOperation::UpdateBlock {
            index: 0,
            block_id: "b1".into(),
            inline_changes: vec![InlineChange {
                position: 500, // Out of bounds
                delete_count: 10,
                insert_text: "Х".into(),
            }],
            new_block_type: None,
            new_metadata: None,
        }],
        word_count_delta: 0,
        has_structural_changes: false,
    };

    let res = apply_patch(&doc, &invalid_diff);
    assert!(matches!(res, Err(PatchError::InlinePositionOutOfBounds { .. })));
}

#[test]
fn test_patch_apply_mismatched_block_id_in_move() {
    let doc = SemanticDocument::new(
        1,
        vec![
            SemanticBlock::new("b1", "p", "Первый"),
            SemanticBlock::new("b2", "p", "Второй"),
        ],
    );

    // from_index is 0 (which is "b1"), but block_id says "b2"
    let invalid_diff = DocumentDiffResult {
        operations: vec![DiffOperation::MoveBlock {
            from_index: 0,
            to_index: 1,
            block_id: "b2".into(),
        }],
        word_count_delta: 0,
        has_structural_changes: true,
    };

    let res = apply_patch(&doc, &invalid_diff);
    assert!(matches!(res, Err(PatchError::MismatchedBlockId { .. })));
}


#[test]
fn test_myers_diff_empty_and_single_sided() {
    use worldwiki_document_core::{myers_diff, EditOp};

    let empty_a: &[i32] = &[];
    let empty_b: &[i32] = &[];
    assert!(myers_diff(empty_a, empty_b).is_empty());

    let non_empty = &[1, 2, 3];
    let inserted = myers_diff(empty_a, non_empty);
    assert_eq!(inserted, vec![EditOp::Insert(1), EditOp::Insert(2), EditOp::Insert(3)]);

    let deleted = myers_diff(non_empty, empty_b);
    assert_eq!(deleted, vec![EditOp::Delete(1), EditOp::Delete(2), EditOp::Delete(3)]);
}

#[test]
fn test_myers_diff_prefix_suffix_and_alternating() {
    use worldwiki_document_core::{myers_diff, EditOp};

    // 1. Common prefix walk
    let a = &[1, 2, 3];
    let b = &[1, 2, 4];
    let ops = myers_diff(a, b);
    assert_eq!(
        ops,
        vec![
            EditOp::Keep(1),
            EditOp::Keep(2),
            EditOp::Delete(3),
            EditOp::Insert(4)
        ]
    );

    // 2. Common suffix walk
    let a = &[0, 2, 3];
    let b = &[1, 2, 3];
    let ops = myers_diff(a, b);
    assert_eq!(
        ops,
        vec![
            EditOp::Delete(0),
            EditOp::Insert(1),
            EditOp::Keep(2),
            EditOp::Keep(3)
        ]
    );

    // 3. Single elements
    let a = &[1];
    let b = &[1];
    assert_eq!(myers_diff(a, b), vec![EditOp::Keep(1)]);

    let a = &[1];
    let b = &[2];
    assert_eq!(myers_diff(a, b), vec![EditOp::Delete(1), EditOp::Insert(2)]);
}
