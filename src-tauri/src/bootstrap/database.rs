use std::fs;
use surrealdb::engine::local::{Db, SurrealKv};
use surrealdb::Surreal;
use worldwiki_domain::errors::DomainError;

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

    if let Err(e) = apply_schema_pipeline(&db).await {
        eprintln!("[CRITICAL] Schema pipeline failed to apply: {}", e);
        return Err(Box::new(e));
    }

    Ok(db)
}

pub async fn apply_schema_pipeline(
    db: &Surreal<Db>,
) -> Result<(), DomainError> {
    // 1. БАЗОВОЕ ЯДРО (NO-AI / BASE EDITION)
    const DDL_NOAI_00_ANALYZERS: &str =
        include_str!("../../../apps/spa/src/logic/schema/no_ai/00_analyzers.surql");
    const DDL_NOAI_01_TABLES: &str =
        include_str!("../../../apps/spa/src/logic/schema/no_ai/01_tables.surql");
    const DDL_NOAI_02_INDEXES: &str =
        include_str!("../../../apps/spa/src/logic/schema/no_ai/02_indexes.surql");
    const DDL_NOAI_03_EVENTS: &str =
        include_str!("../../../apps/spa/src/logic/schema/no_ai/03_events.surql");
    const DDL_NOAI_04_01_ANALYTICS: &str =
        include_str!("../../../apps/spa/src/logic/schema/no_ai/functions/01_analytics.surql");
    const DDL_NOAI_04_02_HIERARCHY: &str =
        include_str!("../../../apps/spa/src/logic/schema/no_ai/functions/02_hierarchy.surql");
    const DDL_NOAI_04_03_RELATIONS: &str =
        include_str!("../../../apps/spa/src/logic/schema/no_ai/functions/03_relations.surql");
    const DDL_NOAI_04_04_ENTITIES: &str =
        include_str!("../../../apps/spa/src/logic/schema/no_ai/functions/04_projects_and_entities.surql");
    const DDL_NOAI_04_05_REVISIONS: &str =
        include_str!("../../../apps/spa/src/logic/schema/no_ai/functions/05_revisions_and_blocks.surql");
    const DDL_NOAI_04_06_SCHEMAS: &str =
        include_str!("../../../apps/spa/src/logic/schema/no_ai/functions/06_schemas.surql");
    const DDL_NOAI_04_07_NARRATIVE: &str =
        include_str!("../../../apps/spa/src/logic/schema/no_ai/functions/07_narrative_and_journey.surql");

    apply_ddl_module(db, "no_ai/00_analyzers", DDL_NOAI_00_ANALYZERS).await?;
    apply_ddl_module(db, "no_ai/01_tables", DDL_NOAI_01_TABLES).await?;
    apply_ddl_module(db, "no_ai/02_indexes", DDL_NOAI_02_INDEXES).await?;
    apply_ddl_module(db, "no_ai/03_events", DDL_NOAI_03_EVENTS).await?;
    apply_ddl_module(db, "no_ai/functions/01_analytics", DDL_NOAI_04_01_ANALYTICS).await?;
    apply_ddl_module(db, "no_ai/functions/02_hierarchy", DDL_NOAI_04_02_HIERARCHY).await?;
    apply_ddl_module(db, "no_ai/functions/03_relations", DDL_NOAI_04_03_RELATIONS).await?;
    apply_ddl_module(db, "no_ai/functions/04_projects_and_entities", DDL_NOAI_04_04_ENTITIES).await?;
    apply_ddl_module(db, "no_ai/functions/05_revisions_and_blocks", DDL_NOAI_04_05_REVISIONS).await?;
    apply_ddl_module(db, "no_ai/functions/06_schemas", DDL_NOAI_04_06_SCHEMAS).await?;
    apply_ddl_module(db, "no_ai/functions/07_narrative_and_journey", DDL_NOAI_04_07_NARRATIVE).await?;

    // 2. ИИ-ПРОСТРАНСТВО (AI / ULTRA EDITION)
    const DDL_AI_01_WORKSPACE: &str =
        include_str!("../../../apps/spa/src/logic/schema/ai/01_workspace_tables.surql");
    const DDL_AI_02_WEB_RESEARCH: &str =
        include_str!("../../../apps/spa/src/logic/schema/ai/02_web_research_tables.surql");
    const DDL_AI_03_EMBEDDINGS: &str =
        include_str!("../../../apps/spa/src/logic/schema/ai/03_embeddings_hnsw.surql");
    const DDL_AI_04_INDEXES: &str =
        include_str!("../../../apps/spa/src/logic/schema/ai/04_indexes.surql");
    const DDL_AI_05_EVENTS: &str =
        include_str!("../../../apps/spa/src/logic/schema/ai/05_events.surql");
    const DDL_AI_06_FUNCTIONS: &str =
        include_str!("../../../apps/spa/src/logic/schema/ai/06_functions.surql");

    apply_ddl_module(db, "ai/01_workspace_tables", DDL_AI_01_WORKSPACE).await?;
    apply_ddl_module(db, "ai/02_web_research_tables", DDL_AI_02_WEB_RESEARCH).await?;
    apply_ddl_module(db, "ai/03_embeddings_hnsw", DDL_AI_03_EMBEDDINGS).await?;
    apply_ddl_module(db, "ai/04_indexes", DDL_AI_04_INDEXES).await?;
    apply_ddl_module(db, "ai/05_events", DDL_AI_05_EVENTS).await?;
    apply_ddl_module(db, "ai/06_functions", DDL_AI_06_FUNCTIONS).await?;

    Ok(())
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
