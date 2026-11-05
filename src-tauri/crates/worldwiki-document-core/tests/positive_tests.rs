use worldwiki_document_core::{
    apply_patch, diff_documents, DiffOperation, SemanticBlock, SemanticDocument,
};

#[test]
fn test_identical_documents_produce_empty_diff() {
    let doc = SemanticDocument::new(
        1,
        vec![
            SemanticBlock::new("b1", "heading", "Глава 1: Начало пути"),
            SemanticBlock::new("b2", "paragraph", "Солнце поднималось над башнями города."),
        ],
    );

    let diff = diff_documents(&doc, &doc);
    assert!(diff.is_empty());
    assert_eq!(diff.word_count_delta, 0);
    assert!(!diff.has_structural_changes);
}

#[test]
fn test_insert_and_delete_block_roundtrip() {
    let doc_a = SemanticDocument::new(
        1,
        vec![
            SemanticBlock::new("b1", "paragraph", "Первый абзац."),
            SemanticBlock::new("b2", "paragraph", "Второй абзац."),
        ],
    );

    let doc_b = SemanticDocument::new(
        1,
        vec![
            SemanticBlock::new("b1", "paragraph", "Первый абзац."),
            SemanticBlock::new("b_new", "paragraph", "Вставленный между ними абзац."),
        ],
    );

    let diff = diff_documents(&doc_a, &doc_b);
    assert!(diff.has_structural_changes);
    assert_eq!(diff.operations.len(), 2); // 1 delete of b2, 1 insert of b_new

    let patched = apply_patch(&doc_a, &diff).expect("Patch must apply cleanly");
    assert_eq!(patched.blocks.len(), 2);
    assert_eq!(patched.blocks[0].id, "b1");
    assert_eq!(patched.blocks[1].id, "b_new");
    assert_eq!(patched.blocks[1].content, "Вставленный между ними абзац.");
}

#[test]
fn test_inline_editing_roundtrip() {
    let doc_a = SemanticDocument::new(
        1,
        vec![SemanticBlock::new(
            "p1",
            "paragraph",
            "Она подошла к старому шкафу и взяла ключ.",
        )],
    );

    let doc_b = SemanticDocument::new(
        1,
        vec![SemanticBlock::new(
            "p1",
            "paragraph",
            "Она медленно подошла к старинному дубовому шкафу и взяла золотой ключ.",
        )],
    );

    let diff = diff_documents(&doc_a, &doc_b);
    assert_eq!(diff.operations.len(), 1);

    match &diff.operations[0] {
        DiffOperation::UpdateBlock { block_id, inline_changes, .. } => {
            assert_eq!(block_id, "p1");
            assert!(!inline_changes.is_empty());
        }
        _ => panic!("Expected UpdateBlock operation"),
    }

    let patched = apply_patch(&doc_a, &diff).expect("Patch should apply");
    assert_eq!(patched.blocks[0].content, doc_b.blocks[0].content);
}

#[test]
fn test_move_block_roundtrip() {
    let doc_a = SemanticDocument::new(
        1,
        vec![
            SemanticBlock::new("p1", "paragraph", "Абзац 1"),
            SemanticBlock::new("p2", "paragraph", "Абзац 2 (будет перемещен вниз)"),
            SemanticBlock::new("p3", "paragraph", "Абзац 3"),
        ],
    );

    let doc_b = SemanticDocument::new(
        1,
        vec![
            SemanticBlock::new("p1", "paragraph", "Абзац 1"),
            SemanticBlock::new("p3", "paragraph", "Абзац 3"),
            SemanticBlock::new("p2", "paragraph", "Абзац 2 (будет перемещен вниз)"),
        ],
    );

    let diff = diff_documents(&doc_a, &doc_b);
    let patched = apply_patch(&doc_a, &diff).expect("Patch should apply for move");
    assert_eq!(patched.blocks[0].id, "p1");
    assert_eq!(patched.blocks[1].id, "p3");
    assert_eq!(patched.blocks[2].id, "p2");
}

