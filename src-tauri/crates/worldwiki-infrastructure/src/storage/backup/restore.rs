//! Cloud backup restoration (.wwiki archive unpacking and database import).

use std::env;
use std::fs;
use surrealdb::engine::local::Db;
use surrealdb::Surreal;
use worldwiki_domain::errors::DomainError;

fn get_base_data_dir() -> std::path::PathBuf {
    if let Ok(custom_dir) = env::var("SURREAL_DATA_DIR")
        && !custom_dir.is_empty()
    {
        return std::path::PathBuf::from(custom_dir);
    }
    env::current_dir().unwrap_or_default().join("data")
}

fn extract_archive_file<R: std::io::Read>(
    file: &mut zip::read::ZipFile<'_, R>,
    file_name: &str,
    temp_dir: &std::path::Path,
) -> Result<bool, DomainError> {
    if file_name == "database.surql" {
        let surql_path = temp_dir.join("database.surql");
        let mut out = fs::File::create(&surql_path)
            .map_err(|e| DomainError::Validation(e.to_string()))?;
        std::io::copy(file, &mut out).map_err(|e| DomainError::Validation(e.to_string()))?;
        return Ok(true);
    }

    if file_name == "manifest.json" {
        let manifest_path = temp_dir.join("manifest.json");
        if let Ok(mut out) = fs::File::create(&manifest_path) {
            let _ = std::io::copy(file, &mut out);
        }
        return Ok(false);
    }
    
    let base_data_dir = get_base_data_dir();
    if let Some(sub) = file_name.strip_prefix("images/") {
        let out_path = base_data_dir
            .join("user_images")
            .join(sub);
        if let Some(p) = out_path.parent() {
            let _ = fs::create_dir_all(p);
        }
        if let Ok(mut out) = fs::File::create(&out_path) {
            let _res = std::io::copy(file, &mut out);
        }
    } else if let Some(sub) = file_name.strip_prefix("settings/") {
        let out_path = base_data_dir
            .join(sub);
        if let Some(p) = out_path.parent() {
            let _ = fs::create_dir_all(p);
        }
        if let Ok(mut out) = fs::File::create(&out_path) {
            let _res = std::io::copy(file, &mut out);
        }
    }

    Ok(false)
}

/// Открывает `.wwiki` (zip), извлекает `database.surql` и импортирует его в БД.
pub async fn restore_from_backup_inner(
    db: &Surreal<Db>,
    backup_path: &str,
) -> Result<(), DomainError> {
    let path = std::path::Path::new(backup_path);
    if !path.exists() {
        return Err(DomainError::Validation("Backup file does not exist".to_string()));
    }

    let file = fs::File::open(path)
        .map_err(|e| DomainError::Validation(format!("Failed to open backup: {}", e)))?;
    let mut zip = zip::ZipArchive::new(file)
        .map_err(|e| DomainError::Validation(format!("Failed to read zip: {}", e)))?;

    let temp_dir = env::temp_dir().join(format!(
        "wwiki_restore_{}",
        chrono::Local::now().timestamp()
    ));
    fs::create_dir_all(&temp_dir).map_err(|e| DomainError::Validation(e.to_string()))?;

    let mut surql_found = false;
    let surql_path = temp_dir.join("database.surql");

    for i in 0..zip.len() {
        let mut archive_file = zip
            .by_index(i)
            .map_err(|e| DomainError::Validation(e.to_string()))?;
        let name = archive_file.name().to_string();

        if extract_archive_file(&mut archive_file, &name, &temp_dir)? {
            surql_found = true;
        }
    }

    if !surql_found {
        return Err(DomainError::Validation(
            "Invalid backup file: database.surql not found".to_string(),
        ));
    }

    let raw_dump = fs::read_to_string(&surql_path)
        .map_err(|e| DomainError::Validation(format!("Failed to read dump: {e}")))?;
    let sanitized: String = raw_dump
        .lines()
        .filter(|line| {
            let t = line.trim_start();
            !(t.starts_with("DEFINE FIELD")
                && t.contains("OVERWRITE")
                && t.split_whitespace().nth(3).is_some_and(|f| f.ends_with(".*")))
        })
        .collect::<Vec<_>>()
        .join("\n");
    fs::write(&surql_path, sanitized)
        .map_err(|e| DomainError::Validation(format!("Failed to write dump: {e}")))?;

    let surql_path_str = surql_path.to_string_lossy().to_string();
    db.import(&surql_path_str)
        .await
        .map_err(|e| DomainError::Validation(format!("Database import failed: {}", e)))?;

    if let Err(e) = fs::remove_dir_all(&temp_dir) {
        eprintln!("[BACKUP] Temp dir remove error: {e}");
    }

    Ok(())
}
