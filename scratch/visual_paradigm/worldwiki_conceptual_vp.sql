-- ==============================================================================
-- WORLDWIKI: КОНЦЕПТУАЛЬНАЯ СХЕМА ДЛЯ ИМПОРТА В VISUAL PARADIGM (PostgreSQL DDL)
-- Импорт: Tools -> DB -> Reverse DDL (PostgreSQL / Generic SQL)
-- Содержит только 12 ключевых концептуальных сущностей и основные связи (без ревизий и системных полей).
-- ==============================================================================

CREATE TABLE projects (
    id VARCHAR PRIMARY KEY,
    name VARCHAR NOT NULL,
    type VARCHAR,
    genres TEXT
);

CREATE TABLE volumes (
    id VARCHAR PRIMARY KEY,
    project_id VARCHAR NOT NULL REFERENCES projects(id),
    title VARCHAR NOT NULL
);

CREATE TABLE chapters (
    id VARCHAR PRIMARY KEY,
    volume_id VARCHAR NOT NULL REFERENCES volumes(id),
    title VARCHAR NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    word_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE text_blocks (
    id VARCHAR PRIMARY KEY,
    chapter_id VARCHAR NOT NULL REFERENCES chapters(id),
    block_type VARCHAR NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 0,
    content TEXT NOT NULL
);

CREATE TABLE story_arcs (
    id VARCHAR PRIMARY KEY,
    project_id VARCHAR NOT NULL REFERENCES projects(id),
    title VARCHAR NOT NULL,
    status VARCHAR NOT NULL
);

CREATE TABLE planets (
    id VARCHAR PRIMARY KEY,
    project_id VARCHAR NOT NULL REFERENCES projects(id),
    name VARCHAR NOT NULL,
    ticks_per_day INTEGER NOT NULL
);

CREATE TABLE calendars (
    id VARCHAR PRIMARY KEY,
    planet_id VARCHAR NOT NULL REFERENCES planets(id),
    name VARCHAR NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_master BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE timeline_events (
    id VARCHAR PRIMARY KEY,
    project_id VARCHAR NOT NULL REFERENCES projects(id),
    calendar_id VARCHAR NOT NULL REFERENCES calendars(id),
    title VARCHAR NOT NULL,
    m_abs BIGINT NOT NULL
);

CREATE TABLE entity_schemas (
    id VARCHAR PRIMARY KEY,
    project_id VARCHAR NOT NULL REFERENCES projects(id),
    type_key VARCHAR NOT NULL,
    type_name VARCHAR NOT NULL
);

CREATE TABLE entities (
    id VARCHAR PRIMARY KEY,
    schema_id VARCHAR NOT NULL REFERENCES entity_schemas(id),
    name VARCHAR NOT NULL,
    description TEXT
);

CREATE TABLE plot_promises (
    id VARCHAR PRIMARY KEY,
    parent_id VARCHAR REFERENCES plot_promises(id),
    location_id VARCHAR REFERENCES entities(id),
    timeline_event_id VARCHAR REFERENCES timeline_events(id),
    kind VARCHAR NOT NULL,
    time_nature VARCHAR NOT NULL,
    title VARCHAR NOT NULL,
    status VARCHAR NOT NULL
);

CREATE TABLE todos (
    id VARCHAR PRIMARY KEY,
    owner_volume_id VARCHAR REFERENCES volumes(id),
    owner_chapter_id VARCHAR REFERENCES chapters(id),
    owner_arc_id VARCHAR REFERENCES story_arcs(id),
    arc_id VARCHAR REFERENCES story_arcs(id),
    depends_on VARCHAR REFERENCES todos(id),
    text TEXT NOT NULL,
    status VARCHAR NOT NULL
);

-- Основные концептуальные связи M:N
CREATE TABLE entity_rel (
    id VARCHAR PRIMARY KEY,
    in_entity_id VARCHAR NOT NULL REFERENCES entities(id),
    out_entity_id VARCHAR NOT NULL REFERENCES entities(id),
    rel_type VARCHAR NOT NULL,
    strength INTEGER,
    start_chapter_id VARCHAR REFERENCES chapters(id),
    end_chapter_id VARCHAR REFERENCES chapters(id)
);

CREATE TABLE appears_in (
    id VARCHAR PRIMARY KEY,
    in_entity_id VARCHAR NOT NULL REFERENCES entities(id),
    out_block_id VARCHAR NOT NULL REFERENCES text_blocks(id),
    source VARCHAR NOT NULL
);

CREATE TABLE participant_of (
    id VARCHAR PRIMARY KEY,
    in_entity_id VARCHAR NOT NULL REFERENCES entities(id),
    out_promise_id VARCHAR NOT NULL REFERENCES plot_promises(id),
    role VARCHAR
);

CREATE TABLE promise_milestones (
    id VARCHAR PRIMARY KEY,
    in_promise_id VARCHAR NOT NULL REFERENCES plot_promises(id),
    out_block_id VARCHAR NOT NULL REFERENCES text_blocks(id),
    stage VARCHAR NOT NULL
);

CREATE TABLE advances_arc (
    id VARCHAR PRIMARY KEY,
    in_promise_id VARCHAR REFERENCES plot_promises(id),
    in_chapter_id VARCHAR REFERENCES chapters(id),
    out_arc_id VARCHAR NOT NULL REFERENCES story_arcs(id),
    phase VARCHAR NOT NULL
);

CREATE TABLE occurs_at (
    id VARCHAR PRIMARY KEY,
    in_promise_id VARCHAR NOT NULL REFERENCES plot_promises(id),
    out_event_id VARCHAR NOT NULL REFERENCES timeline_events(id),
    time_nature VARCHAR NOT NULL
);

CREATE TABLE participates_in (
    id VARCHAR PRIMARY KEY,
    in_entity_id VARCHAR NOT NULL REFERENCES entities(id),
    out_event_id VARCHAR NOT NULL REFERENCES timeline_events(id),
    role VARCHAR
);
