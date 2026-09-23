use serde_json::{json, Value};
use worldwiki_domain::knowledge::NormalizedEntitySchema;
use super::normalizer::normalize;

fn read_first_json_file<P: AsRef<std::path::Path>>(paths: &[P]) -> Option<Value> {
    let existing = paths.iter().find(|p| p.as_ref().is_file())?;
    let content = std::fs::read_to_string(existing).ok()?;
    serde_json::from_str::<Value>(&content).ok()
}

pub(crate) fn load_schema_impl(type_key: &str) -> NormalizedEntitySchema {
    let clean_type = type_key
        .trim()
        .trim_start_matches("type:")
        .trim_start_matches("schema:")
        .to_lowercase();

    // Попытка найти в стандартных путях
    let search_paths = [
        format!("apps/spa/public/struct/editor/{}.json", clean_type),
        format!("../apps/spa/public/struct/editor/{}.json", clean_type),
        format!("../../apps/spa/public/struct/editor/{}.json", clean_type),
    ];

    let ui_paths = [
        "apps/spa/public/struct/editor/ui_editor.json",
        "../apps/spa/public/struct/editor/ui_editor.json",
        "../../apps/spa/public/struct/editor/ui_editor.json",
    ];

    let ui_val = read_first_json_file(&ui_paths);

    if let Some(parsed) = read_first_json_file(&search_paths) {
        return normalize(&parsed, ui_val.as_ref());
    }

    // Канонический фоллбек для стандартных типов
    create_canonical_fallback(&clean_type)
}

pub(crate) fn create_canonical_fallback(type_key: &str) -> NormalizedEntitySchema {
    let title = match type_key {
        "character" => "Персонаж",
        "location" => "Локация",
        "faction" | "organization" => "Фракция / Организация",
        "item" => "Предмет / Артефакт",
        "event" => "Событие",
        "state" => "Государство",
        _ => type_key,
    }
    .to_string();

    let raw_schema = match type_key {
        "character" => json!({
            "entityType": "character",
            "title": "Персонаж",
            "sections": [{
                "id": "main",
                "fields": [
                    { "path": "название", "label": "Полное имя", "type": "text", "required": true },
                    { "path": "прозвище", "label": "Прозвище", "type": "text" },
                    { "path": "роль_в_истории", "label": "Роль", "type": "select", "options": ["главный", "второстепенный", "антагонист", "вспомогательный"] },
                    { "path": "статус", "label": "Статус", "type": "select", "options": ["жив", "мертв", "пропал_без_вести", "неизвестно"] },
                    { "path": "пол", "label": "Пол", "type": "text" },
                    { "path": "рост", "label": "Рост", "type": "number" },
                    { "path": "вес", "label": "Вес", "type": "number" },
                    { "path": "описание", "label": "Описание", "type": "textarea" },
                    { "path": "теги", "label": "Теги", "type": "tags" }
                ],
                "dynamicContainers": [
                    {
                        "dataPath": "триггеры_и_реакции",
                        "label": "Триггеры и реакции",
                        "fields": [
                            { "path": "описание_1", "label": "Что вызывает реакцию", "type": "textarea" },
                            { "path": "описание_2", "label": "Как реагирует персонаж", "type": "textarea" }
                        ]
                    }
                ]
            }]
        }),
        _ => json!({
            "entityType": type_key,
            "title": title,
            "sections": [{
                "id": "main",
                "fields": [
                    { "path": "название", "label": "Название", "type": "text", "required": true },
                    { "path": "описание", "label": "Описание", "type": "textarea" },
                    { "path": "теги", "label": "Теги", "type": "tags" }
                ]
            }]
        }),
    };

    normalize(&raw_schema, None)
}
