//! WorldWiki Dedicated E2E Test Bridge
//!
//! Provides the N-API bridge for Vitest fullstack tests and boots in-memory SurrealDB.

pub mod commands;
pub mod test_state;

pub use commands::*;
pub use serde_json::Value;
pub use tauri::AppHandle;

// Selective model and remaining re-exports
pub use world_wiki::bootstrap::lifecycle::AppState;
pub use world_wiki::logic::models::*;

pub use world_wiki::logic::batch::{get_entities_batch, save_entity_with_relations};
pub use world_wiki::logic::entities::{
    create_entity_relation, delete_entity, delete_entity_relation, delete_entity_schema,
    delete_relation_schema, get_entities, get_entity, get_entity_relations,
    get_entity_schemas, get_relation_schemas, get_schema_history, save_entity,
    save_entity_schema, save_relation_schema, search_entities,
    toggle_entity_history_pin, toggle_schema_history_pin,
};

#[tauri_test::setup(init = test_state::init_test_state)]
pub struct WorldWikiE2EApp;
