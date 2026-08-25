pub mod common;
pub mod smoke_schema;
pub mod timeline_integration;
pub mod hierarchy_integration;
pub mod entity_integration;
pub mod text_blocks_integration;
pub mod project_integration;
pub mod ai_integration;
pub mod embeddings_integration;
pub mod stress_integration;
pub mod negative_integration;
pub mod batch_and_connections_integration;
pub mod chat_integration;
pub mod export_integration;
pub mod retrieval_integration;
pub mod tools_integration;
pub mod chat_operations_integration;
// Интеграционный тест AI-пайплайна: run_agent_loop + mock OpenAI SSE-сервер + реальная БД.
// Требует tauri/mock-runtime -> включается только через --features agent-pipeline
// (на части Windows-машен mock-runtime ломает загрузку тестового бинаря, 0xc0000139).
#[cfg(feature = "agent-pipeline")]
pub mod agent_pipeline_integration;