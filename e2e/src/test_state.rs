//! In-memory state initialization for WorldWiki E2E Tests

use std::sync::Arc;
use surrealdb::engine::local::Mem;
use surrealdb::Surreal;
use world_wiki::bootstrap::database::apply_schema_pipeline;
use world_wiki::bootstrap::lifecycle::AppState;
use world_wiki::bootstrap::services::build_surreal_app_services;
use worldwiki_infrastructure::events::InMemoryEventPublisher;
use worldwiki_ports::events::EventPublisherPort;
use worldwiki_tauri::state::AppState as TauriAppState;

pub fn init_test_state() -> (AppState, TauriAppState) {
    let init_future = async {
        let db = Surreal::new::<Mem>(())
            .await
            .expect("Failed to initialize in-memory SurrealDB engine");

        db.use_ns("worldwriter")
            .use_db("worldwriter")
            .await
            .expect("Failed to select namespace and db 'worldwriter'");

        apply_schema_pipeline(&db)
            .await
            .expect("Failed to apply SurrealDB schema pipeline");

        let db_arc = Arc::new(db);
        let event_publisher: Arc<dyn EventPublisherPort> = Arc::new(InMemoryEventPublisher);
        let services = build_surreal_app_services(Arc::clone(&db_arc), event_publisher);

        let tauri_app_state = TauriAppState::new(services);
        let legacy_app_state = AppState {
            db: (*db_arc).clone(),
        };

        (legacy_app_state, tauri_app_state)
    };

    if let Ok(handle) = tokio::runtime::Handle::try_current() {
        tokio::task::block_in_place(|| handle.block_on(init_future))
    } else {
        tauri::async_runtime::block_on(init_future)
    }
}
