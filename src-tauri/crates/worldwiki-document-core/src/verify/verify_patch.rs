use crate::model::{
    DiffOperation, DocumentDiffResult, InlineChange, SemanticBlock, SemanticDocument,
};
use crate::patch::{apply_patch, diff_documents};
use alloc::string::String;
use alloc::vec;

#[kani::proof]
#[kani::unwind(8)]
fn proof_document_diff_patch_full_roundtrip() {
    let mode: u8 = kani::any();
    kani::assume(mode < 3);

    let doc_a = SemanticDocument::new(
        1,
        vec![
            SemanticBlock::new("b1", "paragraph", "Текст А"),
            SemanticBlock::new("b2", "paragraph", "Текст Б"),
        ],
    );

    let doc_b = match mode {
        0 => SemanticDocument::new(
            1,
            vec![
                SemanticBlock::new("b1", "paragraph", "Текст А модифицирован"),
                SemanticBlock::new("b2", "paragraph", "Текст Б"),
            ],
        ),
        1 => SemanticDocument::new(
            1,
            vec![
                SemanticBlock::new("b2", "paragraph", "Текст Б"),
                SemanticBlock::new("b1", "paragraph", "Текст А"),
            ],
        ),
        _ => SemanticDocument::new(
            1,
            vec![
                SemanticBlock::new("b2", "heading", "Текст Б"),
                SemanticBlock::new("b3", "paragraph", "Текст В новый"),
            ],
        ),
    };

    let diff = diff_documents(&doc_a, &doc_b);
    let patched = apply_patch(&doc_a, &diff);

    assert!(patched.is_ok());
    let res = patched.unwrap();
    assert_eq!(res.blocks, doc_b.blocks);
}

#[kani::proof]
fn proof_patch_malicious_operations_no_panic() {
    let doc = SemanticDocument::new(
        1,
        vec![
            SemanticBlock::new("b1", "paragraph", "Alpha"),
            SemanticBlock::new("b2", "paragraph", "Beta"),
        ],
    );

    let from: usize = kani::any();
    let to: usize = kani::any();
    let idx: usize = kani::any();

    let malicious_diff = DocumentDiffResult {
        operations: vec![
            DiffOperation::MoveBlock {
                from_index: from,
                to_index: to,
                block_id: String::from("b1"),
            },
            DiffOperation::DeleteBlock {
                index: idx,
                block_id: String::from("unknown_id"),
            },
            DiffOperation::UpdateBlock {
                index: idx,
                block_id: String::from("b2"),
                inline_changes: vec![InlineChange {
                    position: usize::MAX,
                    delete_count: usize::MAX,
                    insert_text: String::from("Overflow"),
                }],
                new_block_type: None,
                new_metadata: None,
            },
        ],
        word_count_delta: 0,
        has_structural_changes: true,
    };

    let _ = apply_patch(&doc, &malicious_diff);
}

#[kani::proof]
#[kani::unwind(6)]
fn proof_word_count_delta_conservation() {
    let doc_a = SemanticDocument::new(
        1,
        vec![SemanticBlock::new("b1", "paragraph", "Одно Два")],
    );
    let doc_b = SemanticDocument::new(
        1,
        vec![SemanticBlock::new("b1", "paragraph", "Одно Два Три Четыре")],
    );

    let diff = diff_documents(&doc_a, &doc_b);
    assert_eq!(
        (doc_a.total_word_count() as i64) + diff.word_count_delta,
        doc_b.total_word_count() as i64
    );
}

