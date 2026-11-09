use std::fs;
use surrealdb::Surreal;
use surrealdb::engine::local::{Db, SurrealKv};
use worldwiki_domain::errors::DomainError;

pub use super::schema_catalog::*;

pub async fn deduplicate_entity_schemas(db: &Surreal<Db>) {
    let q = "SELECT id, project_id, type_key, full_schema FROM entity_schemas;";
    if let Ok(mut res) = db.query(q).await {
        if !res.take_errors().is_empty() {
            return;
        }
        let rows: Vec<serde_json::Value> = match res.take(0) {
            Ok(r) => r,
            Err(_) => return,
        };
        let mut seen = std::collections::HashSet::new();
        let mut to_delete = Vec::new();

        let mut sorted_rows = rows;
        sorted_rows.sort_by(|a, b| {
            let a_has_full = a.get("full_schema").is_some_and(|v| !v.is_null());
            let b_has_full = b.get("full_schema").is_some_and(|v| !v.is_null());
            b_has_full.cmp(&a_has_full)
        });

        for row in sorted_rows {
            let pid = row
                .get("project_id")
                .map(|v| v.to_string())
                .unwrap_or_default();
            let tk = row
                .get("type_key")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let id = row
                .get("id")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            if pid.is_empty() || tk.is_empty() || id.is_empty() {
                continue;
            }

            let key = (pid, tk);
            if seen.contains(&key) {
                to_delete.push(id);
            } else {
                seen.insert(key);
            }
        }

        for id_str in to_delete {
            let clean_id = id_str.strip_prefix("entity_schemas:").unwrap_or(&id_str);
            let del_q = "DELETE type::record('entity_schemas', $id)";
            let _ = db.query(del_q).bind(("id", clean_id)).await;
        }
    }
}

pub async fn sync_builtin_entity_schemas(db: &Surreal<Db>) {
    for (type_key, raw_json) in CORE_ENTITY_SCHEMAS {
        if let Ok(full_val) = serde_json::from_str::<serde_json::Value>(raw_json) {
            let q = "UPDATE entity_schemas SET full_schema = $full WHERE type_key = $tk";
            match db
                .query(q)
                .bind(("full", full_val))
                .bind(("tk", *type_key))
                .await
            {
                Ok(mut res) => {
                    let errors = res.take_errors();
                    if !errors.is_empty() {
                        eprintln!(
                            "[DB WARNING] Statement error syncing builtin entity schema '{}': {:?}",
                            type_key, errors
                        );
                    }
                }
                Err(e) => {
                    eprintln!(
                        "[DB WARNING] Failed to sync builtin entity schema '{}': {}",
                        type_key, e
                    );
                }
            }
        }
    }
    println!("[DB] Builtin JSON entity schemas synchronized across existing projects.");
}

pub async fn init_database() -> Result<Surreal<Db>, Box<dyn std::error::Error>> {
    let db_path = worldwiki_infrastructure::paths::get_surreal_db_path();
    let _ = fs::create_dir_all(&db_path);
    let db = match Surreal::new::<SurrealKv>(db_path).await {
        Ok(d) => d,
        Err(e) => {
            eprintln!("[CRITICAL] Failed to start SurrealDB engine: {}", e);
            return Err(Box::new(e));
        }
    };
    if let Err(e) = db.use_ns("worldwriter").use_db("worldwriter").await {
        eprintln!(
            "[CRITICAL] Failed to use namespace/database 'worldwriter': {}",
            e
        );
        return Err(Box::new(e));
    }

    let current_hash = compute_schema_hash();
    let is_up_to_date = match db
        .query("SELECT ddl_hash FROM type::record('system_meta', 'schema_version')")
        .await
    {
        Ok(mut res) => {
            let opt_row: Result<Option<serde_json::Value>, _> = res.take(0);
            match opt_row {
                Ok(Some(row)) => {
                    row.get("ddl_hash").and_then(|v| v.as_str()) == Some(&current_hash)
                }
                _ => false,
            }
        }
        Err(_) => false,
    };

    if is_up_to_date {
        println!(
            "[DB] Schema is up-to-date (hash: {}), skipping DDL migration pipeline.",
            &current_hash[..8]
        );
    } else {
        println!(
            "[DB] Schema changed or missing (hash: {}), applying DDL pipeline...",
            &current_hash[..8]
        );
        deduplicate_entity_schemas(&db).await;
        if let Err(e) = apply_schema_pipeline(&db).await {
            eprintln!("[CRITICAL] Schema pipeline failed to apply: {}", e);
            return Err(Box::new(std::io::Error::other(e.to_string())));
        }

        sync_builtin_entity_schemas(&db).await;

        let save_hash_query = "UPSERT type::record('system_meta', 'schema_version') SET ddl_hash = $hash, updated_at = time::now()";
        match db
            .query(save_hash_query)
            .bind(("hash", current_hash.as_str()))
            .await
        {
            Ok(mut res) => {
                let errors = res.take_errors();
                if !errors.is_empty() {
                    eprintln!(
                        "[DB WARNING] Failed to record schema version hash: {:?}",
                        errors
                    );
                }
            }
            Err(e) => {
                eprintln!("[DB WARNING] Failed to record schema version hash: {}", e);
            }
        }
    }

    Ok(db)
}

pub async fn apply_schema_pipeline(db: &Surreal<Db>) -> Result<(), DomainError> {
    let start = std::time::Instant::now();
    let combined_ddl = ALL_DDL_MODULES
        .iter()
        .map(|(_, ddl)| *ddl)
        .collect::<Vec<_>>()
        .join("\n\n");

    match db.query(&combined_ddl).await {
        Ok(mut res) => {
            let errors = res.take_errors();
            if !errors.is_empty() {
                eprintln!(
                    "[DDL ERROR] Batched schema pipeline failed with {} error(s):",
                    errors.len()
                );
                for (idx, err) in &errors {
                    eprintln!("  -> Statement #{} error: {}", idx, err);
                }

                return Err(DomainError::Validation(format!(
                    "Batched schema pipeline failed with {} error(s)",
                    errors.len()
                )));
            }
            println!(
                "[DB] Batched schema pipeline (18 modules) applied successfully in {:.2?}.",
                start.elapsed()
            );
            Ok(())
        }
        Err(e) => {
            let err_msg = format!("Failed to execute batched schema pipeline: {}", e);
            eprintln!("[DDL CRITICAL] {}", err_msg);
            Err(DomainError::Validation(err_msg))
        }
    }
}

pub async fn apply_ddl_module(db: &Surreal<Db>, name: &str, ddl: &str) -> Result<(), DomainError> {
    if ddl.trim().is_empty() {
        return Ok(());
    }
    match db.query(ddl).await {
        Ok(mut res) => {
            let errors = res.take_errors();
            if !errors.is_empty() {
                eprintln!(
                    "[DDL ERROR] Module '{}' failed with {} error(s):",
                    name,
                    errors.len()
                );
                for (idx, err) in &errors {
                    eprintln!("  -> Statement #{} error: {}", idx, err);
                }

                let err_msg = format!("DDL Error in module '{}': {:?}", name, errors);
                return Err(DomainError::Validation(err_msg));
            }
            println!("[DB] Schema module '{}' applied successfully.", name);
            Ok(())
        }
        Err(e) => {
            let err_msg = format!("Failed to execute DDL module '{}': {}", name, e);
            eprintln!("[DDL CRITICAL] {}", err_msg);
            Err(DomainError::Validation(err_msg))
        }
    }
}
