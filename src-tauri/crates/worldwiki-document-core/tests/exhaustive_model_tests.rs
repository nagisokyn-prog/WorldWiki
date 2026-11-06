//! Исчерпывающие комбинаторные тесты математической модели для `worldwiki-document-core`.
//!
//! Данный модуль реализует исчерпывающее тестирование пространства состояний (Bounded Model Checking),
//! эквивалентное формальной верификации Kani, проверяя все комбинации входов в пределах заданной границы
//! без накладных расходов CBMC и риска OOM/BSOD.

use worldwiki_document_core::{
    apply_inline_changes, apply_patch, compute_inline_diff, diff_documents, EditOp,
    InlineApplyError, InlineChange, SemanticBlock, SemanticDocument,
};

// =========================================================================
// 1. Myers Diff: Исчерпывающая верификация декартова произведения срезов
// =========================================================================

/// Генерирует все возможные срезы длины от 0 до `max_len` над алфавитом `0..alphabet_size`.
fn generate_all_sequences(alphabet_size: u8, max_len: usize) -> Vec<Vec<u8>> {
    let mut results = vec![Vec::new()];
    let mut current_level = vec![Vec::new()];
    for _ in 0..max_len {
        let mut next_level = Vec::new();
        for seq in &current_level {
            for symbol in 0..alphabet_size {
                let mut new_seq = seq.clone();
                new_seq.push(symbol);
                next_level.push(new_seq);
            }
        }
        results.extend(next_level.clone());
        current_level = next_level;
    }
    results
}

#[test]
fn test_exhaustive_myers_diff_all_slices_up_to_length_3() {
    // Алфавит из 3 символов {0, 1, 2}, длины от 0 до 3:
    // Количество последовательностей: 3^0 + 3^1 + 3^2 + 3^3 = 1 + 3 + 9 + 27 = 40.
    // Пар срезов: 40 * 40 = 1600 комбинаций.
    let alphabet_size = 3;
    let max_len = 3;
    let sequences = generate_all_sequences(alphabet_size, max_len);
    assert_eq!(sequences.len(), 40);

    for a in &sequences {
        for b in &sequences {
            let ops = worldwiki_document_core::myers_diff(a.as_slice(), b.as_slice());

            // 1. Инвариант границ длины: max(|A|, |B|) <= ops.len() <= |A| + |B|
            let max_input_len = a.len().max(b.len());
            assert!(
                ops.len() >= max_input_len,
                "Длина скрипта ({}) меньше max(|A|, |B|) ({}) для A={:?}, B={:?}",
                ops.len(),
                max_input_len,
                a,
                b
            );
            assert!(
                ops.len() <= a.len() + b.len(),
                "Длина скрипта ({}) превышает |A| + |B| ({}) для A={:?}, B={:?}",
                ops.len(),
                a.len() + b.len(),
                a,
                b
            );

            // 2. Рефлексивность: если A == B, то все операции - Keep, и ops.len() == |A|
            if a == b {
                assert_eq!(ops.len(), a.len());
                for (idx, op) in ops.iter().enumerate() {
                    assert_eq!(*op, EditOp::Keep(a[idx]));
                }
            }

            // 3. Точная обратимость (Dual Exact Reconstruction):
            // Фильтрация Keep + Delete обязана в точности давать A.
            // Фильтрация Keep + Insert обязана в точности давать B.
            let mut reconstructed_a = Vec::with_capacity(ops.len());
            let mut reconstructed_b = Vec::with_capacity(ops.len());

            for op in &ops {
                match *op {
                    EditOp::Keep(val) => {
                        reconstructed_a.push(val);
                        reconstructed_b.push(val);
                    }
                    EditOp::Delete(val) => {
                        reconstructed_a.push(val);
                    }
                    EditOp::Insert(val) => {
                        reconstructed_b.push(val);
                    }
                }
            }

            assert_eq!(
                reconstructed_a.as_slice(),
                a.as_slice(),
                "Восстановленный A не совпадает с исходным для A={:?}, B={:?}",
                a,
                b
            );
            assert_eq!(
                reconstructed_b.as_slice(),
                b.as_slice(),
                "Восстановленный B не совпадает с исходным для A={:?}, B={:?}",
                a,
                b
            );

            // 4. Симметрия расстояния редактирования:
            let deletions_count = ops.iter().filter(|op| matches!(op, EditOp::Delete(_))).count();
            let insertions_count = ops.iter().filter(|op| matches!(op, EditOp::Insert(_))).count();

            let reverse_ops = worldwiki_document_core::myers_diff(b.as_slice(), a.as_slice());
            let reverse_deletions = reverse_ops.iter().filter(|op| matches!(op, EditOp::Delete(_))).count();
            let reverse_insertions = reverse_ops.iter().filter(|op| matches!(op, EditOp::Insert(_))).count();

            assert_eq!(deletions_count, reverse_insertions);
            assert_eq!(insertions_count, reverse_deletions);
        }
    }
}

