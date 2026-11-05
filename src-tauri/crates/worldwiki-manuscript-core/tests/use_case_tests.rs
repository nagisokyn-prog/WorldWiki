use hashbrown::HashMap;
use worldwiki_manuscript_core::{
    extract_entity_mentions, resolve_cross_references, CrossReference, TargetMetadata,
};

/// Реальный use-case 1: Диалоговая сцена с множественными упоминаниями в репликах героев.
#[test]
fn test_use_case_rich_dialogue_scene() {
    let dialogue = r#"
— Ты видел ((Короля Артура))? — с тревогой спросил ((Мерлин)), не отрывая взгляда от ((Экскалибура)).
— Он отправился в ((Камелот)), — ответил рыцарь ((Сэр Ланселот)). — Но по дороге его ждёт засада ((Морганы)).
"#;

    let mentions = extract_entity_mentions(dialogue);
    assert_eq!(mentions.len(), 6);

    let names: Vec<&str> = mentions.iter().map(|m| m.name.as_str()).collect();
    assert_eq!(
        names,
        vec![
            "Короля Артура",
            "Мерлин",
            "Экскалибура",
            "Камелот",
            "Сэр Ланселот",
            "Морганы",
        ]
    );
}

/// Реальный use-case 2: Разрешение ссылок из текста главы в интерактивную панель глоссария UI.
#[test]
fn test_use_case_glossary_link_resolution_for_ui() {
    let mut index = HashMap::new();
    index.insert(
        "char_arthur".to_string(),
        TargetMetadata {
            title: "Артур Пендрагон".to_string(),
            path: Some("/entities/characters/arthur".to_string()),
        },
    );
    index.insert(
        "loc_camelot".to_string(),
        TargetMetadata {
            title: "Замок Камелот".to_string(),
            path: Some("/entities/locations/camelot".to_string()),
        },
    );

    let references = vec![
        CrossReference {
            id: "ref_1".to_string(),
            target_id: "char_arthur".to_string(),
            ref_type: "character".to_string(),
            display_label: Some("Король Артур".to_string()),
        },
        CrossReference {
            id: "ref_2".to_string(),
            target_id: "loc_camelot".to_string(),
            ref_type: "location".to_string(),
            display_label: None,
        },
        CrossReference {
            id: "ref_3_broken".to_string(),
            target_id: "missing_item".to_string(),
            ref_type: "item".to_string(),
            display_label: None,
        },
    ];

    let resolved = resolve_cross_references(&references, &index);
    assert_eq!(resolved.len(), 3);

    // Персонаж разрешен
    assert!(resolved[0].is_resolved);
    assert_eq!(resolved[0].target_title.as_deref(), Some("Артур Пендрагон"));
    assert_eq!(resolved[0].target_path.as_deref(), Some("/entities/characters/arthur"));

    // Локация разрешена
    assert!(resolved[1].is_resolved);
    assert_eq!(resolved[1].target_title.as_deref(), Some("Замок Камелот"));

    // Несуществующая связь корректно помечена как неразрешённая без паники
    assert!(!resolved[2].is_resolved);
    assert_eq!(resolved[2].target_title, None);
}

/// Реальный use-case 3: Научно-фантастическая глава со сложными формулами, экранированием и скобками.
#[test]
fn test_use_case_scifi_equations_and_escaped_tokens() {
    let sci_fi_text = "
Формула гиперпрыжка вычисляется как (((x + 1) * (y - 2))). 
В логах зафиксировано: \\((SYS_INIT_ERROR)) на частоте 1420 МГц.
Командир активировал ((Варп-генератор (Модель MK-IV) класса Люкс)).
";

    let mentions = extract_entity_mentions(sci_fi_text);
    // Математическая формула (((x + 1) * (y - 2))) с тремя скобками парсится как сущность с внутренними круглыми скобками
    // Экранированный \((SYS_INIT_ERROR)) игнорируется
    assert_eq!(mentions.len(), 2);
    assert_eq!(mentions[0].name, "(x + 1) * (y - 2)");
    assert_eq!(mentions[1].name, "Варп-генератор (Модель MK-IV) класса Люкс");
}

/// Реальный use-case 4: Историческая летопись со сложными титулами и двойными прозвищами.
#[test]
fn test_use_case_historical_chronicle_with_epithets() {
    let chronicle = "
В лето 6748 ((Князь Александр Ярославич (Невский))) разбил шведов на реке Неве.
Его союзником был ((Новгород Великий (Господин))), а врагом — ((Биргер (Ярл Швеции))).
Позже состоялась сеча на Чудском озере против ((Ордена Меченосцев (Ливонский филиал))).
";

    let mentions = extract_entity_mentions(chronicle);
    assert_eq!(mentions.len(), 4);
    assert_eq!(mentions[0].name, "Князь Александр Ярославич (Невский)");
    assert_eq!(mentions[1].name, "Новгород Великий (Господин)");
    assert_eq!(mentions[2].name, "Биргер (Ярл Швеции)");
    assert_eq!(mentions[3].name, "Ордена Меченосцев (Ливонский филиал)");
}

/// Реальный use-case 5: Массовое разрешение связей главы (персонажи, артефакты, локации, неразрешенные сноски).
#[test]
fn test_use_case_bulk_cross_reference_resolution() {
    let mut catalog = HashMap::new();
    catalog.insert(
        "sword_01".to_string(),
        TargetMetadata {
            title: "Клинок Рассвета".to_string(),
            path: Some("/wiki/items/dawn_blade".to_string()),
        },
    );
    catalog.insert(
        "loc_citadel".to_string(),
        TargetMetadata {
            title: "Багровая Цитадель".to_string(),
            path: Some("/wiki/locations/citadel".to_string()),
        },
    );

    let links = vec![
        CrossReference {
            id: "link_sword".to_string(),
            target_id: "sword_01".to_string(),
            ref_type: "item".to_string(),
            display_label: Some("древний меч".to_string()),
        },
        CrossReference {
            id: "link_citadel".to_string(),
            target_id: "loc_citadel".to_string(),
            ref_type: "location".to_string(),
            display_label: None,
        },
        CrossReference {
            id: "link_ghost".to_string(),
            target_id: "lost_hero".to_string(),
            ref_type: "character".to_string(),
            display_label: None,
        },
    ];

    let results = resolve_cross_references(&links, &catalog);
    assert_eq!(results.len(), 3);

    assert!(results[0].is_resolved);
    assert_eq!(results[0].target_title.as_deref(), Some("Клинок Рассвета"));
    assert_eq!(results[0].target_path.as_deref(), Some("/wiki/items/dawn_blade"));

    assert!(results[1].is_resolved);
    assert_eq!(results[1].target_title.as_deref(), Some("Багровая Цитадель"));

    assert!(!results[2].is_resolved);
    assert_eq!(results[2].target_title, None);
    assert_eq!(results[2].target_path, None);
}
