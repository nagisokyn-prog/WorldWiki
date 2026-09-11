use std::collections::HashMap;
use serde_json::{json, Value};
use worldwiki_domain::knowledge::{
    NormalizedDynamicListDef, NormalizedEntitySchema, NormalizedFieldDef, SchemaValidationError,
};

pub struct SchemaAdapter;

impl SchemaAdapter {
    /// Загружает схему типа сущности из файла структуры или генерирует каноническую
    pub fn load_schema(type_key: &str) -> NormalizedEntitySchema {
        let clean_type = type_key.trim().trim_start_matches("type:").trim_start_matches("schema:").to_lowercase();
        
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

        let mut ui_val = None;
        for p in &ui_paths {
            if let Ok(content) = std::fs::read_to_string(p) {
                if let Ok(parsed) = serde_json::from_str::<Value>(&content) {
                    ui_val = Some(parsed);
                    break;
                }
            }
        }

        for p in &search_paths {
            if let Ok(content) = std::fs::read_to_string(p) {
                if let Ok(parsed) = serde_json::from_str::<Value>(&content) {
                    return Self::normalize(&parsed, ui_val.as_ref());
                }
            }
        }

        // Канонический фоллбек для стандартных типов
        Self::create_canonical_fallback(&clean_type)
    }

    fn create_canonical_fallback(type_key: &str) -> NormalizedEntitySchema {
        let title = match type_key {
            "character" => "Персонаж",
            "location" => "Локация",
            "faction" | "organization" => "Фракция / Организация",
            "item" => "Предмет / Артефакт",
            "event" => "Событие",
            "state" => "Государство",
            _ => type_key,
        }.to_string();

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

        Self::normalize(&raw_schema, None)
    }

    /// Нормализует сырой full_schema (с секциями, dynamicContainers, templates, fieldOverrides)
    /// в чистый `NormalizedEntitySchema` без UI-мусора.
    pub fn normalize(full_schema: &Value, ui_templates: Option<&Value>) -> NormalizedEntitySchema {
        let entity_type = full_schema
            .get("entityType")
            .or_else(|| full_schema.get("type_key"))
            .and_then(|v| v.as_str())
            .unwrap_or("entity")
            .to_string();

        let title = full_schema
            .get("title")
            .or_else(|| full_schema.get("name"))
            .or_else(|| full_schema.get("type_name"))
            .and_then(|v| v.as_str())
            .unwrap_or(&entity_type)
            .to_string();

        let mut flat_fields: HashMap<String, NormalizedFieldDef> = HashMap::new();
        let mut dynamic_lists: HashMap<String, NormalizedDynamicListDef> = HashMap::new();

        // Сбор шаблонов (локальных и глобальных ui_editor.json)
        let mut all_templates: HashMap<String, Value> = HashMap::new();
        if let Some(Value::Object(t_map)) = ui_templates.and_then(|v| v.get("templates")) {
            for (k, v) in t_map {
                all_templates.insert(k.clone(), v.clone());
            }
        }
        if let Some(Value::Object(t_map)) = full_schema.get("templates") {
            for (k, v) in t_map {
                all_templates.insert(k.clone(), v.clone());
            }
        }

        // Обход секций
        if let Some(sections) = full_schema.get("sections").and_then(|v| v.as_array()) {
            for sec in sections {
                // 1. Плоские поля
                if let Some(fields) = sec.get("fields").and_then(|v| v.as_array()) {
                    for f in fields {
                        if let Some(fd) = Self::parse_field_def(f) {
                            flat_fields.insert(fd.key.clone(), fd);
                        }
                    }
                }

                // Старый формат items
                if let Some(items) = sec.get("items").and_then(|v| v.as_array()) {
                    for it in items {
                        let is_dyn = it.get("template").is_some()
                            || it.get("dataPath").is_some()
                            || it.get("type").and_then(|s| s.as_str()) == Some("dynamic")
                            || it.get("type").and_then(|s| s.as_str()) == Some("timeline");

                        if !is_dyn {
                            if let Some(fd) = Self::parse_field_def(it) {
                                flat_fields.insert(fd.key.clone(), fd);
                            }
                        }
                    }
                }

                // 2. Динамические контейнеры
                if let Some(dyn_containers) = sec.get("dynamicContainers").and_then(|v| v.as_array()) {
                    for dc in dyn_containers {
                        if let Some(dld) = Self::parse_dynamic_container(dc, &all_templates) {
                            dynamic_lists.insert(dld.data_path.clone(), dld);
                        }
                    }
                }

                if let Some(items) = sec.get("items").and_then(|v| v.as_array()) {
                    for it in items {
                        let is_dyn = it.get("template").is_some()
                            || it.get("dataPath").is_some()
                            || it.get("type").and_then(|s| s.as_str()) == Some("dynamic")
                            || it.get("type").and_then(|s| s.as_str()) == Some("timeline");

                        if is_dyn {
                            if let Some(dld) = Self::parse_dynamic_container(it, &all_templates) {
                                dynamic_lists.insert(dld.data_path.clone(), dld);
                            }
                        }
                    }
                }
            }
        }

        // Гарантируем системные поля
        if !flat_fields.contains_key("название") {
            flat_fields.insert(
                "название".to_string(),
                NormalizedFieldDef {
                    key: "название".to_string(),
                    label: "Название".to_string(),
                    field_type: "text".to_string(),
                    required: true,
                    options: vec![],
                    entity_type_ref: None,
                    description: Some("Имя или наименование сущности".to_string()),
                    default_value: None,
                },
            );
        }

        if !flat_fields.contains_key("описание") {
            flat_fields.insert(
                "описание".to_string(),
                NormalizedFieldDef {
                    key: "описание".to_string(),
                    label: "Описание".to_string(),
                    field_type: "textarea".to_string(),
                    required: false,
                    options: vec![],
                    entity_type_ref: None,
                    description: Some("Основное текстовое описание".to_string()),
                    default_value: None,
                },
            );
        }

        NormalizedEntitySchema {
            entity_type,
            title,
            flat_fields,
            dynamic_lists,
        }
    }

