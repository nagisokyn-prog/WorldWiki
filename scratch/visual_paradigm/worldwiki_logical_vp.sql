-- ==============================================================================
-- WORLDWIKI: ПОЛНАЯ ЛОГИЧЕСКАЯ СХЕМА (СТРОГИЙ POSTGRESQL 16+ DDL)
-- Соответствует 01_tables.surql / 02_indexes.surql / 03_events.surql (no_ai)
-- ==============================================================================

BEGIN;

-- 1. ПРОЕКТЫ
CREATE TABLE projects (
    id          VARCHAR     NOT NULL,
    name        VARCHAR     NOT NULL,
    type        VARCHAR,
    genres      JSONB       NOT NULL DEFAULT '[]'::jsonb,
    cover_image TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_projects PRIMARY KEY (id)
);

-- 2. ТОМА
CREATE TABLE volumes (
    id         VARCHAR NOT NULL,
    project_id VARCHAR NOT NULL,
    title      VARCHAR NOT NULL,
    CONSTRAINT pk_volumes PRIMARY KEY (id),
    CONSTRAINT fk_volumes_project FOREIGN KEY (project_id)
        REFERENCES projects (id) ON DELETE CASCADE
);

-- 3. ГЛАВЫ РУКОПИСИ
CREATE TABLE chapters (
    id         VARCHAR     NOT NULL,
    volume_id  VARCHAR     NOT NULL,
    title      VARCHAR     NOT NULL,
    content    TEXT        NOT NULL DEFAULT '',
    sort_order INTEGER     NOT NULL DEFAULT 0,
    word_count INTEGER     NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_chapters PRIMARY KEY (id),
    CONSTRAINT fk_chapters_volume FOREIGN KEY (volume_id)
        REFERENCES volumes (id) ON DELETE CASCADE
);

-- 4. ИЕРАРХИЯ СЮЖЕТА (TYPE RELATION: projects | volumes -> volumes | chapters)
CREATE TABLE contains (
    id             VARCHAR NOT NULL,
    in_project_id  VARCHAR,
    in_volume_id   VARCHAR,
    out_volume_id  VARCHAR,
    out_chapter_id VARCHAR,
    sort_order     INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT pk_contains PRIMARY KEY (id),
    CONSTRAINT fk_contains_in_project FOREIGN KEY (in_project_id)
        REFERENCES projects (id) ON DELETE CASCADE,
    CONSTRAINT fk_contains_in_volume FOREIGN KEY (in_volume_id)
        REFERENCES volumes (id) ON DELETE CASCADE,
    CONSTRAINT fk_contains_out_volume FOREIGN KEY (out_volume_id)
        REFERENCES volumes (id) ON DELETE CASCADE,
    CONSTRAINT fk_contains_out_chapter FOREIGN KEY (out_chapter_id)
        REFERENCES chapters (id) ON DELETE CASCADE,
    CONSTRAINT chk_contains_endpoints CHECK (
        ((in_project_id IS NOT NULL)::int + (in_volume_id IS NOT NULL)::int = 1)
        AND ((out_volume_id IS NOT NULL)::int + (out_chapter_id IS NOT NULL)::int = 1)
    )
);

-- 5. СЮЖЕТНЫЕ АРКИ
CREATE TABLE story_arcs (
    id         VARCHAR     NOT NULL,
    project_id VARCHAR     NOT NULL,
    title      VARCHAR     NOT NULL,
    status     VARCHAR     NOT NULL DEFAULT 'in_progress',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_story_arcs PRIMARY KEY (id),
    CONSTRAINT fk_story_arcs_project FOREIGN KEY (project_id)
        REFERENCES projects (id) ON DELETE CASCADE,
    CONSTRAINT chk_story_arcs_status CHECK (status IN ('planned', 'in_progress', 'completed', 'abandoned'))
);

-- 6. БЛОКИ ТЕКСТА
CREATE TABLE text_blocks (
    id          VARCHAR     NOT NULL,
    chapter_id  VARCHAR     NOT NULL,
    block_type  VARCHAR     NOT NULL DEFAULT 'description',
    order_index INTEGER     NOT NULL DEFAULT 0,
    content     TEXT        NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_text_blocks PRIMARY KEY (id),
    CONSTRAINT fk_text_blocks_chapter FOREIGN KEY (chapter_id)
        REFERENCES chapters (id) ON DELETE CASCADE
);

