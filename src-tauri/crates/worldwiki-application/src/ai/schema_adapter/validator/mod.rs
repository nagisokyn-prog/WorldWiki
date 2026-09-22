pub mod field_validator;

pub(crate) use field_validator::validate_field_value;

use serde_json::Value;
use worldwiki_domain::knowledge::{NormalizedEntitySchema, SchemaValidationError};

/// Валидирует входящие `attributes` против нормализованной схемы.
/// Возвращает список ошибок (если есть).
pub fn validate_attributes(
    schema: &NormalizedEntitySchema,
    attributes: &Value,
) -> Result<(), Vec<SchemaValidationError>> {
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
            "id",
            "project_id",
            "type_key",
            "name",
            "tags",
            "created_at",
            "updated_at",
            "description",
            "__foreignUpdates",
        ]
        .contains(&key.as_str())
        {
            continue;
        }

        // Вариант A: это плоское поле
        if let Some(field_def) = schema.flat_fields.get(key) {
            validate_field_value(key, val, field_def, &mut errors);
            continue;
        }

        // Вариант B: это динамический контейнер
        if let Some(dyn_list) = schema.dynamic_lists.get(key) {
            if !val.is_array() {
                errors.push(SchemaValidationError {
                    field: key.clone(),
                    message: format!(
                        "Поле '{}' является динамическим списком и должно быть массивом объектов",
                        key
                    ),
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
                                validate_field_value(
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
                                        item_k,
                                        dyn_list.label,
                                        dyn_list.item_fields.keys().collect::<Vec<_>>()
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
