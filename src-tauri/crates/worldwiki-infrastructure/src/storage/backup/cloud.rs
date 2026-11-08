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

fn get_base_data_dir() -> PathBuf {
    if let Ok(custom_dir) = env::var("SURREAL_DATA_DIR")
        && !custom_dir.is_empty()
    {
        return PathBuf::from(custom_dir);
    }
    env::current_dir().unwrap_or_default().join("data")
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

    // 1. Export database dump and sanitize it for seamless compatibility
    if let Ok(raw_dump) = fs::read_to_string(&temp_surql_path) {
        let sanitized: String = raw_dump
            .lines()
            .filter_map(|line| {
                let t = line.trim_start();
                if t.starts_with("DEFINE FIELD")
                    && t.contains("OVERWRITE")
                    && t.split_whitespace().nth(3).is_some_and(|f| f.ends_with(".*"))
                {
                    return None;
                }
                if t.starts_with("CREATE entity_schemas:default_")
                    || t.starts_with("UPSERT entity_schemas:default_")
                    || t.starts_with("INSERT INTO entity_schemas:default_")
                {
                    return None;
                }
                if let Some(rest) = t.strip_prefix("CREATE ") {
                    let first_token = rest.split_whitespace().next().unwrap_or_default();
                    if first_token.contains(':') {
                        let leading_ws = &line[..line.len() - t.len()];
                        return Some(format!("{leading_ws}UPSERT {rest}"));
                    }
                }
                Some(line.to_string())
            })
            .collect::<Vec<_>>()
            .join("\n");
        let _ = fs::write(&temp_surql_path, sanitized);
    }

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

    // 2. Export scoped project bundle (LPG nodes & edges) if project exists
    if let Ok(mut proj_res) = db.query("SELECT * FROM projects LIMIT 1;").await {
        let projs: Vec<serde_json::Value> = proj_res.take(0).unwrap_or_default();
        if let Some(first_proj) = projs.first()
            && let Some(pid_str) = first_proj.get("id").and_then(|v| v.as_str())
        {
            let bundle_q = r#"
                LET $p_rec = type::record($pid);
                LET $p = (SELECT * FROM ONLY $p_rec);
                LET $vols = (SELECT * FROM volumes WHERE project_id = $p_rec);
                LET $chaps = (SELECT * FROM chapters WHERE volume_id IN $vols.id);
                LET $contains = (SELECT * FROM contains WHERE in = $p_rec OR in IN $vols.id);
                LET $ent_schemas = (SELECT * FROM entity_schemas WHERE project_id = $p_rec AND !id.starts_with('entity_schemas:default_'));
                LET $rel_schemas = (SELECT * FROM relation_schemas WHERE project_id = $p_rec);
                LET $ents = (SELECT * FROM entities WHERE schema_id IN $ent_schemas.id);
                LET $entity_rels = (SELECT * FROM entity_rel WHERE in IN $ents.id AND out IN $ents.id);
                LET $events = (SELECT * FROM timeline_events WHERE project_id = $p_rec);
                LET $part_in = (SELECT * FROM participates_in WHERE in IN $ents.id);
                LET $appears = (SELECT * FROM appears_in WHERE in IN $ents.id);
                LET $planets = (SELECT * FROM planets WHERE project_id = $p_rec);
                LET $cals = (SELECT * FROM calendars WHERE planet_id IN $planets.id);
                RETURN {
                    project: $p,
                    volumes: $vols,
                    chapters: $chaps,
                    contains: $contains,
                    entity_schemas: $ent_schemas,
                    relation_schemas: $rel_schemas,
                    entities: $ents,
                    entity_rel: $entity_rels,
                    timeline_events: $events,
                    participates_in: $part_in,
                    appears_in: $appears,
                    planets: $planets,
                    calendars: $cals
                };
            "#;
            if let Ok(mut b_res) = db.query(bundle_q).bind(("pid", pid_str)).await {
                let bundle_val: Option<serde_json::Value> = b_res.take(0).ok().flatten();
                if let Some(bundle) = bundle_val
                    && let Ok(bundle_bytes) = serde_json::to_vec_pretty(&bundle)
                    && zip.start_file("project_bundle.json", options).is_ok()
                {
                    use std::io::Write;
                    let _ = zip.write_all(&bundle_bytes);
                }
            }
        }
    }

    // 2. Add manifest with media references (instead of bundling heavy media into the archive)
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
    use std::io::Write;
    zip.write_all(&manifest_bytes)
        .map_err(|e| DomainError::Validation(e.to_string()))?;

    // 3. Add settings files
    add_directory_files_to_zip(&mut zip, &base_data_dir, "settings", |name| name.ends_with(".json"), options);

    zip.finish()
        .map_err(|e| DomainError::Validation(format!("Failed to finalize zip: {}", e)))?;

    Ok(zip_path.to_string_lossy().to_string())
}
