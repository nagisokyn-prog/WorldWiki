use crate::model::{
    DiffOperation, DocumentDiffResult, InlineChange, SemanticBlock, SemanticDocument,
};
use crate::patch::{apply_patch, diff_documents};
use alloc::string::String;
use alloc::vec;

#[kani::proof]
#[kani::unwind(3)]
fn proof_document_diff_patch_full_roundtrip() {
    let mode: u8 = kani::any();
    kani::assume(mode < 3);

    let doc_a = SemanticDocument::new(
        1,
        vec![
            SemanticBlock::new("1", "p", "a"),
        ],
    );

    let doc_b = match mode {
        0 => SemanticDocument::new(
            1,
            vec![
                SemanticBlock::new("1", "p", "b"),
            ],
        ),
        1 => SemanticDocument::new(
            1,
            vec![
                SemanticBlock::new("1", "h", "a"),
            ],
        ),
        _ => SemanticDocument::new(
            1,
            vec![
                SemanticBlock::new("2", "p", "c"),
            ],
        ),
    };

    let diff = diff_documents(&doc_a, &doc_b);
    let patched = apply_patch(&doc_a, &diff);

    assert!(patched.is_ok());
    if let Ok(res) = patched {
        assert_eq!(res.blocks, doc_b.blocks);
    }
}

#[kani::proof]
#[kani::unwind(3)]
fn proof_patch_malicious_operations_no_panic() {
    let doc = SemanticDocument::new(
        1,
        vec![
            SemanticBlock::new("1", "p", "a"),
        ],
    );

    let mode: u8 = kani::any();
    kani::assume(mode < 3);

    let op = match mode {
        0 => {
            let from: usize = kani::any();
            let to: usize = kani::any();
            kani::assume(from <= 2 || from == usize::MAX);
            kani::assume(to <= 2 || to == usize::MAX);
            DiffOperation::MoveBlock {
                from_index: from,
                to_index: to,
                block_id: String::from("1"),
            }
        }
        1 => {
            let idx: usize = kani::any();
            kani::assume(idx <= 2 || idx == usize::MAX);
            DiffOperation::DeleteBlock {
                index: idx,
                block_id: String::from("9"),
            }
        }
        _ => {
            let pos: usize = kani::any();
            let del: usize = kani::any();
            kani::assume(pos <= 2 || pos == usize::MAX);
            kani::assume(del <= 2 || del == usize::MAX);
            DiffOperation::UpdateBlock {
                index: 0,
                block_id: String::from("1"),
                inline_changes: vec![InlineChange {
                    position: pos,
                    delete_count: del,
                    insert_text: String::new(),
                }],
                new_block_type: None,
                new_metadata: None,
            }
        }
    };

    let malicious_diff = DocumentDiffResult {
        operations: vec![op],
        word_count_delta: 0,
        has_structural_changes: true,
    };

    let _ = apply_patch(&doc, &malicious_diff);
}

#[kani::proof]
#[kani::unwind(3)]
fn proof_word_count_delta_conservation() {
    let doc_a = SemanticDocument::new(1, vec![SemanticBlock::new("1", "p", "a")]);
    let doc_b = SemanticDocument::new(1, vec![SemanticBlock::new("1", "p", "a b")]);

    let diff = diff_documents(&doc_a, &doc_b);
    assert_eq!(
        (doc_a.total_word_count() as i64) + diff.word_count_delta,
        doc_b.total_word_count() as i64
    );
}
