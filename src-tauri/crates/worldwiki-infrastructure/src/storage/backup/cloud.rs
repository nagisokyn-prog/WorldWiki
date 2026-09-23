//! Cloud backup packaging (.wwiki archive creation).

use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use surrealdb::engine::local::Db;
use surrealdb::Surreal;
use worldwiki_domain::errors::DomainError;
use zip::write::SimpleFileOptions;
use zip::ZipWriter;

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

/// Экспортирует дамп БД в `.surql`, упаковывает его в `.wwiki` (zip)
/// вместе с картинками и настройками, возвращает путь к созданному файлу.
pub async fn create_cloud_backup_inner(
    db: &Surreal<Db>,
    target_dir: &Path,
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

    // 1. Add database dump
    if let Ok(mut dump_file) = fs::File::open(&temp_surql_path) {
        zip.start_file("database.surql", options)
            .map_err(|e| DomainError::Validation(e.to_string()))?;
        std::io::copy(&mut dump_file, &mut zip)
            .map_err(|e| DomainError::Validation(e.to_string()))?;
    }

    // Clean up temporary dump
    if let Err(e) = fs::remove_file(&temp_surql_path) {
        eprintln!("[BACKUP] Temp file remove error: {e}");
    }

    // 2. Add user images (if any)
    let images_dir = env::current_dir()
        .unwrap_or_default()
        .join("data")
        .join("user_images");
    add_directory_files_to_zip(&mut zip, &images_dir, "images", |_| true, options);

    // 3. Add settings files
    let data_dir = env::current_dir().unwrap_or_default().join("data");
    add_directory_files_to_zip(&mut zip, &data_dir, "settings", |name| name.ends_with(".json"), options);

    zip.finish()
        .map_err(|e| DomainError::Validation(format!("Failed to finalize zip: {}", e)))?;

    Ok(zip_path.to_string_lossy().to_string())
}
