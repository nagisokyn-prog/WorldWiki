use std::fs;
use std::hash::{DefaultHasher, Hasher};
use surrealdb::engine::local::{Db, SurrealKv};
use surrealdb::Surreal;
use worldwiki_domain::errors::DomainError;

pub const ALL_DDL_MODULES: &[(&str, &str)] = &[
    (
        "no_ai/00_analyzers",
        include_str!("../../../apps/spa/src/logic/schema/no_ai/00_analyzers.surql"),
    ),
    (
        "no_ai/01_tables",
        include_str!("../../../apps/spa/src/logic/schema/no_ai/01_tables.surql"),
    ),
    (
        "no_ai/02_indexes",
        include_str!("../../../apps/spa/src/logic/schema/no_ai/02_indexes.surql"),
    ),
    (
        "no_ai/03_events",
        include_str!("../../../apps/spa/src/logic/schema/no_ai/03_events.surql"),
    ),
    (
        "no_ai/functions/01_analytics",
        include_str!("../../../apps/spa/src/logic/schema/no_ai/functions/01_analytics.surql"),
    ),
    (
        "no_ai/functions/02_hierarchy",
        include_str!("../../../apps/spa/src/logic/schema/no_ai/functions/02_hierarchy.surql"),
    ),
    (
        "no_ai/functions/03_relations",
        include_str!("../../../apps/spa/src/logic/schema/no_ai/functions/03_relations.surql"),
    ),
    (
        "no_ai/functions/04_projects_and_entities",
        include_str!("../../../apps/spa/src/logic/schema/no_ai/functions/04_projects_and_entities.surql"),
    ),
    (
        "no_ai/functions/05_revisions_and_blocks",
        include_str!("../../../apps/spa/src/logic/schema/no_ai/functions/05_revisions_and_blocks.surql"),
    ),
    (
        "no_ai/functions/06_schemas",
        include_str!("../../../apps/spa/src/logic/schema/no_ai/functions/06_schemas.surql"),
    ),
    (
        // Module 07: Narrative & Journey functions (v3)
        "no_ai/functions/07_narrative_and_journey",
        include_str!("../../../apps/spa/src/logic/schema/no_ai/functions/07_narrative_and_journey.surql"),
    ),
    (
        // Module 08: Calendars & Planets functions (updated)
        "no_ai/functions/08_calendars_and_planets",
        include_str!("../../../apps/spa/src/logic/schema/no_ai/functions/08_calendars_and_planets.surql"),
    ),
    (
        "ai/01_workspace_tables",
        include_str!("../../../apps/spa/src/logic/schema/ai/01_workspace_tables.surql"),
    ),
    (
        "ai/02_web_research_tables",
        include_str!("../../../apps/spa/src/logic/schema/ai/02_web_research_tables.surql"),
    ),
    (
        "ai/03_embeddings_hnsw",
        include_str!("../../../apps/spa/src/logic/schema/ai/03_embeddings_hnsw.surql"),
    ),
    (
        "ai/04_indexes",
        include_str!("../../../apps/spa/src/logic/schema/ai/04_indexes.surql"),
    ),
    (
        "ai/05_events",
        include_str!("../../../apps/spa/src/logic/schema/ai/05_events.surql"),
    ),
    (
        "ai/06_functions",
        include_str!("../../../apps/spa/src/logic/schema/ai/06_functions.surql"),
    ),
];

pub const CORE_ENTITY_SCHEMAS: &[(&str, &str)] = &[
    (
        "character",
        include_str!("../../../apps/spa/public/struct/editor/character.json"),
    ),
    (
        "location",
        include_str!("../../../apps/spa/public/struct/editor/location.json"),
    ),
    (
        "organization",
        include_str!("../../../apps/spa/public/struct/editor/organization.json"),
    ),
    (
        "state",
        include_str!("../../../apps/spa/public/struct/editor/state.json"),
    ),
    (
        "item",
        include_str!("../../../apps/spa/public/struct/editor/item.json"),
    ),
    (
        "event",
        include_str!("../../../apps/spa/public/struct/editor/event.json"),
    ),
];

pub fn compute_schema_hash() -> String {
    let mut hasher = DefaultHasher::new();
    hasher.write(b"v3_schema_sync");
    for (name, ddl) in ALL_DDL_MODULES {
        hasher.write(name.as_bytes());
        hasher.write(ddl.as_bytes());
    }
    for (type_key, json_str) in CORE_ENTITY_SCHEMAS {
        hasher.write(type_key.as_bytes());
        hasher.write(json_str.as_bytes());
    }
    format!("{:016x}", hasher.finish())
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
        if let Err(e) = apply_schema_pipeline(&db).await {
            eprintln!("[CRITICAL] Schema pipeline failed to apply: {}", e);
            return Err(Box::new(std::io::Error::other(e.to_string())));
        }

        sync_builtin_entity_schemas(&db).await;

        let save_hash_query = "UPSERT type::record('system_meta', 'schema_version') SET ddl_hash = $hash, updated_at = time::now()";
        match db.query(save_hash_query).bind(("hash", current_hash.as_str())).await {
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

pub async fn apply_ddl_module(
    db: &Surreal<Db>,
    name: &str,
    ddl: &str,
) -> Result<(), DomainError> {
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

