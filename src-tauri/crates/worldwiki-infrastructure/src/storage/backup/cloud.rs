//! Cloud backup packaging (.wwiki archive creation).

use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use surrealdb::engine::local::Db;
use surrealdb::Surreal;
use worldwiki_domain::errors::DomainError;
use zip::write::SimpleFileOptions;
use zip::ZipWriter;

use super::bundle_export::export_project_bundle;
use super::sanitize::get_base_data_dir;

fn copy_file_to_zip(
    zip: &mut ZipWriter<fs::File>,
    path: &Path,
    zip_entry_name: &str,
    options: SimpleFileOptions,
) -> std::io::Result<()> {
    if let Ok(mut src_file) = fs::File::open(path) {
        zip.start_file(zip_entry_name, options)
            .map_err(std::io::Error::other)?;
        std::io::copy(&mut src_file, zip)?;
    }
    Ok(())
}

fn add_directory_files_to_zip<F>(
    zip: &mut ZipWriter<fs::File>,
    dir: &Path,
    prefix: &str,
    filter: F,
    options: SimpleFileOptions,
) where
    F: Fn(&str) -> bool,
{
    if !dir.exists() {
        return;
    }
    let entries: Vec<PathBuf> = match fs::read_dir(dir) {
        Ok(read_dir) => read_dir
            .filter_map(Result::ok)
            .filter_map(|e| {
                let p = e.path();
                if p.is_file() {
                    Some(p)
                } else {
                    None
                }
            })
            .collect(),
        Err(_) => return,
    };

    for path in entries {
        let fname = path
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or_default();
        if !filter(fname) {
            continue;
        }
        let zip_entry_name = format!("{}/{}", prefix, fname);
        let _ = copy_file_to_zip(zip, &path, &zip_entry_name, options);
    }
}

fn sanitize_surql_dump(raw_dump: &str) -> String {
    let mut skip_until_semi = false;
    raw_dump
        .lines()
        .filter_map(|line| {
            let t = line.trim();
            if skip_until_semi {
                if t.ends_with(';') {
                    skip_until_semi = false;
                }
                return None;
            }
            if t.starts_with("DEFINE FIELD")
                && t.contains("OVERWRITE")
                && t.split_whitespace().nth(3).is_some_and(|f| f.ends_with(".*"))
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
        .join("\n")
}

/// Экспортирует дамп БД в `.surql`, упаковывает его в `.wwiki` (zip)
/// вместе с картинками и настройками, возвращает путь к созданному файлу.
pub async fn create_cloud_backup_inner(
    db: &Surreal<Db>,
    target_dir: &Path,
    project_id: Option<&str>,
) -> Result<String, DomainError> {
    fs::create_dir_all(target_dir).map_err(|e| DomainError::Validation(e.to_string()))?;

    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S").to_string();
    let temp_surql_path = target_dir.join(format!("backup_{}.surql", timestamp));

    let surql_path_str = temp_surql_path.to_string_lossy().to_string();
    db.export(&surql_path_str)
        .await
        .map_err(|e| DomainError::Validation(e.to_string()))?;

    let zip_path = target_dir.join(format!("WorldWiki_Backup_{}.wwiki", timestamp));
    let file = fs::File::create(&zip_path)
        .map_err(|e| DomainError::Validation(format!("Failed to create zip file: {}", e)))?;
    let mut zip = ZipWriter::new(file);

    let options = SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    // 1. Export database dump and sanitize it for seamless compatibility
    if let Ok(raw_dump) = fs::read_to_string(&temp_surql_path) {
        let sanitized = sanitize_surql_dump(&raw_dump);
        fs::write(&temp_surql_path, sanitized)
            .map_err(|e| DomainError::Validation(format!("Failed to write sanitized dump: {e}")))?;
    }

    if let Ok(mut dump_file) = fs::File::open(&temp_surql_path) {
        zip.start_file("database.surql", options)
            .map_err(|e| DomainError::Validation(e.to_string()))?;
        std::io::copy(&mut dump_file, &mut zip)
            .map_err(|e| DomainError::Validation(e.to_string()))?;
    }

    if let Err(e) = fs::remove_file(&temp_surql_path) {
        eprintln!("[BACKUP] Temp file remove error: {e}");
    }

    // 2. Export scoped project bundle (LPG nodes & edges)
    if let Some(bundle) = export_project_bundle(db, project_id).await? {
        let bundle_bytes = serde_json::to_vec_pretty(&bundle)
            .map_err(|e| DomainError::Validation(format!("Failed to serialize bundle: {e}")))?;
        zip.start_file("project_bundle.json", options)
            .map_err(|e| DomainError::Validation(format!("Failed to start project_bundle.json in zip: {e}")))?;
        zip.write_all(&bundle_bytes)
            .map_err(|e| DomainError::Validation(format!("Failed to write bundle into zip: {e}")))?;
    }

    // 3. Add manifest with media references
    let base_data_dir = get_base_data_dir();
    let images_dir = base_data_dir.join("user_images");
    let mut media_files = Vec::new();
    if let Ok(entries) = fs::read_dir(&images_dir) {
        for entry in entries.flatten() {
            if entry.path().is_file()
                && let Some(name) = entry.file_name().to_str()
            {
                media_files.push(name.to_string());
            }
        }
    }
    media_files.sort();

    let manifest = serde_json::json!({
        "version": "0.85.0",
        "created_at": chrono::Local::now().to_rfc3339(),
        "media_files": media_files
    });
    let manifest_bytes = serde_json::to_vec_pretty(&manifest).unwrap_or_default();
    zip.start_file("manifest.json", options)
        .map_err(|e| DomainError::Validation(e.to_string()))?;
    zip.write_all(&manifest_bytes)
        .map_err(|e| DomainError::Validation(e.to_string()))?;

    // 4. Add settings files
    add_directory_files_to_zip(&mut zip, &base_data_dir, "settings", |name| name.ends_with(".json"), options);

    zip.finish()
        .map_err(|e| DomainError::Validation(format!("Failed to finalize zip: {}", e)))?;

    Ok(zip_path.to_string_lossy().to_string())
}
