//! Cloud backup restoration (.wwiki archive unpacking and database import).

use std::env;
use std::fs;
use surrealdb::engine::local::Db;
use surrealdb::Surreal;
use worldwiki_domain::errors::DomainError;

use super::bundle_restore::restore_project_bundle;
use super::sanitize::extract_archive_file;

fn sanitize_database_dump(raw_dump: &str) -> String {
    let mut skip_until_semi = false;
    let mut sanitized: String = raw_dump
        .lines()
        .filter_map(|line| {
            let t = line.trim();
            if skip_until_semi {
                if t.ends_with(';') {
                    skip_until_semi = false;
                }
                return None;
            }
            if t.starts_with("DEFINE TABLE")
                || t.starts_with("DEFINE FIELD")
                || t.starts_with("DEFINE INDEX")
                || t.starts_with("DEFINE EVENT")
                || t.starts_with("DEFINE ANALYZER")
                || t.starts_with("DEFINE FUNCTION")
                || t.starts_with("REMOVE TABLE")
                || t.starts_with("REMOVE FIELD")
            {
                if !t.ends_with(';') {
                    skip_until_semi = true;
                }
                return None;
            }
            if t.starts_with("CREATE entity_schemas:default_")
                || t.starts_with("UPSERT entity_schemas:default_")
                || t.starts_with("INSERT INTO entity_schemas:default_")
            {
                if !t.ends_with(';') {
                    skip_until_semi = true;
                }
                return None;
            }
            let trimmed_start = line.trim_start();
            if let Some(rest) = trimmed_start.strip_prefix("CREATE ") {
                let first_token = rest.split_whitespace().next().unwrap_or_default();
                if first_token.contains(':') {
                    let indent_len = line.chars().take_while(|c| c.is_whitespace()).count();
                    let leading_ws: String = line.chars().take(indent_len).collect();
                    return Some(format!("{leading_ws}UPSERT {rest}"));
                }
            }
            Some(line.to_string())
        })
        .collect::<Vec<_>>()
        .join("\n");

    if !sanitized.contains("OPTION IMPORT;") {
        sanitized = format!("OPTION IMPORT;\n{}", sanitized);
    }
    sanitized
}

/// Открывает `.wwiki` (zip), извлекает `database.surql` или `project_bundle.json` и импортирует его в БД.
pub async fn restore_from_backup_inner(
    db: &Surreal<Db>,
    backup_path: &str,
) -> Result<(), DomainError> {
    let path = std::path::Path::new(backup_path);
    if !path.exists() {
        return Err(DomainError::Validation(
            "Backup file does not exist".to_string(),
        ));
    }

    let file = fs::File::open(path)
        .map_err(|e| DomainError::Validation(format!("Failed to open backup: {}", e)))?;
    let mut zip = zip::ZipArchive::new(file)
        .map_err(|e| DomainError::Validation(format!("Failed to read zip: {}", e)))?;

    let temp_dir = env::temp_dir().join(format!(
        "wwiki_restore_{}",
        chrono::Local::now()
            .timestamp_nanos_opt()
            .unwrap_or_default()
    ));
    fs::create_dir_all(&temp_dir).map_err(|e| DomainError::Validation(e.to_string()))?;

    let mut surql_found = false;
    let mut bundle_found = false;
    let bundle_path = temp_dir.join("project_bundle.json");
    let surql_path = temp_dir.join("database.surql");

    for i in 0..zip.len() {
        let mut archive_file = zip
            .by_index(i)
            .map_err(|e| DomainError::Validation(e.to_string()))?;
        let name = archive_file
            .name()
            .map_err(|e| DomainError::Validation(e.to_string()))?
            .to_string();

        if name == "project_bundle.json" {
            bundle_found = true;
        } else if name == "database.surql" {
            surql_found = true;
        }

        let _ = extract_archive_file(&mut archive_file, &name, &temp_dir)?;
    }

    if !bundle_found && !surql_found {
        let _ = fs::remove_dir_all(&temp_dir);
        return Err(DomainError::Validation(
            "Invalid backup file: database.surql not found (nor project_bundle.json)".to_string(),
        ));
    }

    let res = if bundle_found && bundle_path.exists() {
        restore_project_bundle(db, &bundle_path).await
    } else {
        let raw_dump = fs::read_to_string(&surql_path)
            .map_err(|e| DomainError::Validation(format!("Failed to read dump: {e}")))?;
        let sanitized = sanitize_database_dump(&raw_dump);

        fs::write(&surql_path, sanitized)
            .map_err(|e| DomainError::Validation(format!("Failed to write dump: {e}")))?;

        let surql_path_str = surql_path.to_string_lossy().to_string();
        db.import(&surql_path_str)
            .await
            .map_err(|e| DomainError::Validation(format!("Database import failed: {}", e)))
    };

    if let Err(e) = fs::remove_dir_all(&temp_dir) {
        eprintln!("[BACKUP] Temp dir remove error: {e}");
    }

    res
}
