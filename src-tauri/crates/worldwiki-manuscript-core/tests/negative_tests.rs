use worldwiki_manuscript_core::{
    extract_entity_mentions, resolve_cross_references, CrossReference,
};

#[test]
fn test_unclosed_entity_ignored() {
    let text = "Здесь начинается ((Незакрытое имя персонажа без скобок до конца текста";
    let mentions = extract_entity_mentions(text);
    assert!(mentions.is_empty());
}

#[test]
fn test_empty_or_whitespace_entities_ignored() {
    let text = "Пустые скобки (()) и скобки с пробелами ((    )) не должны распознаваться.";
    let mentions = extract_entity_mentions(text);
    assert!(mentions.is_empty());
}

#[test]
fn test_escaped_brackets_ignored() {
    let text = "Это обычный текст с экранированием \\((Не сущность)) и настоящая ((Сущность)).";
    let mentions = extract_entity_mentions(text);

    assert_eq!(mentions.len(), 1);
    assert_eq!(mentions[0].name, "Сущность");
}

#[test]
fn test_newline_breaks_entity() {
    let text = "Начало ((Имя персонажа\nпродолжение на новой строке)) конец.";
    let mentions = extract_entity_mentions(text);
    assert!(mentions.is_empty());
}

#[test]
fn test_unresolved_cross_reference_graceful() {
    use hashbrown::HashMap;

    let index = HashMap::new();
    let refs = vec![CrossReference {
        id: "ref_broken".to_string(),
        target_id: "non_existent_target".to_string(),
        ref_type: "chapter".to_string(),
        display_label: None,
    }];

    let resolved = resolve_cross_references(&refs, &index);
    assert_eq!(resolved.len(), 1);
    assert!(!resolved[0].is_resolved);
    assert_eq!(resolved[0].target_title, None);
}