-- 7. ПЛАНЕТЫ
CREATE TABLE planets (
    id              VARCHAR     NOT NULL,
    project_id      VARCHAR     NOT NULL,
    name            VARCHAR     NOT NULL,
    ticks_per_day   INTEGER     NOT NULL,
    axial_tilt_mdeg INTEGER,
    orbit_days_num  INTEGER,
    orbit_days_den  INTEGER,
    moons           JSONB       NOT NULL DEFAULT '[]'::jsonb,
    timezones       JSONB       NOT NULL DEFAULT '[]'::jsonb,
    regions         JSONB       NOT NULL DEFAULT '[]'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_planets PRIMARY KEY (id),
    CONSTRAINT fk_planets_project FOREIGN KEY (project_id)
        REFERENCES projects (id) ON DELETE CASCADE,
    CONSTRAINT chk_planets_ticks CHECK (ticks_per_day > 0)
);

-- 8. КАЛЕНДАРИ И ЭПОХИ
CREATE TABLE calendars (
    id          VARCHAR     NOT NULL,
    planet_id   VARCHAR     NOT NULL,
    name        VARCHAR     NOT NULL,
    description TEXT,
    data        JSONB       NOT NULL DEFAULT '{}'::jsonb,
    is_default  BOOLEAN     NOT NULL DEFAULT FALSE,
    is_master   BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_calendars PRIMARY KEY (id),
    CONSTRAINT fk_calendars_planet FOREIGN KEY (planet_id)
        REFERENCES planets (id) ON DELETE CASCADE
);

-- 9. МЕТА-СХЕМЫ СУЩНОСТЕЙ ЛОРА
CREATE TABLE entity_schemas (
    id            VARCHAR     NOT NULL,
    project_id    VARCHAR     NOT NULL,
    type_key      VARCHAR     NOT NULL,
    type_name     VARCHAR     NOT NULL,
    fields_schema JSONB       NOT NULL DEFAULT '[]'::jsonb,
    full_schema   JSONB,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_entity_schemas PRIMARY KEY (id),
    CONSTRAINT fk_entity_schemas_project FOREIGN KEY (project_id)
        REFERENCES projects (id) ON DELETE CASCADE,
    CONSTRAINT uq_entity_schemas_project_key UNIQUE (project_id, type_key)
);

-- 10. ИСТОРИЯ ВЕРСИЙ МЕТА-СХЕМ
CREATE TABLE schema_history (
    id         VARCHAR     NOT NULL,
    schema_id  VARCHAR     NOT NULL,
    project_id VARCHAR     NOT NULL,
    type_key   VARCHAR     NOT NULL,
    snapshot   JSONB       NOT NULL,
    saved_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_pinned  BOOLEAN     NOT NULL DEFAULT FALSE,
    commit_msg TEXT,
    CONSTRAINT pk_schema_history PRIMARY KEY (id),
    CONSTRAINT fk_schema_history_schema FOREIGN KEY (schema_id)
        REFERENCES entity_schemas (id) ON DELETE CASCADE,
    CONSTRAINT fk_schema_history_project FOREIGN KEY (project_id)
        REFERENCES projects (id) ON DELETE CASCADE
);

-- 11. СУЩНОСТИ ЭНЦИКЛОПЕДИИ ЛОРА
CREATE TABLE entities (
    id          VARCHAR     NOT NULL,
    schema_id   VARCHAR     NOT NULL,
    name        VARCHAR     NOT NULL,
    description TEXT,
    tags        JSONB       NOT NULL DEFAULT '[]'::jsonb,
    attributes  JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_entities PRIMARY KEY (id),
    CONSTRAINT fk_entities_schema FOREIGN KEY (schema_id)
        REFERENCES entity_schemas (id) ON DELETE CASCADE
);

-- 12. СХЕМЫ ТИПОВ СВЯЗЕЙ
CREATE TABLE relation_schemas (
    id         VARCHAR NOT NULL,
    project_id VARCHAR NOT NULL,
    rel_key    VARCHAR NOT NULL,
    rel_name   VARCHAR NOT NULL,
    icon       VARCHAR NOT NULL,
    color      VARCHAR NOT NULL,
    from_types JSONB   NOT NULL DEFAULT '[]'::jsonb,
    to_types   JSONB   NOT NULL DEFAULT '[]'::jsonb,
    CONSTRAINT pk_relation_schemas PRIMARY KEY (id),
    CONSTRAINT fk_relation_schemas_project FOREIGN KEY (project_id)
        REFERENCES projects (id) ON DELETE CASCADE,
    CONSTRAINT uq_relation_schemas_project_key UNIQUE (project_id, rel_key)
);

