pub(crate) mod generator;
pub(crate) mod loader;
pub(crate) mod normalizer;
pub(crate) mod validator;

use serde_json::Value;
use worldwiki_domain::knowledge::{NormalizedEntitySchema, SchemaValidationError};

pub struct SchemaAdapter;

impl SchemaAdapter {
    /// Загружает схему типа сущности из файла структуры или генерирует каноническую
    pub fn load_schema(type_key: &str) -> NormalizedEntitySchema {
        loader::load_schema_impl(type_key)
    }

    /// Нормализует сырой full_schema (с секциями, dynamicContainers, templates, fieldOverrides)
    /// в чистый `NormalizedEntitySchema` без UI-мусора.
    pub fn normalize(full_schema: &Value, ui_templates: Option<&Value>) -> NormalizedEntitySchema {
        normalizer::normalize(full_schema, ui_templates)
    }

    /// Валидирует входящие `attributes` против нормализованной схемы.
    /// Возвращает список ошибок (если есть).
    pub fn validate_attributes(
        schema: &NormalizedEntitySchema,
        attributes: &Value,
    ) -> Result<(), Vec<SchemaValidationError>> {
        validator::validate_attributes(schema, attributes)
    }

    /// Генерирует строгую, плоскую и инлайновую JSON Schema (без `$ref` и `$defs`)
    /// для целевой секции или всей сущности. Подходит для llama.cpp `json_schema_to_grammar` и OpenAI Strict Mode.
    pub fn to_scoped_json_schema(schema: &NormalizedEntitySchema, target_key: Option<&str>) -> Value {
        generator::to_scoped_json_schema(schema, target_key)
    }

    /// Генерирует лаконичный Fill Guide для системного промпта
    pub fn to_fill_guide(schema: &NormalizedEntitySchema) -> String {
        generator::to_fill_guide(schema)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

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
