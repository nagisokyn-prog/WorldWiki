//! DDL modules and Core Entity Schemas catalog for SurrealDB initialization.

use std::hash::{DefaultHasher, Hasher};

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
        include_str!(
            "../../../apps/spa/src/logic/schema/no_ai/functions/04_projects_and_entities.surql"
        ),
    ),
    (
        "no_ai/functions/05_revisions_and_blocks",
        include_str!(
            "../../../apps/spa/src/logic/schema/no_ai/functions/05_revisions_and_blocks.surql"
        ),
    ),
    (
        "no_ai/functions/06_schemas",
        include_str!("../../../apps/spa/src/logic/schema/no_ai/functions/06_schemas.surql"),
    ),
    (
        // Module 07: Narrative & Journey functions (v3)
        "no_ai/functions/07_narrative_and_journey",
        include_str!(
            "../../../apps/spa/src/logic/schema/no_ai/functions/07_narrative_and_journey.surql"
        ),
    ),
    (
        // Module 08: Calendars & Planets functions (updated)
        "no_ai/functions/08_calendars_and_planets",
        include_str!(
            "../../../apps/spa/src/logic/schema/no_ai/functions/08_calendars_and_planets.surql"
        ),
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
    hasher.write(b"v10_fix_analytics_array_len");
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