-- 13. ГРАФОВЫЕ СВЯЗИ МЕЖДУ СУЩНОСТЯМИ (TYPE RELATION)
CREATE TABLE entity_rel (
    id                  VARCHAR     NOT NULL,
    in_entity_id        VARCHAR     NOT NULL,
    out_entity_id       VARCHAR     NOT NULL,
    rel_type            VARCHAR     NOT NULL,
    description         TEXT,
    strength            INTEGER,
    attributes          JSONB       NOT NULL DEFAULT '{}'::jsonb,
    start_at_chapter_id VARCHAR,
    start_at_volume_id  VARCHAR,
    end_at_chapter_id   VARCHAR,
    end_at_volume_id    VARCHAR,
    is_auto_extend      BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_entity_rel PRIMARY KEY (id),
    CONSTRAINT fk_entity_rel_in FOREIGN KEY (in_entity_id)
        REFERENCES entities (id) ON DELETE CASCADE,
    CONSTRAINT fk_entity_rel_out FOREIGN KEY (out_entity_id)
        REFERENCES entities (id) ON DELETE CASCADE,
    CONSTRAINT fk_entity_rel_start_ch FOREIGN KEY (start_at_chapter_id)
        REFERENCES chapters (id) ON DELETE SET NULL,
    CONSTRAINT fk_entity_rel_start_vol FOREIGN KEY (start_at_volume_id)
        REFERENCES volumes (id) ON DELETE SET NULL,
    CONSTRAINT fk_entity_rel_end_ch FOREIGN KEY (end_at_chapter_id)
        REFERENCES chapters (id) ON DELETE SET NULL,
    CONSTRAINT fk_entity_rel_end_vol FOREIGN KEY (end_at_volume_id)
        REFERENCES volumes (id) ON DELETE SET NULL
);

-- 14. УЧАСТИЕ СУЩНОСТЕЙ В ГЛАВАХ/БЛОКАХ (TYPE RELATION)
CREATE TABLE appears_in (
    id             VARCHAR     NOT NULL,
    in_entity_id   VARCHAR     NOT NULL,
    out_chapter_id VARCHAR,
    out_block_id   VARCHAR,
    source         VARCHAR     NOT NULL DEFAULT 'mention',
    count          INTEGER,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_appears_in PRIMARY KEY (id),
    CONSTRAINT fk_appears_in_entity FOREIGN KEY (in_entity_id)
        REFERENCES entities (id) ON DELETE CASCADE,
    CONSTRAINT fk_appears_in_chapter FOREIGN KEY (out_chapter_id)
        REFERENCES chapters (id) ON DELETE CASCADE,
    CONSTRAINT fk_appears_in_block FOREIGN KEY (out_block_id)
        REFERENCES text_blocks (id) ON DELETE CASCADE,
    CONSTRAINT chk_appears_in_target CHECK (
        (out_chapter_id IS NOT NULL) OR (out_block_id IS NOT NULL)
    )
);

-- 15. ЗАДАЧИ ПЛАНИРОВЩИКА (3NF)
CREATE TABLE todos (
    id               VARCHAR     NOT NULL,
    owner_volume_id  VARCHAR,
    owner_chapter_id VARCHAR,
    owner_arc_id     VARCHAR,
    arc_id           VARCHAR,
    depends_on       VARCHAR,
    text             TEXT        NOT NULL,
    status           VARCHAR     NOT NULL DEFAULT 'planned',
    is_done          BOOLEAN     NOT NULL DEFAULT FALSE,
    sort_order       INTEGER     NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_todos PRIMARY KEY (id),
    CONSTRAINT fk_todos_owner_volume FOREIGN KEY (owner_volume_id)
        REFERENCES volumes (id) ON DELETE CASCADE,
    CONSTRAINT fk_todos_owner_chapter FOREIGN KEY (owner_chapter_id)
        REFERENCES chapters (id) ON DELETE CASCADE,
    CONSTRAINT fk_todos_owner_arc FOREIGN KEY (owner_arc_id)
        REFERENCES story_arcs (id) ON DELETE CASCADE,
    CONSTRAINT fk_todos_arc FOREIGN KEY (arc_id)
        REFERENCES story_arcs (id) ON DELETE SET NULL,
    CONSTRAINT fk_todos_depends_on FOREIGN KEY (depends_on)
        REFERENCES todos (id) ON DELETE SET NULL,
    CONSTRAINT chk_todos_status CHECK (status IN ('planned', 'in_progress', 'done'))
);

