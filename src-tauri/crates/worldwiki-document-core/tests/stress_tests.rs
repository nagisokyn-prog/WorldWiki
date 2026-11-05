use worldwiki_document_core::{
    apply_patch, diff_documents, SemanticBlock, SemanticDocument,
};

#[test]
fn test_stress_diff_500_blocks_large_chapter() {
    let mut old_blocks = Vec::with_capacity(500);
    for i in 0..500 {
        old_blocks.push(SemanticBlock::new(
            format!("block_{i}"),
            "paragraph",
            format!(
                "Это тестовый абзац номер {i} в огромной главе книги. Здесь описываются события, происходящие с героями в локации {}.",
                i % 10
            ),
        ));
    }
    let old_doc = SemanticDocument::new(1, old_blocks);

    let mut new_blocks = Vec::with_capacity(520);
    for i in 0..500 {
        if i % 50 == 0 {
            // Insert a new block
            new_blocks.push(SemanticBlock::new(
                format!("inserted_{i}"),
                "quote",
                "Цитата мудреца, вставленная редактором.",
            ));
        }

        if i % 70 == 0 {
            // Delete: skip this block
            continue;
        }

        if i % 15 == 0 {
            // Edit inline content
            new_blocks.push(SemanticBlock::new(
                format!("block_{i}"),
                "paragraph",
                format!(
                    "Это отредактированный абзац номер {i} с добавленными деталями и описанием бури в локации {}.",
                    i % 10
                ),
            ));
        } else {
            // Preserve untouched
            new_blocks.push(SemanticBlock::new(
                format!("block_{i}"),
                "paragraph",
                format!(
                    "Это тестовый абзац номер {i} в огромной главе книги. Здесь описываются события, происходящие с героями в локации {}.",
                    i % 10
                ),
            ));
        }
    }
    let new_doc = SemanticDocument::new(1, new_blocks);

    // Measure diff computation
    let diff = diff_documents(&old_doc, &new_doc);
    assert!(diff.has_structural_changes);
    assert!(!diff.operations.is_empty());

    // Apply patch and verify parity
    let patched = apply_patch(&old_doc, &diff).expect("Patch should apply under stress");
    assert_eq!(patched.blocks.len(), new_doc.blocks.len());

    for (p_block, n_block) in patched.blocks.iter().zip(new_doc.blocks.iter()) {
        assert_eq!(p_block.id, n_block.id);
        assert_eq!(p_block.content, n_block.content);
    }
}

