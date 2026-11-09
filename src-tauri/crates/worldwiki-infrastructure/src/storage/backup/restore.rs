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

fn clean_bundle_item(mut item: serde_json::Value, table: &str) -> serde_json::Value {
    if let Some(obj) = item.as_object_mut() {
        obj.remove("created_at");
        obj.remove("updated_at");
        obj.remove("saved_at");
        let prefix = format!("{table}:");
        let id_str = match obj.get("id") {
            Some(serde_json::Value::String(s)) => Some(s.clone()),
            Some(serde_json::Value::Object(m)) => {
                if let Some(id_field) = m.get("id") {
                    match id_field {
                        serde_json::Value::String(s) => Some(s.clone()),
                        serde_json::Value::Object(sub_m) => sub_m.values().next().and_then(|v| v.as_str()).map(|s| s.to_string()),
                        _ => Some(id_field.to_string().trim_matches('"').to_string()),
                    }
                } else {
                    None
                }
            }
            _ => None,
        };

        if let Some(s) = id_str {
            let stripped = s.strip_prefix(&prefix).unwrap_or(&s);
            obj.insert("id".to_string(), serde_json::Value::String(stripped.to_string()));
        }
    }
    item
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

    let mut p_content = project.clone();
    if let Some(map) = p_content.as_object_mut() {
        map.remove("id");
        map.remove("created_at");
        map.remove("updated_at");
    }

    // Build atomic transaction script: if any statement errors, SurrealDB automatically aborts transaction
    let mut script = String::new();
    script.push_str("BEGIN TRANSACTION;\n");
    script.push_str("DELETE type::record($pid);\n");
    script.push_str("UPSERT type::record($pid) CONTENT $p_content;\n");

    let mut bindings: Vec<(String, serde_json::Value)> = vec![
        ("pid".to_string(), serde_json::Value::String(proj_id.to_string())),
        ("p_content".to_string(), p_content),
    ];

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

    let mut var_idx = 0;
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
                        .map(|it| clean_bundle_item(it, table))
                        .collect()
                } else {
                    chunk.iter().cloned().map(|it| clean_bundle_item(it, table)).collect()
                };

                if filtered_chunk.is_empty() {
                    continue;
                }

                let var_name = format!("batch_{var_idx}");
                var_idx += 1;
                script.push_str(&format!("INSERT INTO {table} ${var_name};\n"));
                bindings.push((var_name, serde_json::Value::Array(filtered_chunk)));
            }
        }
    }

    let edge_tables = ["contains", "entity_rel", "participates_in", "appears_in"];
    for table in edge_tables {
        if let Some(items) = bundle.get(table).and_then(|v| v.as_array()) {
            if items.is_empty() {
                continue;
            }
            for chunk in items.chunks(500) {
                let cleaned_chunk: Vec<serde_json::Value> =
                    chunk.iter().cloned().map(|it| clean_bundle_item(it, table)).collect();
                let var_name = format!("batch_{var_idx}");
                var_idx += 1;
                script.push_str(&format!("INSERT INTO {table} ${var_name};\n"));
                bindings.push((var_name, serde_json::Value::Array(cleaned_chunk)));
            }
        }
    }

    script.push_str("COMMIT TRANSACTION;\n");

    let mut query = db.query(&script);
    for (k, v) in bindings {
        query = query.bind((k, v));
    }

    let mut res = query
        .await
        .map_err(|e| DomainError::Validation(format!("Restore transaction execution failed: {e}")))?;

    let errors = res.take_errors();
    if !errors.is_empty() {
        return Err(DomainError::Validation(format!("Restore transaction error: {errors:?}")));
    }

    Ok(())
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
            "Invalid backup file: database.surql not found (nor project_bundle.json)".to_string(),
        ));
    }

    let res = if bundle_found && bundle_path.exists() {
        restore_project_bundle(db, &bundle_path).await
    } else {
        let raw_dump = fs::read_to_string(&surql_path)
            .map_err(|e| DomainError::Validation(format!("Failed to read dump: {e}")))?;
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

        if !sanitized.contains("OPTION IMPORT;") {
            sanitized = format!("OPTION IMPORT;\n{}", sanitized);
        }

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
