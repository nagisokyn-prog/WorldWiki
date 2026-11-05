use worldwiki_document_core::{
    apply_patch, diff_documents, SemanticBlock, SemanticDocument,
};

/// Реальный use-case 1: Автор нажимает Enter посреди абзаца (Paragraph Split).
/// Первый абзац усекается, а второй создаётся с новым ID.
#[test]
fn test_use_case_paragraph_split_by_author() {
    let doc_before = SemanticDocument::new(
        1,
        vec![
            SemanticBlock::new("p1", "paragraph", "В небе сверкнула молния. Гром расколол тишину надвое."),
            SemanticBlock::new("p2", "paragraph", "Они поспешили укрыться в пещере."),
        ],
    );

    let doc_after = SemanticDocument::new(
        1,
        vec![
            SemanticBlock::new("p1", "paragraph", "В небе сверкнула молния."),
            SemanticBlock::new("p1_split", "paragraph", "Гром расколол тишину надвое."),
            SemanticBlock::new("p2", "paragraph", "Они поспешили укрыться в пещере."),
        ],
    );

    let diff = diff_documents(&doc_before, &doc_after);
    assert!(diff.has_structural_changes);
    assert_eq!(diff.operations.len(), 2); // 1 Update of p1, 1 Insert of p1_split

    let patched = apply_patch(&doc_before, &diff).expect("Сплит абзаца должен успешно накатываться");
    assert_eq!(patched.blocks.len(), 3);
    assert_eq!(patched.blocks[0].content, "В небе сверкнула молния.");
    assert_eq!(patched.blocks[1].id, "p1_split");
    assert_eq!(patched.blocks[1].content, "Гром расколол тишину надвое.");
    assert_eq!(patched.blocks[2].content, "Они поспешили укрыться в пещере.");
}

/// Реальный use-case 2: Автор удаляет перенос строки через Backspace (Paragraph Merge).
/// Второй абзац удаляется, а его текст вливается в первый.
#[test]
fn test_use_case_paragraph_merge_by_author() {
    let doc_before = SemanticDocument::new(
        1,
        vec![
            SemanticBlock::new("p1", "paragraph", "Король поднял руку."),
            SemanticBlock::new("p2", "paragraph", "Зал погрузился в мёртвую тишину."),
            SemanticBlock::new("p3", "paragraph", "Никто не смел издать ни звука."),
        ],
    );

    let doc_after = SemanticDocument::new(
        1,
        vec![
            SemanticBlock::new("p1", "paragraph", "Король поднял руку. Зал погрузился в мёртвую тишину."),
            SemanticBlock::new("p3", "paragraph", "Никто не смел издать ни звука."),
        ],
    );

    let diff = diff_documents(&doc_before, &doc_after);
    assert!(diff.has_structural_changes);

    let patched = apply_patch(&doc_before, &diff).expect("Слияние абзацев должно успешно накатываться");
    assert_eq!(patched.blocks.len(), 2);
    assert_eq!(patched.blocks[0].id, "p1");
    assert_eq!(patched.blocks[0].content, "Король поднял руку. Зал погрузился в мёртвую тишину.");
    assert_eq!(patched.blocks[1].id, "p3");
}

/// Реальный use-case 3: Переупорядочивание сцен в аутлайнере (Drag & Drop сцена перемещается в начало).
#[test]
fn test_use_case_scene_reordering_in_chapter() {
    let doc_before = SemanticDocument::new(
        1,
        vec![
            SemanticBlock::new("scene_1", "scene", "Сцена 1: Битва у ворот"),
            SemanticBlock::new("scene_2", "scene", "Сцена 2: Переговоры в шатре"),
            SemanticBlock::new("scene_3", "scene", "Сцена 3: Флешбэк из детства героя"),
        ],
    );

    // Автор перетаскивает сцену 3 наверх (делает флешбэк прологом)
    let doc_after = SemanticDocument::new(
        1,
        vec![
            SemanticBlock::new("scene_3", "scene", "Сцена 3: Флешбэк из детства героя"),
            SemanticBlock::new("scene_1", "scene", "Сцена 1: Битва у ворот"),
            SemanticBlock::new("scene_2", "scene", "Сцена 2: Переговоры в шатре"),
        ],
    );

    let diff = diff_documents(&doc_before, &doc_after);
    let patched = apply_patch(&doc_before, &diff).expect("Перестановка сцен должна накатываться");
    assert_eq!(patched.blocks.len(), 3);
    assert_eq!(patched.blocks[0].id, "scene_3");
    assert_eq!(patched.blocks[1].id, "scene_1");
    assert_eq!(patched.blocks[2].id, "scene_2");
}

