pub mod database;
pub mod lifecycle;
pub mod schema_catalog;
pub mod schema_migration;
pub mod services;

pub use database::init_database;
pub use schema_migration::{apply_ddl_module, apply_schema_pipeline};
pub use schema_catalog::{compute_schema_hash, ALL_DDL_MODULES, CORE_ENTITY_SCHEMAS};
pub use lifecycle::{handle_window_event, setup_application, AgentTasks, AppState};
pub use services::build_app_services;
