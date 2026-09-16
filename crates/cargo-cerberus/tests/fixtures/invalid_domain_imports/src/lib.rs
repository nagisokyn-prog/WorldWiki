// Test fixture: Invalid domain imports
use tauri::AppHandle;
use tokio::sync::mpsc;
use surrealdb::Surreal;

pub struct DomainEntity {
    pub id: String,
}
