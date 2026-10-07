use std::sync::Arc;
use surrealdb::engine::local::Db;
use surrealdb::Surreal;
use tauri::Manager;
use tokio::sync::Mutex;

#[derive(Clone)]
pub struct AppState {
    pub db: Surreal<Db>,
}

// Implements the SurrealDb trait from surreal_domain_core,
// enabling all macro-generated generic Tauri commands to work.
impl surreal_domain::SurrealDb for AppState {
    type Connection = Db;
    fn surreal_db(&self) -> &Surreal<Db> {
        &self.db
    }
}

#[derive(Default)]
pub struct AgentTasks(
    pub Arc<Mutex<std::collections::HashMap<String, tokio::task::JoinHandle<()>>>>,
);

pub fn setup_application(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let raw_db = tauri::async_runtime::block_on(super::database::init_database())?;
    let db = std::sync::Arc::new(raw_db);
    let event_publisher = std::sync::Arc::new(worldwiki_tauri::TauriEventPublisher::new(
        app.handle().clone(),
    ));
    let services =
        super::services::build_surreal_app_services(Arc::clone(&db), event_publisher);
    app.manage(worldwiki_tauri::AppState::new(services));
    app.manage(AppState { db: (*db).clone() });
    app.manage(AgentTasks::default());
    Ok(())
}

pub fn handle_window_event(window: &tauri::Window, event: &tauri::WindowEvent) {
    if let tauri::WindowEvent::CloseRequested { .. } = event {
        println!("[DEBUG] Emergency backup before close...");
        let state = window.state::<AppState>();
        let db = state.db.clone();
        let backup_path = worldwiki_infrastructure::paths::get_backup_path();
        tauri::async_runtime::block_on(async move {
            if let Err(e) = db.export(backup_path).await {
                eprintln!("[ERROR] Failed to export backup: {}", e);
            } else {
                println!("[DB] Backup completed successfully.");
            }
        });
    }
}