-- 16. СОБЫТИЯ ТАЙМЛАЙНА
CREATE TABLE timeline_events (
    id          VARCHAR     NOT NULL,
    project_id  VARCHAR     NOT NULL,
    calendar_id VARCHAR     NOT NULL,
    title       VARCHAR     NOT NULL,
    description TEXT,
    m_abs       BIGINT      NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_timeline_events PRIMARY KEY (id),
    CONSTRAINT fk_timeline_events_project FOREIGN KEY (project_id)
        REFERENCES projects (id) ON DELETE CASCADE,
    CONSTRAINT fk_timeline_events_calendar FOREIGN KEY (calendar_id)
        REFERENCES calendars (id) ON DELETE CASCADE
);

-- 17. РОЛЕВОЕ УЧАСТИЕ В СОБЫТИЯХ ТАЙМЛАЙНА (TYPE RELATION)
CREATE TABLE participates_in (
    id           VARCHAR     NOT NULL,
    in_entity_id VARCHAR     NOT NULL,
    out_event_id VARCHAR     NOT NULL,
    role         VARCHAR,
    notes        TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_participates_in PRIMARY KEY (id),
    CONSTRAINT fk_participates_in_entity FOREIGN KEY (in_entity_id)
        REFERENCES entities (id) ON DELETE CASCADE,
    CONSTRAINT fk_participates_in_event FOREIGN KEY (out_event_id)
        REFERENCES timeline_events (id) ON DELETE CASCADE
);

-- 18. НЕЛИНЕЙНОЕ РАСКРЫТИЕ СОБЫТИЙ В ГЛАВАХ (TYPE RELATION)
CREATE TABLE revealed_in (
    id             VARCHAR     NOT NULL,
    in_event_id    VARCHAR     NOT NULL,
    out_chapter_id VARCHAR     NOT NULL,
    pov_id         VARCHAR,
    kind           VARCHAR     NOT NULL DEFAULT 'direct',
    block_id       VARCHAR,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_revealed_in PRIMARY KEY (id),
    CONSTRAINT fk_revealed_in_event FOREIGN KEY (in_event_id)
        REFERENCES timeline_events (id) ON DELETE CASCADE,
    CONSTRAINT fk_revealed_in_chapter FOREIGN KEY (out_chapter_id)
        REFERENCES chapters (id) ON DELETE CASCADE,
    CONSTRAINT fk_revealed_in_pov FOREIGN KEY (pov_id)
        REFERENCES entities (id) ON DELETE SET NULL,
    CONSTRAINT fk_revealed_in_block FOREIGN KEY (block_id)
        REFERENCES text_blocks (id) ON DELETE SET NULL,
    CONSTRAINT chk_revealed_in_kind CHECK (kind IN ('direct', 'flashback', 'prophecy', 'rumor'))
);

-- 19. РЕВИЗИИ СУЩНОСТЕЙ
CREATE TABLE entity_revisions (
    id         VARCHAR     NOT NULL,
    target_id  VARCHAR     NOT NULL,
    content    JSONB       NOT NULL,
    commit_msg TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_pinned  BOOLEAN     NOT NULL DEFAULT FALSE,
    CONSTRAINT pk_entity_revisions PRIMARY KEY (id),
    CONSTRAINT fk_entity_revisions_target FOREIGN KEY (target_id)
        REFERENCES entities (id) ON DELETE CASCADE
);

-- 20. РЕВИЗИИ ГРАФОВЫХ СВЯЗЕЙ
CREATE TABLE entity_rel_revisions (
    id         VARCHAR     NOT NULL,
    target_id  VARCHAR     NOT NULL,
    in_id      VARCHAR     NOT NULL,
    out_id     VARCHAR     NOT NULL,
    action     VARCHAR     NOT NULL,
    content    JSONB       NOT NULL,
    commit_msg TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_entity_rel_revisions PRIMARY KEY (id),
    CONSTRAINT fk_entity_rel_rev_target FOREIGN KEY (target_id)
        REFERENCES entity_rel (id) ON DELETE CASCADE,
    CONSTRAINT fk_entity_rel_rev_in FOREIGN KEY (in_id)
        REFERENCES entities (id) ON DELETE CASCADE,
    CONSTRAINT fk_entity_rel_rev_out FOREIGN KEY (out_id)
        REFERENCES entities (id) ON DELETE CASCADE,
    CONSTRAINT chk_entity_rel_rev_action CHECK (action IN ('created', 'updated', 'deleted'))
);