    fn parse_field_def(f: &Value) -> Option<NormalizedFieldDef> {
        let key = f
            .get("path")
            .or_else(|| f.get("class"))
            .or_else(|| f.get("id"))
            .or_else(|| f.get("key"))
            .and_then(|v| v.as_str())?
            .to_string();

        let label = f
            .get("label")
            .and_then(|v| v.as_str())
            .unwrap_or(&key)
            .to_string();

        let raw_type = f
            .get("type")
            .and_then(|v| v.as_str())
            .unwrap_or("text");

        let field_type = match raw_type {
            "textarea" => "textarea",
            "number" => "number",
            "range" => "range",
            "boolean" | "toggle" | "checkbox" => "boolean",
            "select" => "select",
            "multi_select" => "multi_select",
            "calendar_datetime" | "date" => "calendar_date",
            "tags" => "tags",
            _ => {
                if f.get("entityType").is_some() {
                    "entity_ref"
                } else {
                    "text"
                }
            }
        }.to_string();

        let required = f.get("required").and_then(|v| v.as_bool()).unwrap_or(false);

        let mut options = Vec::new();
        if let Some(opts) = f.get("options").and_then(|v| v.as_array()) {
            for opt in opts {
                if let Some(s) = opt.as_str() {
                    options.push(s.to_string());
                } else if let Some(val) = opt.get("value").and_then(|v| v.as_str()) {
                    options.push(val.to_string());
                }
            }
        }

        let entity_type_ref = f.get("entityType").and_then(|v| v.as_str()).map(|s| s.to_string());
        let description = f.get("placeholder").or_else(|| f.get("description")).and_then(|v| v.as_str()).map(|s| s.to_string());
        let default_value = f.get("default").or_else(|| f.get("defaultValue")).cloned();

        Some(NormalizedFieldDef {
            key,
            label,
            field_type,
            required,
            options,
            entity_type_ref,
            description,
            default_value,
        })
    }