// =========================================================================
// 2. Inline Diff: Исчерпывающая верификация roundtrip и непересекаемости
// =========================================================================

/// Генерирует все возможные строки длины 0..=3 над алфавитом ['a', 'b', 'c'].
fn generate_all_strings() -> Vec<String> {
    let alphabet = ['a', 'b', 'c'];
    let mut results = vec![String::new()];
    let mut current_level = vec![String::new()];

    for _ in 0..3 {
        let mut next = Vec::new();
        for s in &current_level {
            for &ch in &alphabet {
                let mut new_str = s.clone();
                new_str.push(ch);
                next.push(new_str);
            }
        }
        results.extend(next.clone());
        current_level = next;
    }
    results
}

#[test]
fn test_exhaustive_inline_diff_roundtrip_all_string_pairs() {
    let strings = generate_all_strings();
    assert_eq!(strings.len(), 40);

    for s1 in &strings {
        for s2 in &strings {
            let changes = compute_inline_diff(s1, s2);

            // 1. Идентичные строки порождают пустой список изменений
            if s1 == s2 {
                assert!(changes.is_empty(), "Изменения для одинаковых строк должны быть пустыми");
            }

            // 2. Инвариант непересекаемости и строгой монотонности:
            // position[i] + delete_count[i] <= position[i+1]
            let mut last_end = 0usize;
            for change in &changes {
                assert!(
                    change.position >= last_end,
                    "Нарушение упорядоченности: pos {} < last_end {} в s1='{}', s2='{}'",
                    change.position,
                    last_end,
                    s1,
                    s2
                );
                assert!(
                    change.position + change.delete_count <= s1.chars().count(),
                    "Выход диапазона удаления за пределы длины исходной строки"
                );
                last_end = change.position + change.delete_count;
            }

            // 3. Биективный раундтрип: apply(s1, diff(s1, s2)) == s2
            let applied = apply_inline_changes(s1, &changes);
            assert!(
                applied.is_ok(),
                "Применение изменений завершилось с ошибкой {:?} для s1='{}', s2='{}'",
                applied.as_ref().err(),
                s1,
                s2
            );
            let applied_text = applied.unwrap();
            assert_eq!(
                applied_text.as_str(),
                s2.as_str(),
                "Раундтрип не сошелся: получено '{}', ожидалось '{}'",
                applied_text,
                s2
            );
        }
    }
}

#[test]
fn test_exhaustive_inline_diff_boundary_and_overflow_safety() {
    // Проверка устойчивости к экстремальным границам usize без паник
    let test_positions = [0, 1, 2, 3, usize::MAX - 2, usize::MAX - 1, usize::MAX];
    let test_delete_counts = [0, 1, 2, 3, usize::MAX - 2, usize::MAX - 1, usize::MAX];
    let base_strings = ["", "a", "hello", "тест UTF-8 строки 🦀"];

    for &base in &base_strings {
        for &pos in &test_positions {
            for &del in &test_delete_counts {
                let change = InlineChange {
                    position: pos,
                    delete_count: del,
                    insert_text: String::from("xyz"),
                };

                let result = apply_inline_changes(base, &[change]);
                let base_len = base.chars().count();

                if pos > base_len {
                    assert_eq!(result, Err(InlineApplyError::PositionOutOfBounds));
                } else if let Some(end) = pos.checked_add(del) {
                    if end <= base_len {
                        assert!(result.is_ok());
                    } else {
                        assert_eq!(result, Err(InlineApplyError::DeleteCountOutOfBounds));
                    }
                } else {
                    assert_eq!(result, Err(InlineApplyError::DeleteCountOutOfBounds));
                }
            }
        }
    }
}

