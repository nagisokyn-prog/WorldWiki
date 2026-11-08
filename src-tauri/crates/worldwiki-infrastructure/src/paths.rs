use std::path::PathBuf;

/// Returns the base data directory for the application.
/// Priority:
/// 1. SURREAL_DATA_DIR environment variable (custom override).
/// 2. If running inside development `target/` directory -> project root `data/`.
/// 3. Standard OS AppData: `%APPDATA%/com.worldwiki.app/data` (Windows) / `~/.local/share/com.worldwiki.app/data`.
/// 4. Fallback to current working directory `data/`.
pub fn get_default_data_dir() -> PathBuf {
    match std::env::var("SURREAL_DATA_DIR") {
        Ok(custom) if !custom.trim().is_empty() => return PathBuf::from(custom),
        _ => {}
    }

    if let Ok(exe) = std::env::current_exe() {
        let mut curr = exe.parent();
        while let Some(dir) = curr {
            match (dir.file_name(), dir.parent()) {
                (Some(name), Some(root)) if name == "target" => return root.join("data"),
                _ => {}
            }
            curr = dir.parent();
        }
    }

    #[cfg(target_os = "windows")]
    if let Some(appdata) = std::env::var_os("APPDATA") {
        return PathBuf::from(appdata).join("com.worldwiki.app").join("data");
    }

    #[cfg(not(target_os = "windows"))]
    if let Some(data_home) = std::env::var_os("XDG_DATA_HOME") {
        return PathBuf::from(data_home).join("com.worldwiki.app").join("data");
    } else if let Some(home) = std::env::var_os("HOME") {
        return PathBuf::from(home).join(".local").join("share").join("com.worldwiki.app").join("data");
    }

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