    fn parse_dynamic_container(dc: &Value, templates: &HashMap<String, Value>) -> Option<NormalizedDynamicListDef> {
        let data_path = dc
            .get("dataPath")
            .or_else(|| dc.get("id"))
            .or_else(|| dc.get("path"))
            .and_then(|v| v.as_str())?
            .to_string();

        let label = dc
            .get("label")
            .or_else(|| dc.get("title"))
            .and_then(|v| v.as_str())
            .unwrap_or(&data_path)
            .to_string();

        let is_timeline = dc.get("type").and_then(|v| v.as_str()) == Some("timeline")
            || dc.get("isTimeline").and_then(|v| v.as_bool()).unwrap_or(false);

        let mut item_fields: HashMap<String, NormalizedFieldDef> = HashMap::new();

        // 1. Поля из шаблона
        if let Some(tpl_name) = dc.get("template").and_then(|v| v.as_str()) {
            if let Some(tpl) = templates.get(tpl_name) {
                if let Some(fields) = tpl.get("fields").and_then(|v| v.as_array()) {
                    for f in fields {
                        if let Some(fd) = Self::parse_field_def(f) {
                            item_fields.insert(fd.key.clone(), fd);
                        }
                    }
                }
            }
        }

        // 2. Локальные поля контейнера
        if let Some(fields) = dc.get("fields").and_then(|v| v.as_array()) {
            for f in fields {
                if let Some(fd) = Self::parse_field_def(f) {
                    item_fields.insert(fd.key.clone(), fd);
                }
            }
        }

        // 3. fieldOverrides
        if let Some(overrides) = dc.get("fieldOverrides").and_then(|v| v.as_object()) {
            for (f_key, ov_val) in overrides {
                if let Some(ov_obj) = ov_val.as_object() {
                    if ov_obj.get("hidden").and_then(|v| v.as_bool()).unwrap_or(false) {
                        item_fields.remove(f_key);
                        continue;
                    }
                    if let Some(existing) = item_fields.get_mut(f_key) {
                        if let Some(lbl) = ov_obj.get("label").and_then(|v| v.as_str()) {
                            existing.label = lbl.to_string();
                        }
                        if let Some(pl) = ov_obj.get("placeholder").and_then(|v| v.as_str()) {
                            existing.description = Some(pl.to_string());
                        }
                        if let Some(et) = ov_obj.get("entityType").and_then(|v| v.as_str()) {
                            existing.entity_type_ref = Some(et.to_string());
                            existing.field_type = "entity_ref".to_string();
                        }
                    } else {
                        // Новое переопределенное поле
                        let mut synthetic = Value::Object(ov_obj.clone());
                        synthetic["path"] = Value::String(f_key.clone());
                        if let Some(fd) = Self::parse_field_def(&synthetic) {
                            item_fields.insert(f_key.clone(), fd);
                        }
                    }
                }
            }
        }

        Some(NormalizedDynamicListDef {
            data_path,
            label,
            item_fields,
            is_timeline,
        })
    }