#[test]
fn test_exhaustive_inline_diff_unsorted_and_overlapping_detection() {
    let base = "abcdefgh";

    // 1. Неупорядоченные позиции (вторая операция начинается раньше первой)
    let changes_unsorted = vec![
        InlineChange { position: 3, delete_count: 1, insert_text: String::new() },
        InlineChange { position: 1, delete_count: 1, insert_text: String::new() },
    ];
    // Функция сортирует по позиции, поэтому после сортировки это [pos:1, pos:3] - валидно
    assert!(apply_inline_changes(base, &changes_unsorted).is_ok());

    // 2. Пересекающиеся диапазоны
    let changes_overlap = vec![
        InlineChange { position: 1, delete_count: 3, insert_text: String::new() }, // охватывает 1..4
        InlineChange { position: 3, delete_count: 2, insert_text: String::new() }, // начинается в 3 < 4 (cursor)
    ];
    assert_eq!(
        apply_inline_changes(base, &changes_overlap),
        Err(InlineApplyError::DeleteCountOutOfBounds)
    );
}

// =========================================================================
// 3. Document Diff & Patch: Исчерпывающая верификация структурных мутаций
// =========================================================================

#[test]
fn test_exhaustive_patch_roundtrip_all_structural_permutations() {
    // Тестируем комбинации документов: перестановки, удаления, добавления и редактирования
    let blocks_pool = [
        SemanticBlock::new("b1", "paragraph", "Слово один"),
        SemanticBlock::new("b2", "heading", "Заголовок два"),
        SemanticBlock::new("b3", "code", "let x = 3;"),
    ];

    // Формируем набор документов от 0 до 3 блоков
    let mut docs = vec![
        SemanticDocument::new(1, vec![]),
        SemanticDocument::new(1, vec![blocks_pool[0].clone()]),
        SemanticDocument::new(1, vec![blocks_pool[1].clone()]),
        SemanticDocument::new(1, vec![blocks_pool[0].clone(), blocks_pool[1].clone()]),
        SemanticDocument::new(1, vec![blocks_pool[1].clone(), blocks_pool[0].clone()]), // перестановка
        SemanticDocument::new(1, vec![blocks_pool[0].clone(), blocks_pool[2].clone()]),
        SemanticDocument::new(1, vec![blocks_pool[0].clone(), blocks_pool[1].clone(), blocks_pool[2].clone()]),
        SemanticDocument::new(1, vec![blocks_pool[2].clone(), blocks_pool[1].clone(), blocks_pool[0].clone()]), // обратный порядок
    ];

    // Добавляем документы с модификацией контента и метаданных тех же блоков
    let mut b1_mod = blocks_pool[0].clone();
    b1_mod.content = String::from("Слово один и два");
    let mut b2_mod = blocks_pool[1].clone();
    b2_mod.block_type = String::from("h2");
    b2_mod.metadata = Some(String::from("{\"collapsed\":true}"));

    docs.push(SemanticDocument::new(1, vec![b1_mod.clone(), blocks_pool[1].clone()]));
    docs.push(SemanticDocument::new(1, vec![blocks_pool[0].clone(), b2_mod.clone()]));
    docs.push(SemanticDocument::new(1, vec![b1_mod, b2_mod, blocks_pool[2].clone()]));

    for (i, doc_a) in docs.iter().enumerate() {
        for (j, doc_b) in docs.iter().enumerate() {
            let diff = diff_documents(doc_a, doc_b);

            // 1. Идентичные документы дают пустой diff
            if i == j {
                assert!(diff.is_empty());
                assert_eq!(diff.word_count_delta, 0);
            }

            // 2. Закон сохранения дельты счетчика слов
            let count_a = doc_a.total_word_count() as i64;
            let count_b = doc_b.total_word_count() as i64;
            assert_eq!(
                count_a + diff.word_count_delta,
                count_b,
                "Нарушение дельты слов для doc_{} -> doc_{}",
                i,
                j
            );

            // 3. Roundtrip эквивалентность применения патча
            let patched = apply_patch(doc_a, &diff);
            assert!(
                patched.is_ok(),
                "Патч вернул ошибку {:?} для doc_{} -> doc_{}",
                patched.err(),
                i,
                j
            );

            let res = patched.unwrap();
            assert_eq!(
                res.blocks.len(),
                doc_b.blocks.len(),
                "Количество блоков не совпадает для doc_{} -> doc_{}",
                i,
                j
            );

            for (k, (res_blk, b_blk)) in res.blocks.iter().zip(doc_b.blocks.iter()).enumerate() {
                assert_eq!(res_blk.id, b_blk.id, "Блок {} id не совпал", k);
                assert_eq!(res_blk.block_type, b_blk.block_type, "Блок {} type не совпал", k);
                assert_eq!(res_blk.content, b_blk.content, "Блок {} content не совпал", k);
                assert_eq!(res_blk.metadata, b_blk.metadata, "Блок {} metadata не совпал", k);
            }
        }
    }
}

