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
    if file_name == "project_bundle.json" {
        let bundle_path = temp_dir.join("project_bundle.json");
        let mut out = fs::File::create(&bundle_path)
            .map_err(|e| DomainError::Validation(e.to_string()))?;
        std::io::copy(file, &mut out).map_err(|e| DomainError::Validation(e.to_string()))?;
        return Ok(true);
    }

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

async fn restore_project_bundle(
    db: &Surreal<Db>,
    bundle_path: &std::path::Path,
) -> Result<(), DomainError> {
    let raw = fs::read_to_string(bundle_path)
        .map_err(|e| DomainError::Validation(format!("Failed to read project_bundle.json: {e}")))?;
    let bundle: serde_json::Value = serde_json::from_str(&raw)
        .map_err(|e| DomainError::Validation(format!("Invalid project_bundle.json: {e}")))?;

    let project = bundle.get("project").ok_or_else(|| {
        DomainError::Validation("project_bundle.json missing 'project'".to_string())
    })?;
    let proj_id = project.get("id").and_then(|v| v.as_str()).ok_or_else(|| {
        DomainError::Validation("Project missing id in bundle".to_string())
    })?;

    // 1. Begin transaction for 100% ACID atomicity
    let mut tx_res = db
        .query("BEGIN TRANSACTION;")
        .await
        .map_err(|e| DomainError::Validation(format!("Failed to begin transaction: {e}")))?;
    let _ = tx_res.take_errors();

    let restore_ops = async {
        // 2. Cascade delete existing project data safely (triggers cascade_project_delete)
        let del_q = "DELETE type::record($pid);";
        let mut del_res = db
            .query(del_q)
            .bind(("pid", proj_id))
            .await
            .map_err(|e| DomainError::Validation(format!("Delete project failed: {e}")))?;
        let errors = del_res.take_errors();
        if !errors.is_empty() {
            return Err(DomainError::Validation(format!("Cascade delete error: {errors:?}")));
        }

        // 3. Upsert project itself
        let p_q = "UPSERT type::record($pid) CONTENT $content;";
        let mut p_res = db
            .query(p_q)
            .bind(("pid", proj_id))
            .bind(("content", project.clone()))
            .await
            .map_err(|e| DomainError::Validation(format!("Upsert project failed: {e}")))?;
        let errors = p_res.take_errors();
        if !errors.is_empty() {
            return Err(DomainError::Validation(format!("Project upsert error: {errors:?}")));
        }

        // 4. Batch insert nodes (chunks of 500)
        let node_tables = [
            "volumes",
            "chapters",
            "entity_schemas",
            "entities",
            "timeline_events",
            "story_arcs",
            "planets",
            "calendars",
            "atlases",
            "relation_schemas",
        ];

        for table in node_tables {
            if let Some(items) = bundle.get(table).and_then(|v| v.as_array()) {
                if items.is_empty() {
                    continue;
                }
                for chunk in items.chunks(500) {
                    let filtered_chunk: Vec<serde_json::Value> = if table == "entity_schemas" {
                        chunk
                            .iter()
                            .filter(|item| {
                                let id = item.get("id").and_then(|v| v.as_str()).unwrap_or_default();
                                !id.starts_with("entity_schemas:default_")
                            })
                            .cloned()
                            .collect()
                    } else {
                        chunk.to_vec()
                    };

                    if filtered_chunk.is_empty() {
                        continue;
                    }

                    let ins_q = "INSERT INTO type::table($table) $batch;";
                    let mut ins_res = db
                        .query(ins_q)
                        .bind(("table", table))
                        .bind(("batch", filtered_chunk))
                        .await
                        .map_err(|e| DomainError::Validation(format!("Insert {table} failed: {e}")))?;
                    let errors = ins_res.take_errors();
                    if !errors.is_empty() {
                        return Err(DomainError::Validation(format!("Insert {table} error: {errors:?}")));
                    }
                }
            }
        }

        // 5. Batch insert edges with preserved IDs and relations
        let edge_tables = ["contains", "entity_rel", "participates_in", "appears_in"];
        for table in edge_tables {
            if let Some(items) = bundle.get(table).and_then(|v| v.as_array()) {
                if items.is_empty() {
                    continue;
                }
                for chunk in items.chunks(500) {
                    let ins_q = "INSERT INTO type::table($table) $batch;";
                    let mut ins_res = db
                        .query(ins_q)
                        .bind(("table", table))
                        .bind(("batch", chunk.to_vec()))
                        .await
                        .map_err(|e| DomainError::Validation(format!("Insert edge {table} failed: {e}")))?;
                    let errors = ins_res.take_errors();
                    if !errors.is_empty() {
                        return Err(DomainError::Validation(format!("Insert edge {table} error: {errors:?}")));
                    }
                }
            }
        }

        Ok::<(), DomainError>(())
    }
    .await;

    match restore_ops {
        Ok(()) => {
            let mut commit_res = db
                .query("COMMIT TRANSACTION;")
                .await
                .map_err(|e| DomainError::Validation(format!("Commit failed: {e}")))?;
            let errors = commit_res.take_errors();
            if !errors.is_empty() {
                return Err(DomainError::Validation(format!("Commit transaction error: {errors:?}")));
            }
            Ok(())
        }
        Err(e) => {
            let _ = db.query("CANCEL TRANSACTION;").await;
            Err(e)
        }
    }
}

/// Открывает `.wwiki` (zip), извлекает `database.surql` или `project_bundle.json` и импортирует его в БД.
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
        chrono::Local::now().timestamp_nanos_opt().unwrap_or_default()
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
            "Invalid backup file: neither project_bundle.json nor database.surql found".to_string(),
        ));
    }

    let res = if bundle_found && bundle_path.exists() {
        restore_project_bundle(db, &bundle_path).await
    } else {
        let raw_dump = fs::read_to_string(&surql_path)
            .map_err(|e| DomainError::Validation(format!("Failed to read dump: {e}")))?;
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