    /// Валидирует входящие `attributes` против нормализованной схемы.
    /// Возвращает список ошибок (если есть).
    pub fn validate_attributes(schema: &NormalizedEntitySchema, attributes: &Value) -> Result<(), Vec<SchemaValidationError>> {
        let mut errors = Vec::new();

        let obj = match attributes {
            Value::Object(m) => m,
            _ => {
                errors.push(SchemaValidationError {
                    field: "attributes".to_string(),
                    message: "Ожидался JSON-объект с атрибутами".to_string(),
                    expected_type: Some("object".to_string()),
                });
                return Err(errors);
            }
        };

        // 1. Проверяем все ключи в входящем объекте
        for (key, val) in obj {
            // Системные и служебные ключи пропускаем
            if [
                "id", "project_id", "type_key", "name", "tags", "created_at",
                "updated_at", "description", "__foreignUpdates",
            ].contains(&key.as_str()) {
                continue;
            }

            // Вариант A: это плоское поле
            if let Some(field_def) = schema.flat_fields.get(key) {
                Self::validate_field_value(key, val, field_def, &mut errors);
                continue;
            }

            // Вариант B: это динамический контейнер
            if let Some(dyn_list) = schema.dynamic_lists.get(key) {
                if !val.is_array() {
                    errors.push(SchemaValidationError {
                        field: key.clone(),
                        message: format!("Поле '{}' является динамическим списком и должно быть массивом объектов", key),
                        expected_type: Some("array".to_string()),
                    });
                } else if let Some(arr) = val.as_array() {
                    for (idx, item) in arr.iter().enumerate() {
                        if !item.is_object() {
                            errors.push(SchemaValidationError {
                                field: format!("{}[{}]", key, idx),
                                message: "Элемент динамического списка должен быть JSON-объектом".to_string(),
                                expected_type: Some("object".to_string()),
                            });
                            continue;
                        }

                        if let Some(item_obj) = item.as_object() {
                            for (item_k, item_v) in item_obj {
                                // Игнорируем служебные ключи таймлайна
                                if ["is_auto_extend", "chapter_id", "volume_id"].contains(&item_k.as_str()) {
                                    continue;
                                }

                                if let Some(item_field_def) = dyn_list.item_fields.get(item_k) {
                                    Self::validate_field_value(
                                        &format!("{}[{}].{}", key, idx, item_k),
                                        item_v,
                                        item_field_def,
                                        &mut errors,
                                    );
                                } else {
                                    errors.push(SchemaValidationError {
                                        field: format!("{}[{}].{}", key, idx, item_k),
                                        message: format!(
                                            "Поле '{}' не существует в схеме элемента '{}'. Допустимые поля: {:?}",
                                            item_k, dyn_list.label, dyn_list.item_fields.keys().collect::<Vec<_>>()
                                        ),
                                        expected_type: None,
                                    });
                                }
                            }
                        }
                    }
                }
                continue;
            }

            // Неизвестное поле
            errors.push(SchemaValidationError {
                field: key.clone(),
                message: format!(
                    "Неизвестное поле '{}'. В схеме сущности '{}' такого поля нет.",
                    key, schema.title
                ),
                expected_type: None,
            });
        }

        if errors.is_empty() {
            Ok(())
        } else {
            Err(errors)
        }
    }

    fn validate_field_value(path: &str, val: &Value, def: &NormalizedFieldDef, errors: &mut Vec<SchemaValidationError>) {
        if val.is_null() {
            if def.required {
                errors.push(SchemaValidationError {
                    field: path.to_string(),
                    message: format!("Обязательное поле '{}' не может быть пустым", def.label),
                    expected_type: Some(def.field_type.clone()),
                });
            }
            return;
        }

        match def.field_type.as_str() {
            "text" | "textarea" => {
                if !val.is_string() {
                    errors.push(SchemaValidationError {
                        field: path.to_string(),
                        message: format!("Поле '{}' должно быть строкой", def.label),
                        expected_type: Some("string".to_string()),
                    });
                }
            }
            "number" | "range" => {
                if !val.is_number() {
                    errors.push(SchemaValidationError {
                        field: path.to_string(),
                        message: format!("Поле '{}' должно быть числом", def.label),
                        expected_type: Some("number".to_string()),
                    });
                }
            }
            "boolean" => {
                if !val.is_boolean() {
                    errors.push(SchemaValidationError {
                        field: path.to_string(),
                        message: format!("Поле '{}' должно быть boolean (true/false)", def.label),
                        expected_type: Some("boolean".to_string()),
                    });
                }
            }
            "select" => {
                if let Some(s) = val.as_str() {
                    if !def.options.is_empty() && !s.is_empty() && !def.options.iter().any(|o| o.eq_ignore_ascii_case(s)) {
                        errors.push(SchemaValidationError {
                            field: path.to_string(),
                            message: format!(
                                "Значение '{}' недопустимо для поля '{}'. Разрешенные варианты: {:?}",
                                s, def.label, def.options
                            ),
                            expected_type: Some("enum".to_string()),
                        });
                    }
                } else {
                    errors.push(SchemaValidationError {
                        field: path.to_string(),
                        message: format!("Поле '{}' должно быть строкой (выбор из списка)", def.label),
                        expected_type: Some("string".to_string()),
                    });
                }
            }
            "tags" if !val.is_array() && !val.is_string() => {
                errors.push(SchemaValidationError {
                    field: path.to_string(),
                    message: format!("Поле '{}' должно быть массивом тегов или строкой", def.label),
                    expected_type: Some("array|string".to_string()),
                });
            }
            _ => {}
        }
    }

