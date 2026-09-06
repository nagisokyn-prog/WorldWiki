use serde_json::Value;
use std::env;
use std::fs;
use std::io::Write;
use std::path::Path;
use surrealdb::engine::local::Db;
use surrealdb::Surreal;

/// Пишет объединённые главы в `exported_chapters.<format>` внутри `target_dir`.
pub fn export_chapters_inner(
    target_dir: &Path,
    chapters: &[Value],
    format: &str,
) -> Result<String, String> {
    fs::create_dir_all(target_dir).map_err(|e| e.to_string())?;

    let file_path = target_dir.join(format!("exported_chapters.{}", format));
    let mut combined_content = String::new();

    for chapter in chapters {
        let title = chapter
            .get("title")
            .and_then(|v| v.as_str())
            .unwrap_or("Без названия");
        let content = chapter
            .get("content")
            .and_then(|v| v.as_str())
            .unwrap_or("");

        combined_content.push_str(&format!("\n\n=== {} ===\n\n{}\n", title, content));
    }

    fs::write(&file_path, combined_content).map_err(|e| e.to_string())?;

    Ok(file_path.to_string_lossy().to_string())
}

/// Экспортирует дамп БД в `.surql`, упаковывает его в `.wwiki` (zip)
/// вместе с картинками и настройками, возвращает путь к созданному файлу.
pub async fn create_cloud_backup_inner(
    db: &Surreal<Db>,
    target_dir: &Path,
) -> Result<String, String> {
    fs::create_dir_all(target_dir).map_err(|e| e.to_string())?;

    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S").to_string();
    let temp_surql_path = target_dir.join(format!("backup_{}.surql", timestamp));

    // In SurrealDB v3, exporting to a file
    db.export(temp_surql_path.to_str().unwrap())
        .await
        .map_err(|e| e.to_string())?;

    let zip_path = target_dir.join(format!("WorldWiki_Backup_{}.wwiki", timestamp));
    let file =
        fs::File::create(&zip_path).map_err(|e| format!("Failed to create zip file: {}", e))?;
    let mut zip = zip::ZipWriter::new(file);

    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    // 1. Add database dump
    if let Ok(dump_content) = fs::read(&temp_surql_path) {
        zip.start_file("database.surql", options)
            .map_err(|e| e.to_string())?;
        zip.write_all(&dump_content).map_err(|e| e.to_string())?;
    }

    // Clean up temporary dump
    let _ = fs::remove_file(&temp_surql_path);

    // 2. Add user images (if any)
    let images_dir = env::current_dir()
        .unwrap_or_default()
        .join("data")
        .join("user_images");
    if images_dir.exists() {
        if let Ok(entries) = fs::read_dir(&images_dir) {
            for entry in entries.filter_map(Result::ok) {
                if let Ok(file_type) = entry.file_type() {
                    if file_type.is_file() {
                        if let Ok(content) = fs::read(entry.path()) {
                            let name = format!("images/{}", entry.file_name().to_string_lossy());
                            if zip.start_file(name, options).is_ok() {
                                let _ = zip.write_all(&content);
                            }
                        }
                    }
                }
            }
        }
    }

    // 3. Add settings files
    let data_dir = env::current_dir().unwrap_or_default().join("data");
    if let Ok(entries) = fs::read_dir(&data_dir) {
        for entry in entries.filter_map(Result::ok) {
            if entry.file_name().to_string_lossy().ends_with(".json") {
                if let Ok(content) = fs::read(entry.path()) {
                    let name = format!("settings/{}", entry.file_name().to_string_lossy());
                    if zip.start_file(name, options).is_ok() {
                        let _ = zip.write_all(&content);
                    }
                }
            }
        }
    }

    zip.finish()
        .map_err(|e| format!("Failed to finalize zip: {}", e))?;

    Ok(zip_path.to_string_lossy().to_string())
}

/// Открывает `.wwiki` (zip), извлекает `database.surql` и импортирует его в БД.
pub async fn restore_from_backup_inner(
    db: &Surreal<Db>,
    backup_path: &str,
) -> Result<(), String> {
    let path = std::path::Path::new(backup_path);
    if !path.exists() {
        return Err("Backup file does not exist".to_string());
    }

    let file = fs::File::open(path).map_err(|e| format!("Failed to open backup: {}", e))?;
    let mut zip = zip::ZipArchive::new(file).map_err(|e| format!("Failed to read zip: {}", e))?;

    let temp_dir = env::temp_dir().join(format!(
        "wwiki_restore_{}",
        chrono::Local::now().timestamp()
    ));
    fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;

    // 1. Extract database.surql
    let mut surql_found = false;
    let surql_path = temp_dir.join("database.surql");

    for i in 0..zip.len() {
        let mut file = zip.by_index(i).map_err(|e| e.to_string())?;
        let file_name = file.name().to_string();

        if file_name == "database.surql" {
            let mut out = fs::File::create(&surql_path).map_err(|e| e.to_string())?;
            std::io::copy(&mut file, &mut out).map_err(|e| e.to_string())?;
            surql_found = true;
        } else if file_name.starts_with("images/") {
            let out_path = env::current_dir()
                .unwrap_or_default()
                .join("data")
                .join("user_images")
                .join(file_name.trim_start_matches("images/"));
            if let Some(p) = out_path.parent() {
                fs::create_dir_all(p).ok();
            }
            if let Ok(mut out) = fs::File::create(&out_path) {
                std::io::copy(&mut file, &mut out).ok();
            }
        } else if file_name.starts_with("settings/") {
            let out_path = env::current_dir()
                .unwrap_or_default()
                .join("data")
                .join(file_name.trim_start_matches("settings/"));
            if let Some(p) = out_path.parent() {
                fs::create_dir_all(p).ok();
            }
            if let Ok(mut out) = fs::File::create(&out_path) {
                std::io::copy(&mut file, &mut out).ok();
            }
        }
    }

    if !surql_found {
        return Err("Invalid backup file: database.surql not found".to_string());
    }

    let raw_dump = fs::read_to_string(&surql_path)
        .map_err(|e| format!("Failed to read dump: {e}"))?;
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
    fs::write(&surql_path, sanitized).map_err(|e| format!("Failed to write dump: {e}"))?;

    db.import(surql_path.to_str().unwrap())
        .await
        .map_err(|e| format!("Database import failed: {}", e))?;

    let _ = fs::remove_dir_all(temp_dir);

    Ok(())
}
