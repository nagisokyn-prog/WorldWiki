use worldwiki_manuscript_core::{
    extract_entity_mentions, resolve_cross_references, CrossReference, TargetMetadata,
};

#[test]
fn test_stress_extract_1000_mentions_in_large_manuscript() {
    let mut large_text = String::with_capacity(1_000_000);
    for i in 0..1000 {
        large_text.push_str("В древнем королевстве правил великий монарх ((Правитель_");
        large_text.push_str(&i.to_string());
        large_text.push_str(")). Он созвал совет с магом ((Маг_");
        large_text.push_str(&i.to_string());
        large_text.push_str(")). Обычный текст (с простыми скобками) и \\((экранированными)).\n");
    }

    let mentions = extract_entity_mentions(&large_text);
    assert_eq!(mentions.len(), 2000);

    assert_eq!(mentions[0].name, "Правитель_0");
    assert_eq!(mentions[1].name, "Маг_0");
    assert_eq!(mentions[1998].name, "Правитель_999");
    assert_eq!(mentions[1999].name, "Маг_999");
}

#[test]
fn test_stress_resolve_5000_cross_references() {
    use hashbrown::HashMap;

    let mut index = HashMap::new();
    for i in 0..5000 {
        index.insert(
            format!("node_{i}"),
            TargetMetadata {
                title: format!("Заголовок узла {i}"),
                path: Some(format!("/nodes/{i}")),
            },
        );
    }

    let mut refs = Vec::with_capacity(5000);
    for i in 0..5000 {
        refs.push(CrossReference {
            id: format!("ref_{i}"),
            target_id: format!("node_{i}"),
            ref_type: "general".to_string(),
            display_label: None,
        });
    }

    let resolved = resolve_cross_references(&refs, &index);
    assert_eq!(resolved.len(), 5000);
    for (i, r) in resolved.iter().enumerate() {
        assert!(r.is_resolved);
        assert_eq!(r.target_title.as_deref(), Some(format!("Заголовок узла {i}")).as_deref());
    }
}

