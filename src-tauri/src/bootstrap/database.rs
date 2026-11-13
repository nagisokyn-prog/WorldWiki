use std::fs;
use surrealdb::Surreal;
use surrealdb::engine::local::{Db, SurrealKv};

pub use super::schema_catalog::*;
pub use super::schema_migration::{
    apply_ddl_module, apply_schema_pipeline, deduplicate_entity_schemas,
    sync_builtin_entity_schemas,
};

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
    let is_up_to_date = check_schema_version(&db, &current_hash).await;
    let hash_prefix = current_hash.get(..8).unwrap_or(&current_hash);

    if is_up_to_date {
        println!(
            "[DB] Schema is up-to-date (hash: {}), skipping DDL migration pipeline.",
            hash_prefix
        );
        return Ok(db);
    }

    println!(
        "[DB] Schema changed or missing (hash: {}), applying DDL pipeline...",
        hash_prefix
    );
    deduplicate_entity_schemas(&db).await;
    if let Err(e) = apply_schema_pipeline(&db).await {
        eprintln!("[CRITICAL] Schema pipeline failed to apply: {}", e);
        return Err(Box::new(std::io::Error::other(e.to_string())));
    }

    sync_builtin_entity_schemas(&db).await;
    record_schema_version(&db, &current_hash).await;
    Ok(db)
}

async fn check_schema_version(db: &Surreal<Db>, current_hash: &str) -> bool {
    let Ok(mut res) = db
        .query("SELECT ddl_hash FROM type::record('system_meta', 'schema_version')")
        .await
    else {
        return false;
    };
    let opt_row: Result<Option<serde_json::Value>, _> = res.take(0);
    matches!(
        opt_row,
        Ok(Some(row)) if row.get("ddl_hash").and_then(|v| v.as_str()) == Some(current_hash)
    )
}

async fn record_schema_version(db: &Surreal<Db>, current_hash: &str) {
    let save_hash_query = "UPSERT type::record('system_meta', 'schema_version') SET ddl_hash = $hash, updated_at = time::now()";
    match db
        .query(save_hash_query)
        .bind(("hash", current_hash))
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