    /// Генерирует строгую, плоскую и инлайновую JSON Schema (без `$ref` и `$defs`)
    /// для целевой секции или всей сущности. Подходит для llama.cpp `json_schema_to_grammar` и OpenAI Strict Mode.
    pub fn to_scoped_json_schema(schema: &NormalizedEntitySchema, target_key: Option<&str>) -> Value {
        let mut properties = serde_json::Map::new();
        let mut required_keys = Vec::new();

        if let Some(target) = target_key {
            // Схема под конкретный динамический контейнер
            if let Some(dyn_list) = schema.dynamic_lists.get(target) {
                let item_schema = Self::build_item_json_schema(dyn_list);
                properties.insert(
                    target.to_string(),
                    json!({
                        "type": "array",
                        "description": dyn_list.label,
                        "items": item_schema
                    }),
                );
                required_keys.push(target.to_string());
            } else if let Some(f_def) = schema.flat_fields.get(target) {
                properties.insert(target.to_string(), Self::build_field_json_schema(f_def));
                if f_def.required {
                    required_keys.push(target.to_string());
                }
            }
        } else {
            // Вся плоская схема сущности
            for (k, f_def) in &schema.flat_fields {
                properties.insert(k.clone(), Self::build_field_json_schema(f_def));
                if f_def.required {
                    required_keys.push(k.clone());
                }
            }

            for (k, dyn_list) in &schema.dynamic_lists {
                let item_schema = Self::build_item_json_schema(dyn_list);
                properties.insert(
                    k.clone(),
                    json!({
                        "type": "array",
                        "description": dyn_list.label,
                        "items": item_schema
                    }),
                );
            }
        }

        json!({
            "type": "object",
            "properties": properties,
            "required": required_keys,
            "additionalProperties": false
        })
    }

    fn build_field_json_schema(f: &NormalizedFieldDef) -> Value {
        let desc = f.description.clone().unwrap_or_else(|| f.label.clone());
        match f.field_type.as_str() {
            "textarea" | "text" => json!({
                "type": "string",
                "description": desc
            }),
            "number" | "range" => json!({
                "type": "number",
                "description": desc
            }),
            "boolean" => json!({
                "type": "boolean",
                "description": desc
            }),
            "select" => {
                if !f.options.is_empty() {
                    json!({
                        "type": "string",
                        "enum": f.options,
                        "description": desc
                    })
                } else {
                    json!({
                        "type": "string",
                        "description": desc
                    })
                }
            }
            "tags" => json!({
                "type": "array",
                "items": { "type": "string" },
                "description": desc
            }),
            "entity_ref" | "chapter_ref" => json!({
                "type": "string",
                "description": format!("{} (ID или имя сущности)", desc)
            }),
            _ => json!({
                "type": "string",
                "description": desc
            }),
        }
    }

    fn build_item_json_schema(dyn_list: &NormalizedDynamicListDef) -> Value {
        let mut props = serde_json::Map::new();
        let mut reqs = Vec::new();

        for (k, f_def) in &dyn_list.item_fields {
            props.insert(k.clone(), Self::build_field_json_schema(f_def));
            if f_def.required {
                reqs.push(k.clone());
            }
        }

        json!({
            "type": "object",
            "properties": props,
            "required": reqs,
            "additionalProperties": false
        })
    }

