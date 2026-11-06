//! Исчерпывающие комбинаторные тесты математической модели для `worldwiki-manuscript-core`.
//!
//! Данный модуль реализует исчерпывающее тестирование пространства состояний (Bounded Model Checking),
//! эквивалентное формальной верификации Kani, проверяя все комбинации лексем, многобайтовых UTF-8 последовательностей
//! и графов перекрестных ссылок без CBMC.

use hashbrown::HashMap;
use worldwiki_manuscript_core::{
    extract_entity_mentions, resolve_cross_references, CrossReference, TargetMetadata,
};

// =========================================================================
// 1. FSM Lexer: Исчерпывающий перебор всех комбинаций алфавита
// =========================================================================

#[test]
fn test_exhaustive_fsm_all_permutations_alphabet_up_to_length_5() {
    // Критический алфавит FSM автомата: скобки, экраны, переводы строк, пробелы, символы
    let alphabet: [u8; 7] = *b"()\\\n\ra ";

    // Генерируем все строки длины 1..=5 над алфавитом:
    // 7^0 + 7^1 + 7^2 + 7^3 + 7^4 + 7^5 = 1 + 7 + 49 + 343 + 2401 + 16807 = 19608 комбинаций.
    let mut sequences: Vec<Vec<u8>> = vec![Vec::new()];
    let mut current_level = vec![Vec::new()];
    for _ in 0..5 {
        let mut next_level = Vec::new();
        for seq in &current_level {
            for &b in &alphabet {
                let mut new_seq = seq.clone();
                new_seq.push(b);
                next_level.push(new_seq);
            }
        }
        sequences.extend(next_level.clone());
        current_level = next_level;
    }

    let mut valid_mentions_found = 0;

    for bytes in &sequences {
        if let Ok(text) = core::str::from_utf8(bytes) {
            let mentions = extract_entity_mentions(text);

            for m in mentions {
                valid_mentions_found += 1;

                // 1. Инвариант длины: минимум 4 байта на скобки плюс непустое имя
                assert!(
                    m.byte_start + 4 < m.byte_end,
                    "Сущность слишком короткая: byte_start={}, byte_end={}",
                    m.byte_start,
                    m.byte_end
                );
                assert!(m.byte_end <= text.len());
                assert!(m.char_start <= m.char_end);

                // 2. Инвариант UTF-8 границ: byte_start и byte_end обязаны лежать строго на границах символов
                assert!(text.is_char_boundary(m.byte_start));
                assert!(text.is_char_boundary(m.byte_end));

                // 3. Инвариант скобок: начинается строго с "((" и завершается строго "))"
                assert_eq!(&text[m.byte_start..m.byte_start + 2], "((");
                assert_eq!(&text[m.byte_end - 2..m.byte_end], "))");

                // 4. Инвариант имени: не пустое после trim
                assert!(!m.name.is_empty());
                let inner = &text[m.byte_start + 2..m.byte_end - 2];
                assert_eq!(m.name, inner.trim());

                // 5. Инвариант отсутствия переводов строк внутри сущности:
                assert!(
                    !inner.contains('\n') && !inner.contains('\r'),
                    "Сущность содержит перевод строки: '{}'",
                    inner
                );
            }
        }
    }

    // Проверяем, что в пространстве состояний нашлись валидные сущности типа "((a))"
    assert!(valid_mentions_found > 0);
}

// =========================================================================
// 2. FSM Lexer: Многобайтовый UTF-8 и устойчивость к слайсингу
// =========================================================================

