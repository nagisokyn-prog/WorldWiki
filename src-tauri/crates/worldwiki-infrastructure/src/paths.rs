use std::path::PathBuf;

/// Returns the default base data directory for the application.
pub fn get_default_data_dir() -> PathBuf {
    std::env::current_dir().unwrap_or_default().join("data")
}

/// Returns the default SurrealDB storage directory.
pub fn get_surreal_db_path() -> PathBuf {
    get_default_data_dir().join("surreal_db")
}

/// Returns the emergency backup file path.
pub fn get_backup_path() -> PathBuf {
    get_default_data_dir().join("backup_latest.surql")
}