// =========================================================================
// 4. Malicious / Boundary Fuzzing: Защита от паник при любых повреждениях
// =========================================================================

#[test]
fn test_exhaustive_malicious_patch_operations_never_panic() {
    use worldwiki_document_core::{DiffOperation, DocumentDiffResult};

    let doc = SemanticDocument::new(
        1,
        vec![
            SemanticBlock::new("1", "p", "Начальный текст первого блока"),
            SemanticBlock::new("2", "p", "Второй блок документа"),
        ],
    );

    let boundary_indices = [0, 1, 2, 3, usize::MAX - 1, usize::MAX];
    let invalid_block_ids = ["", "non_existent_id", "🦀", "1", "2"];

    for &from in &boundary_indices {
        for &to in &boundary_indices {
            for &id in &invalid_block_ids {
                // Тестируем перемещение блоков с произвольными индексами
                let move_op = DiffOperation::MoveBlock {
                    from_index: from,
                    to_index: to,
                    block_id: String::from(id),
                };

                let diff = DocumentDiffResult {
                    operations: vec![move_op],
                    word_count_delta: 0,
                    has_structural_changes: true,
                };

                // Вызов apply_patch ОБЯЗАН завершиться (Ok или Err), но НИКОГДА не паниковать
                let res = apply_patch(&doc, &diff);
                if from >= doc.blocks.len() || doc.blocks[from].id != id {
                    assert!(res.is_err());
                }
            }
        }
    }

    for &del_idx in &boundary_indices {
        for &id in &invalid_block_ids {
            let del_op = DiffOperation::DeleteBlock {
                index: del_idx,
                block_id: String::from(id),
            };

            let diff = DocumentDiffResult {
                operations: vec![del_op],
                word_count_delta: 0,
                has_structural_changes: true,
            };

            let res = apply_patch(&doc, &diff);
            if !doc.blocks.iter().any(|b| b.id == id) {
                assert!(res.is_err());
            }
        }
    }

    for &upd_idx in &boundary_indices {
        for &pos in &boundary_indices {
            for &del in &boundary_indices {
                let upd_op = DiffOperation::UpdateBlock {
                    index: upd_idx,
                    block_id: String::from("1"),
                    inline_changes: vec![InlineChange {
                        position: pos,
                        delete_count: del,
                        insert_text: String::from("hack"),
                    }],
                    new_block_type: Some(String::from("code")),
                    new_metadata: None,
                };

                let diff = DocumentDiffResult {
                    operations: vec![upd_op],
                    word_count_delta: 0,
                    has_structural_changes: false,
                };

                let _ = apply_patch(&doc, &diff); // Гарантировано не паникует
            }
        }
    }
}