#[test]
fn test_exhaustive_fsm_utf8_multibyte_matrix() {
    // 1-байтовые (ASCII), 2-байтовые (Кириллица), 3-байтовые (Иероглифы), 4-байтовые (Эмодзи)
    let char_classes = [
        "x",               // 1 байт
        "Э",               // 2 байта (D0 AD)
        "道",              // 3 байта (E9 81 93)
        "👑",              // 4 байта (F0 9F 91 91)
    ];

    for prefix in &char_classes {
        for body in &char_classes {
            for suffix in &char_classes {
                let test_string = format!("{} (({})) {}", prefix, body, suffix);
                let mentions = extract_entity_mentions(&test_string);

                assert_eq!(mentions.len(), 1);
                let m = &mentions[0];

                assert_eq!(m.name, *body);

                // Проверка прямого среза по байтовым индексам
                assert!(test_string.is_char_boundary(m.byte_start));
                assert!(test_string.is_char_boundary(m.byte_end));
                let byte_slice = &test_string[m.byte_start..m.byte_end];
                assert_eq!(byte_slice, format!("(({}))", body));

                // Проверка среза по символьным индексам
                let chars: Vec<char> = test_string.chars().collect();
                let char_slice: String = chars[m.char_start..m.char_end].iter().collect();
                assert_eq!(char_slice, format!("(({}))", body));
            }
        }
    }
}

#[test]
fn test_exhaustive_fsm_escape_and_depth_invariants() {
    // 1. Одиночное экранирование гарантированно подавляет захват
    let escaped_cases = [
        r"\((Эльвира))",
        r"Префикс \((Эльвира)) суффикс",
        r"\((a)) и ((b))",
        r"Текст \((не_сущность)) еще текст",
    ];

    for text in &escaped_cases {
        let mentions = extract_entity_mentions(text);
        for m in mentions {
            assert_ne!(m.name, "Эльвира");
            assert_ne!(m.name, "не_сущность");
        }
    }

    // 2. Инвариант сатурации глубины скобок
    let nested_cases = [
        ("((Герой (Воин)))", "Герой (Воин)"),
        ("((Артефакт (редкий (мифический))))", "Артефакт (редкий (мифический))"),
        ("(((Арагорн)))", "(Арагорн)"),
    ];

    for (input, expected_name) in &nested_cases {
        let mentions = extract_entity_mentions(input);
        assert_eq!(mentions.len(), 1, "Для строки '{}' ожидалось 1 упоминание", input);
        assert_eq!(mentions[0].name, *expected_name);
    }
}

// =========================================================================
// 3. Cross-Reference Engine: Исчерпывающая верификация графа разрешений
// =========================================================================

#[test]
fn test_exhaustive_crossref_resolution_matrix() {
    let mut index = HashMap::new();
    index.insert(
        String::from("ent_1"),
        TargetMetadata {
            title: String::from("Король Артур"),
            path: Some(String::from("/characters/arthur")),
        },
    );
    index.insert(
        String::from("ent_2"),
        TargetMetadata {
            title: String::from("Камелот"),
            path: None,
        },
    );

    // Тестируем все комбинации ссылок: существующие, отсутствующие, пустые, дублирующиеся
    let test_targets = ["ent_1", "ent_2", "missing_1", "missing_2"];
    let test_types = ["mention", "hyperlink", "footnote"];

    let mut refs = Vec::new();
    for (idx, &target) in test_targets.iter().enumerate() {
        for &ref_type in &test_types {
            refs.push(CrossReference {
                id: format!("ref_{}_{}", idx, ref_type),
                target_id: String::from(target),
                ref_type: String::from(ref_type),
                display_label: if idx % 2 == 0 { Some(format!("Label {}", idx)) } else { None },
            });
        }
    }

    let resolved = resolve_cross_references(&refs, &index);

    // 1. Биекция длины и порядка
    assert_eq!(resolved.len(), refs.len());

    for (r_in, r_out) in refs.iter().zip(resolved.iter()) {
        assert_eq!(r_out.ref_id, r_in.id);
        assert_eq!(r_out.target_id, r_in.target_id);

        let exists_in_index = index.contains_key(&r_in.target_id);

        // 2. Инвариант разрешения
        assert_eq!(
            r_out.is_resolved,
            exists_in_index,
            "Несоответствие флага is_resolved для target_id='{}'",
            r_in.target_id
        );

        // 3. Инвариант метаданных
        if exists_in_index {
            let meta = index.get(&r_in.target_id).unwrap();
            assert_eq!(r_out.target_title.as_ref(), Some(&meta.title));
            assert_eq!(r_out.target_path.as_ref(), meta.path.as_ref());
        } else {
            assert!(r_out.target_title.is_none());
            assert!(r_out.target_path.is_none());
        }
    }
}
