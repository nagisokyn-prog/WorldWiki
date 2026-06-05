// src-tauri/src/logic/schema.rs

/// В SurrealDB схема определяется в .surql файле при старте.
/// Этот модуль оставлен для обратной совместимости или будущих утилит миграции.
#[allow(dead_code)]
pub fn sync_database_schema(_conn: &String) {
    // В SurrealDB нам не нужно динамически создавать таблицы для каждой сущности.
    // База SCHEMALESS сама примет любые JSON объекты.
    println!("ℹ️ SurrealDB schema is managed via surql migrations.");
}