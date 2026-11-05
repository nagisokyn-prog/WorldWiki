use worldwiki_manuscript_core::extract_entity_mentions;

#[test]
fn test_utf8_3_and_4_byte_characters_and_emojis() {
    // 3-byte characters (Japanese / Chinese: 東京, 魔法)
    // 4-byte characters (Emojis: 🧙, 👑)
    let text = "В городе ((東京)) жил великий маг ((🧙 Маг Звёзд 👑)) и мастер ((魔法师)).";
    let mentions = extract_entity_mentions(text);

    assert_eq!(mentions.len(), 3);
    assert_eq!(mentions[0].name, "東京");
    assert_eq!(mentions[1].name, "🧙 Маг Звёзд 👑");
    assert_eq!(mentions[2].name, "魔法师");
}

#[test]
fn test_single_paren_in_middle_of_entity() {
    let text = "Встречайте: ((Герой (Альфа) и его верный оруженосец)).";
    let mentions = extract_entity_mentions(text);

    assert_eq!(mentions.len(), 1);
    assert_eq!(mentions[0].name, "Герой (Альфа) и его верный оруженосец");
}

#[test]
fn test_multiple_nested_parens_in_middle() {
    let text = "Договор подписали ((Орден (Север) и Клан (Юг))).";
    let mentions = extract_entity_mentions(text);

    assert_eq!(mentions.len(), 1);
    assert_eq!(mentions[0].name, "Орден (Север) и Клан (Юг)");
}


#[test]
fn test_empty_string_and_plain_ascii() {
    assert!(extract_entity_mentions("").is_empty());
    assert!(extract_entity_mentions("Plain text without any entities at all").is_empty());
}

#[test]
fn test_fsm_edge_branches_and_lookahead_boundaries() {
    // 1. Backslash at end of input or followed by non-trigger characters
    assert!(extract_entity_mentions(r"\").is_empty());
    assert!(extract_entity_mentions(r"\(").is_empty());
    assert!(extract_entity_mentions(r"\abc").is_empty());
    assert!(extract_entity_mentions(r"\(foo").is_empty());

    // 2. Single open paren at end of input or ordinary paren
    assert!(extract_entity_mentions("(").is_empty());
    assert!(extract_entity_mentions("(обычные скобки)").is_empty());

    // 3. Carriage return \r breaks entity parsing
    assert!(extract_entity_mentions("((Сущность\rпродолжение))").is_empty());

    // 4. Single closing paren inside entity not followed by ')'
    let m = extract_entity_mentions("((Воин ) с мечом))");
    assert_eq!(m.len(), 1);
    assert_eq!(m[0].name, "Воин ) с мечом");

    // 5. Unclosed entity ending with ')' at the end of input
    assert!(extract_entity_mentions("((Недописано)").is_empty());

    // 6. Nested paren with paren_depth > 0 at end of input
    assert!(extract_entity_mentions("((Воин (Ранг))").is_empty());

    // 7. Nested paren with paren_depth > 0, followed by non-paren token and closing
    let m = extract_entity_mentions("((Воин (Ранг)) конец))");
    assert_eq!(m.len(), 1);
    assert_eq!(m[0].name, "Воин (Ранг");
}
