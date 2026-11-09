//! Auxiliary sanitization and record ID helpers for backup and restore.

use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use surrealdb::Surreal;
use surrealdb::engine::local::Db;
use worldwiki_domain::errors::DomainError;

pub(crate) fn get_base_data_dir() -> PathBuf {
    if let Ok(custom_dir) = env::var("SURREAL_DATA_DIR")
        && !custom_dir.is_empty()
    {
        return PathBuf::from(custom_dir);
    }
    env::current_dir().unwrap_or_default().join("data")
}

pub(crate) fn extract_archive_file<R: std::io::Read>(
    file: &mut zip::read::ZipFile<'_, R>,
    file_name: &str,
    temp_dir: &Path,
) -> Result<bool, DomainError> {
    if file_name == "project_bundle.json" {
        let bundle_path = temp_dir.join("project_bundle.json");
        let mut out =
            fs::File::create(&bundle_path).map_err(|e| DomainError::Validation(e.to_string()))?;
        std::io::copy(file, &mut out).map_err(|e| DomainError::Validation(e.to_string()))?;
        return Ok(true);
    }

    if file_name == "database.surql" {
        let surql_path = temp_dir.join("database.surql");
        let mut out =
            fs::File::create(&surql_path).map_err(|e| DomainError::Validation(e.to_string()))?;
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
        let out_path = base_data_dir.join("user_images").join(sub);
        if let Some(p) = out_path.parent() {
            let _ = fs::create_dir_all(p);
        }
        if let Ok(mut out) = fs::File::create(&out_path) {
            let _res = std::io::copy(file, &mut out);
        }
    } else if let Some(sub) = file_name.strip_prefix("settings/") {
        let out_path = base_data_dir.join(sub);
        if let Some(p) = out_path.parent() {
            let _ = fs::create_dir_all(p);
        }
        if let Ok(mut out) = fs::File::create(&out_path) {
            let _res = std::io::copy(file, &mut out);
        }
    }

    Ok(false)
}

pub(crate) fn flatten_record_id(v: &serde_json::Value) -> Option<String> {
    if let Some(s) = v.as_str() {
        return Some(s.to_string());
    }
    if let Some(obj) = v.as_object()
        && let (Some(tb), Some(id_val)) = (obj.get("tb").and_then(|t| t.as_str()), obj.get("id"))
    {
        let id_str = match id_val {
            serde_json::Value::String(s) => s.clone(),
            serde_json::Value::Object(sub_m) => sub_m
                .values()
                .next()
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            _ => id_val.to_string().trim_matches('"').to_string(),
        };
        if !id_str.is_empty() {
            return Some(format!("{tb}:{id_str}"));
        }
    }
    None
}

pub(crate) fn clean_bundle_id_to_record_str(raw: &str) -> String {
    let raw = raw.trim();
    if let Some((tb, key)) = raw.split_once(':') {
        let clean_key = key.trim_matches(['⟨', '⟩', '`', '"', '\'']);
        format!("{tb}:⟨{clean_key}⟩")
    } else {
        raw.to_string()
    }
}

pub(crate) async fn node_exists_in_db(db: &Surreal<Db>, rec_str: &str) -> bool {
    let q = db
        .query("SELECT id FROM ONLY type::record($rec);")
        .bind(("rec", rec_str.to_string()));
    if let Ok(mut res) = q.await
        && res.take_errors().is_empty()
        && let Ok(row) = res.take::<Option<serde_json::Value>>(0)
    {
        return row.is_some();
    }
    false
}

pub(crate) fn clean_bundle_item(mut item: serde_json::Value, table: &str) -> serde_json::Value {
    if let Some(obj) = item.as_object_mut() {
        // Strip datetime fields so SurrealDB uses its native DEFAULT time::now()
        // and avoids String -> Datetime coercion failures in MERGE payloads.
        obj.remove("created_at");
        obj.remove("updated_at");
        obj.remove("saved_at");

        let prefix = format!("{table}:");
        let id_str = obj.get("id").and_then(flatten_record_id);

        if let Some(s) = id_str {
            let stripped = s.strip_prefix(&prefix).unwrap_or(&s);
            let clean_val = stripped.trim_matches(['⟨', '⟩', '`', '"', '\'']);
            obj.insert(
                "id".to_string(),
                serde_json::Value::String(clean_val.to_string()),
            );
        }

        // Flatten any nested RecordId objects in other fields (e.g. volume_id, project_id, schema_id, in, out)
        for (k, val) in obj.iter_mut() {
            if k == "id" {
                continue;
            }
            if val.is_object()
                && let Some(flat) = flatten_record_id(val)
            {
                *val = serde_json::Value::String(flat);
            }
        }
    }
    item
}

