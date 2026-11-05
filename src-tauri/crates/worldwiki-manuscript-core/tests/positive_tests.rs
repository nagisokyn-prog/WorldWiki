use worldwiki_manuscript_core::{
    extract_entity_mentions, resolve_cross_references, CrossReference, TargetMetadata,
};

#[test]
fn test_extract_cyrillic_entity_mentions() {
    let text = "В тронный зал вошла ((Эльвира)) вместе с рыцарем ((Сэр Галахад)).";
    let mentions = extract_entity_mentions(text);

    assert_eq!(mentions.len(), 2);
    assert_eq!(mentions[0].name, "Эльвира");
    assert_eq!(mentions[1].name, "Сэр Галахад");

    // Verify char offsets match substring
    let chars: Vec<char> = text.chars().collect();
    let slice1: String = chars[mentions[0].char_start..mentions[0].char_end].iter().collect();
    assert_eq!(slice1, "((Эльвира))");

    let slice2: String = chars[mentions[1].char_start..mentions[1].char_end].iter().collect();
    assert_eq!(slice2, "((Сэр Галахад))");
}

#[test]
fn test_nested_single_parens_in_entity() {
    let text = "Герой известный как ((Арагорн (Странник))) подошел к огню.";
    let mentions = extract_entity_mentions(text);

    assert_eq!(mentions.len(), 1);
    assert_eq!(mentions[0].name, "Арагорн (Странник)");
}

#[test]
fn test_consecutive_entities() {
    let text = "Союз заключили ((Эльфы))((Гномы))((Люди)).";
    let mentions = extract_entity_mentions(text);

    assert_eq!(mentions.len(), 3);
    assert_eq!(mentions[0].name, "Эльфы");
    assert_eq!(mentions[1].name, "Гномы");
    assert_eq!(mentions[2].name, "Люди");
}

#[test]
fn test_resolve_cross_references() {
    use hashbrown::HashMap;

    let mut index = HashMap::new();
    index.insert(
        "chap_01".to_string(),
        TargetMetadata {
            title: "Глава 1: Врата".to_string(),
            path: Some("/chapters/01".to_string()),
        },
    );

    let refs = vec![CrossReference {
        id: "ref_1".to_string(),
        target_id: "chap_01".to_string(),
        ref_type: "chapter".to_string(),
        display_label: None,
    }];

    let resolved = resolve_cross_references(&refs, &index);
    assert_eq!(resolved.len(), 1);
    assert!(resolved[0].is_resolved);
    assert_eq!(resolved[0].target_title.as_deref(), Some("Глава 1: Врата"));
}