-- 21. РЕВИЗИИ ГЛАВ
CREATE TABLE chapter_revisions (
    id         VARCHAR     NOT NULL,
    target_id  VARCHAR     NOT NULL,
    content    JSONB       NOT NULL,
    commit_msg TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_pinned  BOOLEAN     NOT NULL DEFAULT FALSE,
    CONSTRAINT pk_chapter_revisions PRIMARY KEY (id),
    CONSTRAINT fk_chapter_revisions_target FOREIGN KEY (target_id)
        REFERENCES chapters (id) ON DELETE CASCADE
);

-- 22. НАРРАТИВНЫЕ УЗЛЫ И СЮЖЕТНЫЕ ОБЕЩАНИЯ
CREATE TABLE plot_promises (
    id                VARCHAR     NOT NULL,
    parent_id         VARCHAR,
    location_id       VARCHAR,
    timeline_event_id VARCHAR,
    block_ids         JSONB       NOT NULL DEFAULT '[]'::jsonb,
    kind              VARCHAR     NOT NULL,
    time_nature       VARCHAR     NOT NULL DEFAULT 'present',
    title             VARCHAR     NOT NULL,
    note              TEXT,
    status            VARCHAR     NOT NULL DEFAULT 'planted',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_plot_promises PRIMARY KEY (id),
    CONSTRAINT fk_plot_promises_parent FOREIGN KEY (parent_id)
        REFERENCES plot_promises (id) ON DELETE CASCADE,
    CONSTRAINT fk_plot_promises_location FOREIGN KEY (location_id)
        REFERENCES entities (id) ON DELETE SET NULL,
    CONSTRAINT fk_plot_promises_event FOREIGN KEY (timeline_event_id)
        REFERENCES timeline_events (id) ON DELETE SET NULL,
    CONSTRAINT chk_plot_promises_kind CHECK (kind IN ('scene', 'promise', 'foreshadowing')),
    CONSTRAINT chk_plot_promises_time CHECK (time_nature IN ('present', 'flashback', 'flashforward', 'timeless')),
    CONSTRAINT chk_plot_promises_status CHECK (status IN ('planted', 'developed', 'paid_off', 'abandoned'))
);

-- 23. ОХВАТ БЛОКОВ ТЕКСТА СЦЕНОЙ (TYPE RELATION)
CREATE TABLE spans_blocks (
    id            VARCHAR     NOT NULL,
    in_promise_id VARCHAR     NOT NULL,
    out_block_id  VARCHAR     NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_spans_blocks PRIMARY KEY (id),
    CONSTRAINT fk_spans_blocks_promise FOREIGN KEY (in_promise_id)
        REFERENCES plot_promises (id) ON DELETE CASCADE,
    CONSTRAINT fk_spans_blocks_block FOREIGN KEY (out_block_id)
        REFERENCES text_blocks (id) ON DELETE CASCADE
);

-- 24. ВЕХИ ЖИЗНЕННОГО ЦИКЛА РУЖЬЯ (TYPE RELATION)
CREATE TABLE promise_milestones (
    id            VARCHAR     NOT NULL,
    in_promise_id VARCHAR     NOT NULL,
    out_block_id  VARCHAR     NOT NULL,
    stage         VARCHAR     NOT NULL,
    quote         TEXT        NOT NULL,
    note          TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_promise_milestones PRIMARY KEY (id),
    CONSTRAINT fk_promise_milestones_promise FOREIGN KEY (in_promise_id)
        REFERENCES plot_promises (id) ON DELETE CASCADE,
    CONSTRAINT fk_promise_milestones_block FOREIGN KEY (out_block_id)
        REFERENCES text_blocks (id) ON DELETE CASCADE,
    CONSTRAINT chk_promise_milestones_stage CHECK (stage IN ('planted', 'developed', 'paid_off'))
);

