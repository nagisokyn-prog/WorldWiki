// src-tauri/src/logic/schema.rs

/// В SurrealDB схема определяется в .surql файле при старте.
/// Этот модуль оставлен для обратной совместимости или будущих утилит миграции.
pub fn sync_database_schema(_conn: &str) {
    println!("ℹ️ SurrealDB schema is managed via surql migrations.");
}
