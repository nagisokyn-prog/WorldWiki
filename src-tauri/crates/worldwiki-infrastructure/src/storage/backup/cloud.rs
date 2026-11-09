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
        let mut skip_until_semi = false;
        let sanitized: String = raw_dump
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
                if let Some(rest) = line.trim_start().strip_prefix("CREATE ") {
                    let first_token = rest.split_whitespace().next().unwrap_or_default();
                    if first_token.contains(':') {
                        let leading_ws = &line[..line.len() - line.trim_start().len()];
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
    if let Ok(mut proj_res) = db.query("SELECT *, type::string(id) AS id_str FROM projects ORDER BY id ASC LIMIT 1;").await {
        let projs: Vec<serde_json::Value> = proj_res.take(0).unwrap_or_default();
        if let Some(first_proj) = projs.first() {
            let pid_opt = first_proj
                .get("id_str")
                .and_then(|v| v.as_str())
                .or_else(|| first_proj.get("id").and_then(|v| v.as_str()))
                .map(|s| s.to_string())
                .or_else(|| {
                    first_proj.get("id").and_then(|id_obj| {
                        if let Some(tb) = id_obj.get("tb").and_then(|v| v.as_str()) {
                            let id_val = id_obj.get("id")?;
                            let id_s = id_val.as_str().map(|s| s.to_string()).unwrap_or_else(|| id_val.to_string().trim_matches('"').to_string());
                            Some(format!("{tb}:{id_s}"))
                        } else {
                            None
                        }
                    })
                });

            if let Some(pid_str) = pid_opt {
                let p_rec = pid_str.as_str();

                // 1. Volumes
                let mut v_res = db
                    .query("SELECT *, type::string(id) AS id FROM volumes WHERE project_id = fn::normalize_project_id($pid);")
                    .bind(("pid", p_rec))
                    .await
                    .ok();
                let volumes: Vec<serde_json::Value> = v_res.as_mut().and_then(|r| r.take(0).ok()).unwrap_or_default();
                let vol_ids: Vec<serde_json::Value> = volumes.iter().filter_map(|v| v.get("id")).cloned().collect();

                // 2. Chapters
                let mut ch_res = db
                    .query("SELECT *, type::string(id) AS id, type::string(volume_id) AS volume_id FROM chapters WHERE volume_id.project_id = fn::normalize_project_id($pid) OR volume_id IN $vols;")
                    .bind(("pid", p_rec))
                    .bind(("vols", vol_ids.clone()))
                    .await
                    .ok();
                let chapters: Vec<serde_json::Value> = ch_res.as_mut().and_then(|r| r.take(0).ok()).unwrap_or_default();

                // 3. Contains
                let mut c_res = db
                    .query("SELECT * FROM contains WHERE in = type::record($pid) OR in IN $vols;")
                    .bind(("pid", p_rec))
                    .bind(("vols", vol_ids))
                    .await
                    .ok();
                let contains: Vec<serde_json::Value> = c_res.as_mut().and_then(|r| r.take(0).ok()).unwrap_or_default();

                // 4. Entity Schemas
                let mut es_res = db
                    .query("SELECT * FROM entity_schemas WHERE project_id = fn::normalize_project_id($pid) AND string::starts_with(type::string(id), 'entity_schemas:default_') = false;")
                    .bind(("pid", p_rec))
                    .await
                    .ok();
                let entity_schemas: Vec<serde_json::Value> = es_res.as_mut().and_then(|r| r.take(0).ok()).unwrap_or_default();
                let schema_ids: Vec<serde_json::Value> = entity_schemas.iter().filter_map(|s| s.get("id")).cloned().collect();

                // 5. Relation Schemas
                let mut rs_res = db
                    .query("SELECT * FROM relation_schemas WHERE project_id = fn::normalize_project_id($pid);")
                    .bind(("pid", p_rec))
                    .await
                    .ok();
                let relation_schemas: Vec<serde_json::Value> = rs_res.as_mut().and_then(|r| r.take(0).ok()).unwrap_or_default();

                // 6. Entities
                let mut e_res = db
                    .query("SELECT * FROM entities WHERE schema_id.project_id = fn::normalize_project_id($pid) OR schema_id IN $schemas;")
                    .bind(("pid", p_rec))
                    .bind(("schemas", schema_ids))
                    .await
                    .ok();
                let entities: Vec<serde_json::Value> = e_res.as_mut().and_then(|r| r.take(0).ok()).unwrap_or_default();
                let ent_ids: Vec<serde_json::Value> = entities.iter().filter_map(|e| e.get("id")).cloned().collect();

                // 7. Entity Rel (strictly between entities of this project)
                let mut er_res = db
                    .query("SELECT * FROM entity_rel WHERE in IN $ents AND out IN $ents;")
                    .bind(("ents", ent_ids.clone()))
                    .await
                    .ok();
                let entity_rel: Vec<serde_json::Value> = er_res.as_mut().and_then(|r| r.take(0).ok()).unwrap_or_default();

                // 8. Timeline Events
                let mut te_res = db
                    .query("SELECT * FROM timeline_events WHERE project_id = fn::normalize_project_id($pid);")
                    .bind(("pid", p_rec))
                    .await
                    .ok();
                let timeline_events: Vec<serde_json::Value> = te_res.as_mut().and_then(|r| r.take(0).ok()).unwrap_or_default();

                // 9. Participates in
                let mut pi_res = db
                    .query("SELECT * FROM participates_in WHERE in IN $ents;")
                    .bind(("ents", ent_ids.clone()))
                    .await
                    .ok();
                let participates_in: Vec<serde_json::Value> = pi_res.as_mut().and_then(|r| r.take(0).ok()).unwrap_or_default();

                // 10. Appears in
                let mut ai_res = db
                    .query("SELECT * FROM appears_in WHERE in IN $ents;")
                    .bind(("ents", ent_ids))
                    .await
                    .ok();
                let appears_in: Vec<serde_json::Value> = ai_res.as_mut().and_then(|r| r.take(0).ok()).unwrap_or_default();

                // 11. Planets
                let mut pl_res = db
                    .query("SELECT * FROM planets WHERE project_id = fn::normalize_project_id($pid);")
                    .bind(("pid", p_rec))
                    .await
                    .ok();
                let planets: Vec<serde_json::Value> = pl_res.as_mut().and_then(|r| r.take(0).ok()).unwrap_or_default();
                let planet_ids: Vec<serde_json::Value> = planets.iter().filter_map(|p| p.get("id")).cloned().collect();

                // 12. Calendars
                let mut cal_res = db
                    .query("SELECT * FROM calendars WHERE planet_id IN $planets;")
                    .bind(("planets", planet_ids))
                    .await
                    .ok();
                let calendars: Vec<serde_json::Value> = cal_res.as_mut().and_then(|r| r.take(0).ok()).unwrap_or_default();

                let mut clean_project = first_proj.clone();
                if let Some(map) = clean_project.as_object_mut() {
                    map.remove("id_str");
                }

                let bundle = serde_json::json!({
                    "project": clean_project,
                    "volumes": volumes,
                    "chapters": chapters,
                    "contains": contains,
                    "entity_schemas": entity_schemas,
                    "relation_schemas": relation_schemas,
                    "entities": entities,
                    "entity_rel": entity_rel,
                    "timeline_events": timeline_events,
                    "participates_in": participates_in,
                    "appears_in": appears_in,
                    "planets": planets,
                    "calendars": calendars,
                });

                if let Ok(bundle_bytes) = serde_json::to_vec_pretty(&bundle)
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
