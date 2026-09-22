use serde_json::Value;
use worldwiki_domain::knowledge::{NormalizedFieldDef, SchemaValidationError};

pub(crate) fn validate_field_value(
    path: &str,
    val: &Value,
    def: &NormalizedFieldDef,
    errors: &mut Vec<SchemaValidationError>,
) {
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
                if !def.options.is_empty()
                    && !s.is_empty()
                    && !def.options.iter().any(|o| o.eq_ignore_ascii_case(s))
                {
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
