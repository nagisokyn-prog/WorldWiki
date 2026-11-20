-- ==============================================================================
-- WORLDWIKI: ПОЛНАЯ ЛОГИЧЕСКАЯ СХЕМА ДЛЯ ИМПОРТА В VISUAL PARADIGM (PostgreSQL DDL)
-- Импорт: Tools -> DB -> Reverse DDL (PostgreSQL)
-- Соответствует 01_tables.surql (no_ai): все таблицы узлов, TYPE RELATION, ревизии и метаданные.
-- ==============================================================================

-- 1. ПРОЕКТЫ
CREATE TABLE projects (
    id VARCHAR PRIMARY KEY,
    name VARCHAR NOT NULL,
    type VARCHAR,
    genres JSONB NOT NULL,
    cover_image TEXT,
    created_at TIMESTAMP
);

-- 3. ТОМА
CREATE TABLE volumes (
    id VARCHAR PRIMARY KEY,
    project_id VARCHAR NOT NULL REFERENCES projects(id),
    title VARCHAR NOT NULL
);

-- 4. ГЛАВЫ РУКОПИСИ
CREATE TABLE chapters (
    id VARCHAR PRIMARY KEY,
    volume_id VARCHAR NOT NULL REFERENCES volumes(id),
    title VARCHAR NOT NULL,
    content TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    word_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- 2. ИЕРАРХИЯ СЮЖЕТА (TYPE RELATION: projects | volumes -> volumes | chapters)
CREATE TABLE contains (
    id VARCHAR PRIMARY KEY,
    in_project_id VARCHAR REFERENCES projects(id),
    in_volume_id VARCHAR REFERENCES volumes(id),
    out_volume_id VARCHAR REFERENCES volumes(id),
    out_chapter_id VARCHAR REFERENCES chapters(id),
    sort_order INTEGER NOT NULL DEFAULT 0
);

-- 5. СЮЖЕТНЫЕ АРКИ
CREATE TABLE story_arcs (
    id VARCHAR PRIMARY KEY,
    project_id VARCHAR NOT NULL REFERENCES projects(id),
    title VARCHAR NOT NULL,
    status VARCHAR NOT NULL DEFAULT 'in_progress',
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);

-- 6. БЛОКИ ТЕКСТА
CREATE TABLE text_blocks (
    id VARCHAR PRIMARY KEY,
    chapter_id VARCHAR NOT NULL REFERENCES chapters(id),
    block_type VARCHAR NOT NULL DEFAULT 'description',
    order_index INTEGER NOT NULL DEFAULT 0,
    content TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL
);

-- 7. ПЛАНЕТЫ
CREATE TABLE planets (
    id VARCHAR PRIMARY KEY,
    project_id VARCHAR NOT NULL REFERENCES projects(id),
    name VARCHAR NOT NULL,
    ticks_per_day INTEGER NOT NULL,
    axial_tilt_mdeg INTEGER,
    orbit_days_num INTEGER,
    orbit_days_den INTEGER,
    moons JSONB NOT NULL,
    timezones JSONB NOT NULL,
    regions JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);

-- 8. КАЛЕНДАРИ И ЭПОХИ
CREATE TABLE calendars (
    id VARCHAR PRIMARY KEY,
    planet_id VARCHAR NOT NULL REFERENCES planets(id),
    name VARCHAR NOT NULL,
    description TEXT,
    data JSONB NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_master BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);

-- 9. МЕТА-СХЕМЫ СУЩНОСТЕЙ ЛОРА
CREATE TABLE entity_schemas (
    id VARCHAR PRIMARY KEY,
    project_id VARCHAR NOT NULL REFERENCES projects(id),
    type_key VARCHAR NOT NULL,
    type_name VARCHAR NOT NULL,
    fields_schema JSONB NOT NULL,
    full_schema JSONB,
    created_at TIMESTAMP NOT NULL
);

-- 10. ИСТОРИЯ ВЕРСИЙ МЕТА-СХЕМ
CREATE TABLE schema_history (
    id VARCHAR PRIMARY KEY,
    schema_id VARCHAR NOT NULL REFERENCES entity_schemas(id),
    project_id VARCHAR NOT NULL REFERENCES projects(id),
    type_key VARCHAR NOT NULL,
    snapshot JSONB NOT NULL,
    saved_at TIMESTAMP NOT NULL,
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    commit_msg TEXT
);

-- 11. СУЩНОСТИ ЭНЦИКЛОПЕДИИ ЛОРА
CREATE TABLE entities (
    id VARCHAR PRIMARY KEY,
    schema_id VARCHAR NOT NULL REFERENCES entity_schemas(id),
    name VARCHAR NOT NULL,
    description TEXT,
    tags JSONB NOT NULL,
    attributes JSONB NOT NULL,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- 12. СХЕМЫ ТИПОВ СВЯЗЕЙ
CREATE TABLE relation_schemas (
    id VARCHAR PRIMARY KEY,
    project_id VARCHAR NOT NULL REFERENCES projects(id),
    rel_key VARCHAR NOT NULL,
    rel_name VARCHAR NOT NULL,
    icon VARCHAR NOT NULL,
    color VARCHAR NOT NULL,
    from_types JSONB NOT NULL,
    to_types JSONB NOT NULL
);

-- 13. ГРАФОВЫЕ СВЯЗИ МЕЖДУ СУЩНОСТЯМИ (TYPE RELATION)
CREATE TABLE entity_rel (
    id VARCHAR PRIMARY KEY,
    in_entity_id VARCHAR NOT NULL REFERENCES entities(id),
    out_entity_id VARCHAR NOT NULL REFERENCES entities(id),
    rel_type VARCHAR NOT NULL,
    description TEXT,
    strength INTEGER,
    attributes JSONB NOT NULL,
    start_at_chapter_id VARCHAR REFERENCES chapters(id),
    start_at_volume_id VARCHAR REFERENCES volumes(id),
    end_at_chapter_id VARCHAR REFERENCES chapters(id),
    end_at_volume_id VARCHAR REFERENCES volumes(id),
    is_auto_extend BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL
);

-- 14. УЧАСТИЕ СУЩНОСТЕЙ В ГЛАВАХ/БЛОКАХ (TYPE RELATION)
CREATE TABLE appears_in (
    id VARCHAR PRIMARY KEY,
    in_entity_id VARCHAR NOT NULL REFERENCES entities(id),
    out_chapter_id VARCHAR REFERENCES chapters(id),
    out_block_id VARCHAR REFERENCES text_blocks(id),
    source VARCHAR NOT NULL DEFAULT 'mention',
    count INTEGER,
    created_at TIMESTAMP NOT NULL
);

-- 15. ЗАДАЧИ ПЛАНИРОВЩИКА (3NF)
CREATE TABLE todos (
    id VARCHAR PRIMARY KEY,
    owner_volume_id VARCHAR REFERENCES volumes(id),
    owner_chapter_id VARCHAR REFERENCES chapters(id),
    owner_arc_id VARCHAR REFERENCES story_arcs(id),
    arc_id VARCHAR REFERENCES story_arcs(id),
    depends_on VARCHAR REFERENCES todos(id),
    text TEXT NOT NULL,
    status VARCHAR NOT NULL DEFAULT 'planned',
    is_done BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);

-- 16. СОБЫТИЯ ТАЙМЛАЙНА
CREATE TABLE timeline_events (
    id VARCHAR PRIMARY KEY,
    project_id VARCHAR NOT NULL REFERENCES projects(id),
    calendar_id VARCHAR NOT NULL REFERENCES calendars(id),
    title VARCHAR NOT NULL,
    description TEXT,
    m_abs BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL
);

-- 17. РОЛЕВОЕ УЧАСТИЕ В СОБЫТИЯХ ТАЙМЛАЙНА (TYPE RELATION)
CREATE TABLE participates_in (
    id VARCHAR PRIMARY KEY,
    in_entity_id VARCHAR NOT NULL REFERENCES entities(id),
    out_event_id VARCHAR NOT NULL REFERENCES timeline_events(id),
    role VARCHAR,
    notes TEXT,
    created_at TIMESTAMP NOT NULL
);

-- 17.1. НЕЛИНЕЙНОЕ РАСКРЫТИЕ СОБЫТИЙ В ГЛАВАХ (TYPE RELATION)
CREATE TABLE revealed_in (
    id VARCHAR PRIMARY KEY,
    in_event_id VARCHAR NOT NULL REFERENCES timeline_events(id),
    out_chapter_id VARCHAR NOT NULL REFERENCES chapters(id),
    pov_id VARCHAR REFERENCES entities(id),
    kind VARCHAR NOT NULL DEFAULT 'direct',
    block_id VARCHAR,
    created_at TIMESTAMP NOT NULL
);

-- 18. РЕВИЗИИ СУЩНОСТЕЙ
CREATE TABLE entity_revisions (
    id VARCHAR PRIMARY KEY,
    target_id VARCHAR NOT NULL REFERENCES entities(id),
    content JSONB NOT NULL,
    commit_msg TEXT,
    created_at TIMESTAMP NOT NULL,
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE
);

-- 19. РЕВИЗИИ ГРАФОВЫХ СВЯЗЕЙ
CREATE TABLE entity_rel_revisions (
    id VARCHAR PRIMARY KEY,
    target_id VARCHAR NOT NULL REFERENCES entity_rel(id),
    in_id VARCHAR NOT NULL REFERENCES entities(id),
    out_id VARCHAR NOT NULL REFERENCES entities(id),
    action VARCHAR NOT NULL,
    content JSONB NOT NULL,
    commit_msg TEXT,
    created_at TIMESTAMP NOT NULL
);

-- 20. РЕВИЗИИ ГЛАВ
CREATE TABLE chapter_revisions (
    id VARCHAR PRIMARY KEY,
    target_id VARCHAR NOT NULL REFERENCES chapters(id),
    content JSONB NOT NULL,
    commit_msg TEXT,
    created_at TIMESTAMP NOT NULL,
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE
);

-- 21. НАРРАТИВНЫЕ УЗЛЫ И СЮЖЕТНЫЕ ОБЕЩАНИЯ
CREATE TABLE plot_promises (
    id VARCHAR PRIMARY KEY,
    parent_id VARCHAR REFERENCES plot_promises(id),
    location_id VARCHAR REFERENCES entities(id),
    timeline_event_id VARCHAR REFERENCES timeline_events(id),
    block_ids JSONB NOT NULL,
    kind VARCHAR NOT NULL,
    time_nature VARCHAR NOT NULL DEFAULT 'present',
    title VARCHAR NOT NULL,
    note TEXT,
    status VARCHAR NOT NULL DEFAULT 'planted',
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);

-- 21.1. ОХВАТ БЛОКОВ ТЕКСТА СЦЕНОЙ (TYPE RELATION)
CREATE TABLE spans_blocks (
    id VARCHAR PRIMARY KEY,
    in_promise_id VARCHAR NOT NULL REFERENCES plot_promises(id),
    out_block_id VARCHAR NOT NULL REFERENCES text_blocks(id),
    created_at TIMESTAMP NOT NULL
);

-- 21.2. ВЕХИ ЖИЗНЕННОГО ЦИКЛА РУЖЬЯ (TYPE RELATION)
CREATE TABLE promise_milestones (
    id VARCHAR PRIMARY KEY,
    in_promise_id VARCHAR NOT NULL REFERENCES plot_promises(id),
    out_block_id VARCHAR NOT NULL REFERENCES text_blocks(id),
    stage VARCHAR NOT NULL,
    quote TEXT NOT NULL,
    note TEXT,
    created_at TIMESTAMP NOT NULL
);

-- 21.3. ДЕЙСТВУЮЩИЕ ЛИЦА НАРРАТИВНОГО УЗЛА (TYPE RELATION)
CREATE TABLE participant_of (
    id VARCHAR PRIMARY KEY,
    in_entity_id VARCHAR NOT NULL REFERENCES entities(id),
    out_promise_id VARCHAR NOT NULL REFERENCES plot_promises(id),
    role VARCHAR,
    created_at TIMESTAMP NOT NULL
);

-- 21.4. ДИНАМИКА СЮЖЕТНЫХ АРОК (TYPE RELATION)
CREATE TABLE advances_arc (
    id VARCHAR PRIMARY KEY,
    in_chapter_id VARCHAR REFERENCES chapters(id),
    in_promise_id VARCHAR REFERENCES plot_promises(id),
    out_arc_id VARCHAR NOT NULL REFERENCES story_arcs(id),
    phase VARCHAR NOT NULL,
    transition TEXT,
    created_at TIMESTAMP NOT NULL
);

-- 21.5. ДИЕГЕТИЧЕСКАЯ ПРИВЯЗКА СЦЕНЫ К ТАЙМЛАЙНУ (TYPE RELATION)
CREATE TABLE occurs_at (
    id VARCHAR PRIMARY KEY,
    in_promise_id VARCHAR NOT NULL REFERENCES plot_promises(id),
    out_event_id VARCHAR NOT NULL REFERENCES timeline_events(id),
    time_nature VARCHAR NOT NULL DEFAULT 'present',
    created_at TIMESTAMP NOT NULL
);

-- 22. СИСТЕМНЫЕ МЕТАДАННЫЕ СХЕМЫ
CREATE TABLE system_meta (
    id VARCHAR PRIMARY KEY,
    ddl_hash VARCHAR NOT NULL,
    updated_at TIMESTAMP NOT NULL
);