/// Реальный use-case 4: Массовая замена имени персонажа через Find & Replace во всей главе.
#[test]
fn test_use_case_bulk_replace_character_name() {
    let doc_before = SemanticDocument::new(
        1,
        vec![
            SemanticBlock::new("p1", "paragraph", "Джон подошел к окну и посмотрел на сад."),
            SemanticBlock::new("p2", "paragraph", "Слуга передал Джону важное письмо."),
            SemanticBlock::new("p3", "paragraph", "В письме говорилось, что Джон назначен наместником."),
        ],
    );

    let doc_after = SemanticDocument::new(
        1,
        vec![
            SemanticBlock::new("p1", "paragraph", "Джонатан подошел к окну и посмотрел на сад."),
            SemanticBlock::new("p2", "paragraph", "Слуга передал Джонатану важное письмо."),
            SemanticBlock::new("p3", "paragraph", "В письме говорилось, что Джонатан назначен наместником."),
        ],
    );

    let diff = diff_documents(&doc_before, &doc_after);
    assert!(!diff.has_structural_changes); // Структура блоков не менялась
    assert_eq!(diff.operations.len(), 3); // 3 UpdateBlock

    let patched = apply_patch(&doc_before, &diff).expect("Массовая замена должна примениться без сбоев");
    assert_eq!(patched.blocks[0].content, "Джонатан подошел к окну и посмотрел на сад.");
    assert_eq!(patched.blocks[1].content, "Слуга передал Джонатану важное письмо.");
    assert_eq!(patched.blocks[2].content, "В письме говорилось, что Джонатан назначен наместником.");
}

/// Реальный use-case 5: Преобразование типа блока (Paragraph -> Heading / Quote) с изменением метаданных.
#[test]
fn test_use_case_block_type_and_metadata_transformation() {
    let doc_before = SemanticDocument::new(
        1,
        vec![
            SemanticBlock::new("b1", "paragraph", "Глава 1. Пробуждение древних")
                .with_metadata(r#"{"level": 0}"#),
            SemanticBlock::new("b2", "paragraph", "В начале было слово."),
        ],
    );

    let doc_after = SemanticDocument::new(
        1,
        vec![
            SemanticBlock::new("b1", "heading", "Глава 1. Пробуждение древних")
                .with_metadata(r#"{"level": 1, "toc": true}"#),
            SemanticBlock::new("b2", "quote", "В начале было слово."),
        ],
    );

    let diff = diff_documents(&doc_before, &doc_after);
    assert!(!diff.has_structural_changes);
    assert_eq!(diff.operations.len(), 2);

    let patched = apply_patch(&doc_before, &diff).expect("Смена типа блоков должна применяться");
    assert_eq!(patched.blocks.len(), 2);
    assert_eq!(patched.blocks[0].id, "b1");
    assert_eq!(patched.blocks[0].block_type, "heading");
    assert_eq!(patched.blocks[0].metadata.as_deref(), Some(r#"{"level": 1, "toc": true}"#));
    assert_eq!(patched.blocks[1].id, "b2");
    assert_eq!(patched.blocks[1].block_type, "quote");
}

/// Реальный use-case 6: Комплексное комбинированное редактирование главы.
/// Одновременно: удаление устаревшей заметки, добавление эпилога в конец,
/// и правка первого абзаца.
#[test]
fn test_use_case_composite_chapter_editing() {
    let doc_before = SemanticDocument::new(
        1,
        vec![
            SemanticBlock::new("p1", "paragraph", "Солнце медленно садилось за горизонт."),
            SemanticBlock::new("note_trash", "todo", "TODO: Уточнить погоду у консультанта"),
            SemanticBlock::new("p2", "paragraph", "Они разбили лагерь у подножия холма."),
        ],
    );

    let doc_after = SemanticDocument::new(
        1,
        vec![
            SemanticBlock::new("p1", "paragraph", "Багровое солнце медленно садилось за горизонт."),
            SemanticBlock::new("p2", "paragraph", "Они разбили лагерь у подножия холма."),
            SemanticBlock::new("epilogue", "paragraph", "Ночь обещала быть холодной и беспокойной."),
        ],
    );

    let diff = diff_documents(&doc_before, &doc_after);
    assert!(diff.has_structural_changes);
    assert!(diff.word_count_delta > 0);

    let patched = apply_patch(&doc_before, &diff).expect("Комплексное редактирование должно пройти успешно");
    assert_eq!(patched.blocks.len(), 3);
    assert_eq!(patched.blocks[0].content, "Багровое солнце медленно садилось за горизонт.");
    assert_eq!(patched.blocks[1].id, "p2");
    assert_eq!(patched.blocks[2].id, "epilogue");
    assert_eq!(patched.blocks[2].content, "Ночь обещала быть холодной и беспокойной.");
}
