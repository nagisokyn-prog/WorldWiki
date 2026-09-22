//! Tool schema definitions and role-mode configurations for LLM tool calling.

use serde_json::Value;

pub struct ToolDefinitions;

impl ToolDefinitions {
    /// Returns canonical JSON-schemas of AI tools filtered by role mode (companion, editor, analyst).
    pub fn for_mode(mode: &str) -> Vec<Value> {
        let world_query_def = serde_json::json!({
            "name": "world_query",
            "description": "Гибридный семантический и лексический поиск (BM25 + эмбеддинги + граф связей) по базе знаний мира, сущностям и главам рукописи.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "query": { "type": "string", "description": "Поисковый запрос фактов, информации или сущностей" },
                    "scope": { "type": "string", "enum": ["all", "entities", "chapters"], "description": "Область поиска: 'all' (всё), 'entities' (энциклопедия), 'chapters' (рукопись)", "default": "all" },
                    "top_k": { "type": "integer", "description": "Количество результатов", "default": 8 }
                },
                "required": ["query"]
            }
        });

        let entity_inspect_def = serde_json::json!({
            "name": "entity_inspect",
            "description": "Получить полную анкету сущности по ID ('entities:char_123') ИЛИ по имени (например, 'Катя'), ИЛИ запросить схему полей для типа (например, 'type:character', 'schema:location').",
            "input_schema": {
                "type": "object",
                "properties": {
                    "entity_id_or_name": { "type": "string", "description": "ID сущности ('entities:char_123'), имя ('Катя'), или запрос схемы ('type:character')." },
                    "entity_id": { "type": "string", "description": "Алиас для entity_id_or_name (обратная совместимость)." }
                }
            }
        });

        let manuscript_read_def = serde_json::json!({
            "name": "manuscript_read",
            "description": "Прочитать текст главы рукописи по chapter_id/номеру/названию, либо получить оглавление (chapter_id: 'list').",
            "input_schema": {
                "type": "object",
                "properties": {
                    "chapter_id": { "type": "string", "description": "ID главы (например, 'chapters:ch1'), номер (например, '1') или 'list' для оглавления" }
                },
                "required": ["chapter_id"]
            }
        });

        let timeline_manage_def = serde_json::json!({
            "name": "timeline_manage",
            "description": "Расчет хронологии, конвертация календарных дат и вычисление абсолютной минуты (M_abs).",
            "input_schema": {
                "type": "object",
                "properties": {
                    "action": { "type": "string", "enum": ["convert_absolute", "convert_date"] },
                    "payload": { "type": "object", "description": "Параметры конвертации даты или календаря" }
                },
                "required": ["action", "payload"]
            }
        });

        let entity_manage_def = serde_json::json!({
            "name": "entity_manage",
            "description": "Создать, обновить или удалить сущность в энциклопедии мира, либо добавить связь. Для обновления/создания передайте: 'name' (обязательно), 'type_key' ('character', 'location', 'faction', 'item'), 'description', 'attributes' (объект с полями сущности, строго соответствующими схеме типа). Если не уверены в полях — предварительно вызовите entity_inspect(entity_id_or_name: 'type:character').",
            "input_schema": {
                "type": "object",
                "properties": {
                    "action": { "type": "string", "enum": ["create", "update", "delete", "relate"], "description": "Действие над сущностью" },
                    "payload": {
                        "type": "object",
                        "description": "Бланк сущности. Для update/create: 'name' (обязательно), 'id' (опционально), 'type_key' ('character', 'location', 'faction', 'item'), 'description', 'attributes' (объект с полями сущности)."
                    }
                },
                "required": ["action", "payload"]
            }
        });

        let manuscript_edit_def = serde_json::json!({
            "name": "manuscript_edit",
            "description": "Атомарное точечное внесение правок в рукопись с поддержкой отката и сохранением маркеров ((Сущностей)).",
            "input_schema": {
                "type": "object",
                "properties": {
                    "chapter_id": { "type": "string", "description": "ID главы" },
                    "operation_id": { "type": "string", "description": "Уникальный ID операции (например, uuid)" },
                    "patch": { "type": "object", "description": "Минимальный патч изменений" }
                },
                "required": ["chapter_id", "operation_id"]
            }
        });

        let consistency_audit_def = serde_json::json!({
            "name": "consistency_audit",
            "description": "Комплексный аудит сюжета тома: проверка неразрешенных сюжетных обещаний (чеховских ружей), зависших веток и противоречий.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "target_type": { "type": "string", "enum": ["volume"] },
                    "target_id": { "type": "string", "description": "ID тома (например, 'volumes:vol_1')" }
                },
                "required": ["target_type", "target_id"]
            }
        });

        let task_delegate_def = serde_json::json!({
            "name": "task_delegate",
            "description": "Делегировать тяжелое независимое исследование фоновому Read-Only субагенту.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "task_id": { "type": "string", "description": "ID задачи" },
                    "prompt": { "type": "string", "description": "Подробная инструкция для субагента (цель, скоуп, ограничения)" }
                },
                "required": ["task_id", "prompt"]
            }
        });

        match crate::ai::prompt::normalize_mode(mode) {
            "editor" => vec![
                world_query_def,
                entity_inspect_def,
                manuscript_read_def,
                entity_manage_def,
                manuscript_edit_def,
                timeline_manage_def,
            ],
            "analyst" => vec![
                world_query_def,
                entity_inspect_def,
                manuscript_read_def,
                timeline_manage_def,
                consistency_audit_def,
                task_delegate_def,
            ],
            _ => vec![
                world_query_def,
                entity_inspect_def,
                manuscript_read_def,
                timeline_manage_def,
            ], // companion (read-only)
        }
    }

    /// Default tool definitions for editor role.
    pub fn all() -> Vec<Value> {
        Self::for_mode("editor")
    }
}