    /// Генерирует лаконичный Fill Guide для системного промпта
    pub fn to_fill_guide(schema: &NormalizedEntitySchema) -> String {
        let mut lines = Vec::new();
        lines.push(format!("### Схема полей для типа '{}' ({}):", schema.entity_type, schema.title));
        lines.push("Плоские поля (flat_fields):".to_string());
        for (k, f) in &schema.flat_fields {
            let req = if f.required { " [ОБЯЗАТЕЛЬНО]" } else { "" };
            let opts = if !f.options.is_empty() {
                format!(" (варианты: {:?})", f.options)
            } else {
                String::new()
            };
            lines.push(format!("  • `{}` ({}{}) — {}{}", k, f.field_type, req, f.label, opts));
        }

        if !schema.dynamic_lists.is_empty() {
            lines.push("\nДинамические списки (массивы объектов):".to_string());
            for (k, d) in &schema.dynamic_lists {
                lines.push(format!("  • `{}`: массив элементов [{}] со структурой:", k, d.label));
                for (ik, iv) in &d.item_fields {
                    lines.push(format!("      - `{}` ({}) — {}", ik, iv.field_type, iv.label));
                }
            }
        }

        lines.join("\n")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_schema_normalize_and_validation() {
        let raw_schema = json!({
            "entityType": "character",
            "title": "Персонаж",
            "sections": [
                {
                    "id": "main",
                    "fields": [
                        { "path": "название", "label": "Имя", "type": "text", "required": true },
                        { "path": "роль_в_истории", "label": "Роль", "type": "select", "options": ["главный", "второстепенный"] }
                    ],
                    "dynamicContainers": [
                        {
                            "dataPath": "триггеры_и_реакции",
                            "label": "Триггеры и реакции",
                            "fields": [
                                { "path": "описание_1", "label": "Что вызывает", "type": "textarea" },
                                { "path": "описание_2", "label": "Реакция", "type": "textarea" }
                            ]
                        }
                    ]
                }
            ]
        });

        let norm = SchemaAdapter::normalize(&raw_schema, None);
        assert_eq!(norm.entity_type, "character");
        assert!(norm.flat_fields.contains_key("название"));
        assert!(norm.flat_fields.contains_key("роль_в_истории"));
        assert!(norm.dynamic_lists.contains_key("триггеры_и_реакции"));

        // Успешная валидация
        let valid_attrs = json!({
            "название": "Катя",
            "роль_в_истории": "главный",
            "триггеры_и_реакции": [
                {
                    "описание_1": "Вид крови",
                    "описание_2": "Паническая атака"
                }
            ]
        });

        let res = SchemaAdapter::validate_attributes(&norm, &valid_attrs);
        assert!(res.is_ok(), "Expected valid validation: {:?}", res);

        // Валидация с ошибками: неизвестное поле и недопустимый enum
        let invalid_attrs = json!({
            "название": "Катя",
            "роль_в_истории": "супергерой",
            "левый_ключ": 123,
            "триггеры_и_реакции": [
                {
                    "описание_1": "Вид крови",
                    "описание_3": "Мусорный ключ"
                }
            ]
        });

        let err_res = SchemaAdapter::validate_attributes(&norm, &invalid_attrs);
        assert!(err_res.is_err());
        let errs = err_res.unwrap_err();
        assert!(errs.iter().any(|e| e.field.contains("роль_в_истории")));
        assert!(errs.iter().any(|e| e.field.contains("левый_ключ")));
        assert!(errs.iter().any(|e| e.field.contains("описание_3")));
    }

    #[test]
    fn test_scoped_json_schema_generation() {
        let raw_schema = json!({
            "entityType": "character",
            "sections": [
                {
                    "dynamicContainers": [
                        {
                            "dataPath": "триггеры_и_реакции",
                            "label": "Триггеры",
                            "fields": [
                                { "path": "описание_1", "type": "textarea", "required": true },
                                { "path": "описание_2", "type": "textarea" }
                            ]
                        }
                    ]
                }
            ]
        });

        let norm = SchemaAdapter::normalize(&raw_schema, None);
        let scoped = SchemaAdapter::to_scoped_json_schema(&norm, Some("триггеры_и_реакции"));

        assert_eq!(scoped["type"], "object");
        assert_eq!(scoped["additionalProperties"], false);
        assert!(scoped["properties"]["триггеры_и_реакции"].is_object());
        let items = &scoped["properties"]["триггеры_и_реакции"]["items"];
        assert_eq!(items["additionalProperties"], false);
        assert!(items["properties"]["описание_1"].is_object());
        assert!(items["properties"]["описание_2"].is_object());
    }
}
