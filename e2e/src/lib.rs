//! WorldWiki Dedicated E2E Test Bridge
//!
//! Provides the N-API bridge for Vitest fullstack tests and boots in-memory SurrealDB.

pub mod test_state;

pub use serde_json::Value;
pub use tauri::AppHandle;

// Selective command and model re-exports without glob collisions
pub use world_wiki::logic::models::*;

pub use world_wiki::logic::projects::{
    create_project, delete_project, execute_raw_surql, get_project_config, get_projects,
    save_project_config,
};

pub use world_wiki::logic::volumes::{
    assign_chapter, create_volume, get_chapter_hierarchy, reorder_node, update_volume,
};

pub use world_wiki::logic::chapters::{
    create_chapter, delete_chapter, get_chapter, get_chapters, save_chapter,
    toggle_chapter_history_pin,
};

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
