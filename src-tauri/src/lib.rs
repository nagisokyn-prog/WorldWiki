// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use std::sync::Arc;
use surrealdb::engine::local::Db;
use surrealdb::Surreal;
use tokio::sync::Mutex;

pub mod logic;

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

#[cfg(test)]
mod tests {
    pub mod common;
    pub mod timeline_integration;
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