-- 25. ДЕЙСТВУЮЩИЕ ЛИЦА НАРРАТИВНОГО УЗЛА (TYPE RELATION)
CREATE TABLE participant_of (
    id             VARCHAR     NOT NULL,
    in_entity_id   VARCHAR     NOT NULL,
    out_promise_id VARCHAR     NOT NULL,
    role           VARCHAR,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_participant_of PRIMARY KEY (id),
    CONSTRAINT fk_participant_of_entity FOREIGN KEY (in_entity_id)
        REFERENCES entities (id) ON DELETE CASCADE,
    CONSTRAINT fk_participant_of_promise FOREIGN KEY (out_promise_id)
        REFERENCES plot_promises (id) ON DELETE CASCADE
);

-- 26. ДИНАМИКА СЮЖЕТНЫХ АРОК (TYPE RELATION)
CREATE TABLE advances_arc (
    id            VARCHAR     NOT NULL,
    in_chapter_id VARCHAR,
    in_promise_id VARCHAR,
    out_arc_id    VARCHAR     NOT NULL,
    phase         VARCHAR     NOT NULL,
    transition    TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_advances_arc PRIMARY KEY (id),
    CONSTRAINT fk_advances_arc_chapter FOREIGN KEY (in_chapter_id)
        REFERENCES chapters (id) ON DELETE CASCADE,
    CONSTRAINT fk_advances_arc_promise FOREIGN KEY (in_promise_id)
        REFERENCES plot_promises (id) ON DELETE CASCADE,
    CONSTRAINT fk_advances_arc_arc FOREIGN KEY (out_arc_id)
        REFERENCES story_arcs (id) ON DELETE CASCADE,
    CONSTRAINT chk_advances_arc_source CHECK (
        (in_chapter_id IS NOT NULL) OR (in_promise_id IS NOT NULL)
    )
);

-- 27. ДИЕГЕТИЧЕСКАЯ ПРИВЯЗКА СЦЕНЫ К ТАЙМЛАЙНУ (TYPE RELATION)
CREATE TABLE occurs_at (
    id            VARCHAR     NOT NULL,
    in_promise_id VARCHAR     NOT NULL,
    out_event_id  VARCHAR     NOT NULL,
    time_nature   VARCHAR     NOT NULL DEFAULT 'present',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_occurs_at PRIMARY KEY (id),
    CONSTRAINT fk_occurs_at_promise FOREIGN KEY (in_promise_id)
        REFERENCES plot_promises (id) ON DELETE CASCADE,
    CONSTRAINT fk_occurs_at_event FOREIGN KEY (out_event_id)
        REFERENCES timeline_events (id) ON DELETE CASCADE,
    CONSTRAINT chk_occurs_at_time CHECK (time_nature IN ('present', 'flashback', 'flashforward', 'timeless'))
);

-- 28. СИСТЕМНЫЕ МЕТАДАННЫЕ СХЕМЫ
CREATE TABLE system_meta (
    id         VARCHAR     NOT NULL,
    ddl_hash   VARCHAR     NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_system_meta PRIMARY KEY (id)
);

-- ==============================================================================
-- ИНДЕКСЫ ПО ВНЕШНИМ КЛЮЧАМ И ПОИСКОВЫМ ПОЛЯМ
-- ==============================================================================
CREATE INDEX idx_volumes_project_id        ON volumes (project_id);
CREATE INDEX idx_chapters_volume_id        ON chapters (volume_id);
CREATE INDEX idx_text_blocks_chapter_id    ON text_blocks (chapter_id);
CREATE INDEX idx_story_arcs_project_id     ON story_arcs (project_id);
CREATE INDEX idx_planets_project_id        ON planets (project_id);
CREATE INDEX idx_calendars_planet_id       ON calendars (planet_id);
CREATE INDEX idx_entity_schemas_project_id ON entity_schemas (project_id);
CREATE INDEX idx_entities_schema_id        ON entities (schema_id);
CREATE INDEX idx_entity_rel_in_out         ON entity_rel (in_entity_id, out_entity_id);
CREATE INDEX idx_appears_in_entity         ON appears_in (in_entity_id);
CREATE INDEX idx_timeline_events_m_abs     ON timeline_events (project_id, m_abs);
CREATE INDEX idx_revealed_in_chapter       ON revealed_in (out_chapter_id);
CREATE INDEX idx_plot_promises_parent      ON plot_promises (parent_id);

COMMIT;
