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
pub mod graph_relational_backup_suite;
#[cfg(feature = "ai")]
pub mod retrieval_integration;
pub mod tools_integration;
pub mod chat_operations_integration;
pub mod document_export_integration;
pub mod manuscript_tracking_integration;
// Pipeline-тест перенесён в интеграционный таргет tests/agent_pipeline.rs
// (см. комментарий в build.rs про манифест Common-Controls v6).