import fs from 'node:fs';
import path from 'node:path';

// ============================================================================
// WorldWiki: ГОСТ А3 (420x297 мм -> 2100x1485 px, масштаб 5 px/мм)
// Модульная логическая схема БД: 4 изолированных фрейма (M1..M4) + обзорная карта
// ============================================================================

const W = 2100;
const H = 1485;
const ROW_H = 14.5;
const HEADER_H = 22;
const IO_H = 30;

// 4 модульных фрейма
const modules = [
  { id: 'M1', title: 'МОДУЛЬ M1: РУКОПИСЬ И ПЛАНИРОВЩИК',        x: 122,  y: 162, w: 518, h: 1085 },
  { id: 'M2', title: 'МОДУЛЬ M2: СЮЖЕТНЫЕ УЗЛЫ И ОБЕЩАНИЯ',    x: 658,  y: 162, w: 486, h: 1085 },
  { id: 'M3', title: 'МОДУЛЬ M3: ОНТОЛОГИЯ ЛОРА И ВЕРСИОННОСТЬ', x: 1162, y: 162, w: 486, h: 1005 },
  { id: 'M4', title: 'МОДУЛЬ M4: ХРОНОЛОГИЯ И СИСТЕМА',         x: 1666, y: 162, w: 388, h: 1005 },
];

// Внешние порты (off-page connectors, чтобы не тянуть линии через весь А3)
const ports = [
  // M2 ports
  { id: 'p_m2_arcs', x: 676,  y: 205, w: 145, h: 24, label: '→ [M1] story_arcs' },
  { id: 'p_m2_ch',   x: 978,  y: 205, w: 145, h: 24, label: '← [M1] chapters' },
  { id: 'p_m2_ent',  x: 978,  y: 445, w: 145, h: 24, label: '← [M3] entities' },
  { id: 'p_m2_blk',  x: 978,  y: 785, w: 145, h: 24, label: '→ [M1] text_blocks' },
  { id: 'p_m2_ev',   x: 978,  y: 1055,w: 145, h: 24, label: '→ [M4] timeline_events' },
  // M3 ports
  { id: 'p_m3_proj', x: 1180, y: 205, w: 145, h: 24, label: '← [M1] projects' },
  { id: 'p_m3_ch',   x: 1480, y: 890, w: 150, h: 24, label: '→ [M1] chapters | blocks' },
  // M4 ports
  { id: 'p_m4_proj', x: 1680, y: 205, w: 136, h: 24, label: '← [M1] projects' },
  { id: 'p_m4_ent',  x: 1680, y: 745, w: 132, h: 24, label: '← [M3] entities' },
  { id: 'p_m4_ch',   x: 1680, y: 925, w: 132, h: 24, label: '→ [M1] chapters' },
];

// Все 28 таблиц распределены строго по своим модулям M1..M4
const tables = [
  // ======================== M1: РУКОПИСЬ И ПЛАНИРОВЩИК ========================
  {
    id: 'projects', kind: 'hub', x: 140, y: 205, w: 220,
    fields: [
      { k: 'PK', name: 'id', type: 'record' },
      { k: '',   name: 'name', type: 'string' },
      { k: '',   name: 'type', type: 'string?' },
      { k: '',   name: 'genres', type: 'array' },
      { k: '',   name: 'cover_image', type: 'string?' },
      { k: '',   name: 'created_at', type: 'datetime' },
    ],
  },
  {
    id: 'contains', kind: 'relation', x: 140, y: 348, w: 220,
    inTypes: 'projects | volumes', outTypes: 'volumes | chapters',
    fields: [
      { k: 'PK', name: 'id', type: 'record' },
      { k: '',   name: 'sort_order', type: 'int' },
    ],
  },
  {
    id: 'volumes', kind: 'normal', x: 140, y: 465, w: 220,
    fields: [
      { k: 'PK', name: 'id', type: 'record' },
      { k: 'FK', name: 'project_id', type: 'record' },
      { k: '',   name: 'title', type: 'string' },
    ],
  },
  {
    id: 'chapters', kind: 'normal', x: 140, y: 585, w: 220,
    fields: [
      { k: 'PK', name: 'id', type: 'record' },
      { k: 'FK', name: 'volume_id', type: 'record' },
      { k: '',   name: 'title / content', type: 'string' },
      { k: '',   name: 'sort_order', type: 'int' },
      { k: '',   name: 'word_count', type: 'int' },
      { k: '',   name: 'created_at / updated_at', type: 'datetime' },
    ],
  },
  {
    id: 'text_blocks', kind: 'normal', x: 140, y: 745, w: 220,
    fields: [
      { k: 'PK', name: 'id', type: 'record' },
      { k: 'FK', name: 'chapter_id', type: 'record' },
      { k: '',   name: 'block_type', type: 'string' },
      { k: '',   name: 'order_index', type: 'int' },
      { k: '',   name: 'content', type: 'string' },
      { k: '',   name: 'created_at', type: 'datetime' },
    ],
  },
  {
    id: 'story_arcs', kind: 'normal', x: 400, y: 205, w: 222,
    fields: [
      { k: 'PK', name: 'id', type: 'record' },
      { k: 'FK', name: 'project_id', type: 'record' },
      { k: '',   name: 'title', type: 'string' },
      { k: '',   name: 'status', type: 'string' },
      { k: '',   name: 'created_at / updated_at', type: 'datetime' },
    ],
  },
  {
    id: 'todos', kind: 'normal', x: 400, y: 350, w: 222,
    fields: [
      { k: 'PK', name: 'id', type: 'record' },
      { k: 'FK', name: 'owner_vol / ch / arc', type: 'record?' },
      { k: 'FK', name: 'arc_id', type: 'record?' },
      { k: 'FK', name: 'depends_on', type: 'record?' },
      { k: '',   name: 'text', type: 'string' },
      { k: '',   name: 'status', type: 'string' },
      { k: '',   name: 'is_done', type: 'bool' },
      { k: '',   name: 'sort_order', type: 'int' },
      { k: '',   name: 'created_at / updated_at', type: 'datetime' },
    ],
  },
  {
    id: 'chapter_revisions', kind: 'audit', x: 400, y: 585, w: 222,
    fields: [
      { k: 'PK', name: 'id', type: 'record' },
      { k: 'FK', name: 'target_id', type: 'record' },
      { k: '',   name: 'content', type: 'object' },
      { k: '',   name: 'commit_msg', type: 'string?' },
      { k: '',   name: 'created_at', type: 'datetime' },
      { k: '',   name: 'is_pinned', type: 'bool' },
    ],
  },

  // ======================== M2: СЮЖЕТНЫЕ УЗЛЫ И ОБЕЩАНИЯ ========================
  {
    id: 'advances_arc', kind: 'relation', x: 676, y: 270, w: 210,
    inTypes: 'chapters | plot_promises', outTypes: 'story_arcs',
    fields: [
      { k: 'PK', name: 'id', type: 'record' },
      { k: '',   name: 'phase', type: 'string' },
      { k: '',   name: 'transition', type: 'string?' },
      { k: '',   name: 'created_at', type: 'datetime' },
    ],
  },
  {
    id: 'participant_of', kind: 'relation', x: 916, y: 310, w: 210,
    inTypes: 'entities', outTypes: 'plot_promises',
    fields: [
      { k: 'PK', name: 'id', type: 'record' },
      { k: '',   name: 'role', type: 'string?' },
      { k: '',   name: 'created_at', type: 'datetime' },
    ],
  },
  {
    id: 'plot_promises', kind: 'hub', x: 676, y: 485, w: 228,
    fields: [
      { k: 'PK', name: 'id', type: 'record' },
      { k: 'FK', name: 'parent_id', type: 'record?' },
      { k: 'FK', name: 'location_id', type: 'record?' },
      { k: 'FK', name: 'timeline_event_id', type: 'record?' },
      { k: '',   name: 'block_ids', type: 'array' },
      { k: '',   name: 'kind / status', type: 'string' },
      { k: '',   name: 'time_nature', type: 'string' },
      { k: '',   name: 'title', type: 'string' },
      { k: '',   name: 'note', type: 'string?' },
      { k: '',   name: 'created_at / updated_at', type: 'datetime' },
    ],
  },
  {
    id: 'spans_blocks', kind: 'relation', x: 676, y: 740, w: 226,
    inTypes: 'plot_promises', outTypes: 'text_blocks',
    fields: [
      { k: 'PK', name: 'id', type: 'record' },
      { k: '',   name: 'created_at', type: 'datetime' },
    ],
  },
  {
    id: 'promise_milestones', kind: 'relation', x: 676, y: 855, w: 226,
    inTypes: 'plot_promises', outTypes: 'text_blocks',
    fields: [
      { k: 'PK', name: 'id', type: 'record' },
      { k: '',   name: 'stage', type: 'string' },
      { k: '',   name: 'quote', type: 'string' },
      { k: '',   name: 'note', type: 'string?' },
      { k: '',   name: 'created_at', type: 'datetime' },
    ],
  },
  {
    id: 'occurs_at', kind: 'relation', x: 676, y: 1020, w: 226,
    inTypes: 'plot_promises', outTypes: 'timeline_events',
    fields: [
      { k: 'PK', name: 'id', type: 'record' },
      { k: '',   name: 'time_nature', type: 'string' },
      { k: '',   name: 'created_at', type: 'datetime' },
    ],
  },

  // ======================== M3: ОНТОЛОГИЯ ЛОРА И ВЕРСИОННОСТЬ ========================
  {
    id: 'entity_schemas', kind: 'normal', x: 1180, y: 265, w: 222,
    fields: [
      { k: 'PK', name: 'id', type: 'record' },
      { k: 'FK', name: 'project_id', type: 'record' },
      { k: 'UQ', name: 'type_key', type: 'string' },
      { k: '',   name: 'type_name', type: 'string' },
      { k: '',   name: 'fields_schema', type: 'array' },
      { k: '',   name: 'full_schema', type: 'object?' },
      { k: '',   name: 'created_at', type: 'datetime' },
    ],
  },
  {
    id: 'schema_history', kind: 'audit', x: 1418, y: 265, w: 214,
    fields: [
      { k: 'PK', name: 'id', type: 'record' },
      { k: 'FK', name: 'schema_id', type: 'record' },
      { k: 'FK', name: 'project_id', type: 'record' },
      { k: '',   name: 'type_key', type: 'string' },
      { k: '',   name: 'snapshot', type: 'object' },
      { k: '',   name: 'saved_at', type: 'datetime' },
      { k: '',   name: 'is_pinned / msg', type: 'bool/str' },
    ],
  },
  {
    id: 'entities', kind: 'normal', x: 1180, y: 455, w: 222,
    fields: [
      { k: 'PK', name: 'id', type: 'record' },
      { k: 'FK', name: 'schema_id', type: 'record' },
      { k: '',   name: 'name', type: 'string' },
      { k: '',   name: 'description', type: 'string?' },
      { k: '',   name: 'tags', type: 'array' },
      { k: '',   name: 'attributes', type: 'object' },
      { k: '',   name: 'created_at / updated_at', type: 'datetime' },
    ],
  },
  {
    id: 'entity_revisions', kind: 'audit', x: 1418, y: 455, w: 214,
    fields: [
      { k: 'PK', name: 'id', type: 'record' },
      { k: 'FK', name: 'target_id', type: 'record' },
      { k: '',   name: 'content', type: 'object' },
      { k: '',   name: 'commit_msg', type: 'string?' },
      { k: '',   name: 'created_at', type: 'datetime' },
      { k: '',   name: 'is_pinned', type: 'bool' },
    ],
  },
  {
    id: 'entity_rel', kind: 'relation', x: 1180, y: 650, w: 222,
    inTypes: 'entities', outTypes: 'entities',
    fields: [
      { k: 'PK', name: 'id', type: 'record' },
      { k: '',   name: 'rel_type / desc', type: 'string' },
      { k: '',   name: 'strength', type: 'int?' },
      { k: '',   name: 'attributes', type: 'object' },
      { k: 'FK', name: 'start_at_ch / vol', type: 'record?' },
      { k: 'FK', name: 'end_at_ch / vol', type: 'record?' },
      { k: '',   name: 'is_auto_extend', type: 'bool' },
      { k: '',   name: 'created_at', type: 'datetime' },
    ],
  },
  {
    id: 'entity_rel_revisions', kind: 'audit', x: 1418, y: 650, w: 214,
    fields: [
      { k: 'PK', name: 'id', type: 'record' },
      { k: 'FK', name: 'target_id', type: 'record' },
      { k: 'FK', name: 'in_id / out_id', type: 'record' },
      { k: '',   name: 'action', type: 'string' },
      { k: '',   name: 'content', type: 'object' },
      { k: '',   name: 'commit_msg', type: 'string?' },
      { k: '',   name: 'created_at', type: 'datetime' },
    ],
  },
  {
    id: 'appears_in', kind: 'relation', x: 1180, y: 890, w: 222,
    inTypes: 'entities', outTypes: 'chapters | text_blocks',
    fields: [
      { k: 'PK', name: 'id', type: 'record' },
      { k: '',   name: 'source', type: 'string' },
      { k: '',   name: 'count', type: 'int?' },
      { k: '',   name: 'created_at', type: 'datetime' },
    ],
  },
  {
    id: 'relation_schemas', kind: 'audit', x: 1418, y: 955, w: 214,
    fields: [
      { k: 'PK', name: 'id', type: 'record' },
      { k: 'FK', name: 'project_id', type: 'record' },
      { k: 'UQ', name: 'rel_key', type: 'string' },
      { k: '',   name: 'rel_name / icon / color', type: 'string' },
      { k: '',   name: 'from_types / to_types', type: 'array' },
    ],
  },

  // ======================== M4: ХРОНОЛОГИЯ И СИСТЕМА ========================
  {
    id: 'planets', kind: 'normal', x: 1730, y: 245, w: 265,
    fields: [
      { k: 'PK', name: 'id', type: 'record' },
      { k: 'FK', name: 'project_id', type: 'record' },
      { k: '',   name: 'name', type: 'string' },
      { k: '',   name: 'ticks_per_day', type: 'int' },
      { k: '',   name: 'axial_tilt_mdeg', type: 'int?' },
      { k: '',   name: 'orbit_days_num / den', type: 'int?' },
      { k: '',   name: 'moons / timezones / reg', type: 'array' },
      { k: '',   name: 'created_at / updated_at', type: 'datetime' },
    ],
  },
  {
    id: 'calendars', kind: 'normal', x: 1730, y: 415, w: 265,
    fields: [
      { k: 'PK', name: 'id', type: 'record' },
      { k: 'FK', name: 'planet_id', type: 'record' },
      { k: '',   name: 'name', type: 'string' },
      { k: '',   name: 'description', type: 'string?' },
      { k: '',   name: 'data', type: 'object' },
      { k: '',   name: 'is_default / is_master', type: 'bool' },
      { k: '',   name: 'created_at / updated_at', type: 'datetime' },
    ],
  },
  {
    id: 'timeline_events', kind: 'normal', x: 1730, y: 575, w: 265,
    fields: [
      { k: 'PK', name: 'id', type: 'record' },
      { k: 'FK', name: 'project_id', type: 'record' },
      { k: 'FK', name: 'calendar_id', type: 'record' },
      { k: '',   name: 'title', type: 'string' },
      { k: '',   name: 'description', type: 'string?' },
      { k: '',   name: 'm_abs', type: 'int' },
      { k: '',   name: 'created_at', type: 'datetime' },
    ],
  },
  {
    id: 'participates_in', kind: 'relation', x: 1838, y: 740, w: 202,
    inTypes: 'entities', outTypes: 'timeline_events',
    fields: [
      { k: 'PK', name: 'id', type: 'record' },
      { k: '',   name: 'role', type: 'string?' },
      { k: '',   name: 'notes', type: 'string?' },
      { k: '',   name: 'created_at', type: 'datetime' },
    ],
  },
  {
    id: 'revealed_in', kind: 'relation', x: 1838, y: 895, w: 202,
    inTypes: 'timeline_events', outTypes: 'chapters',
    fields: [
      { k: 'PK', name: 'id', type: 'record' },
      { k: 'FK', name: 'pov_id', type: 'record?' },
      { k: '',   name: 'kind', type: 'string' },
      { k: 'FK', name: 'block_id', type: 'record?' },
      { k: '',   name: 'created_at', type: 'datetime' },
    ],
  },
  {
    id: 'system_meta', kind: 'audit', x: 1838, y: 1065, w: 202,
    fields: [
      { k: 'PK', name: 'id', type: 'record' },
      { k: '',   name: 'ddl_hash', type: 'string' },
      { k: '',   name: 'updated_at', type: 'datetime' },
    ],
  },
];

for (const t of tables) {
  t.h = Math.round(HEADER_H + (t.kind === 'relation' ? IO_H : 0) + t.fields.length * ROW_H + 6);
}

const byId = Object.fromEntries([
  ...tables.map(t => [t.id, t]),
  ...ports.map(p => [p.id, p]),
]);

function L(id, fy = 0.5) { const t = byId[id]; return { x: t.x, y: Math.round(t.y + t.h * fy) }; }
function R(id, fy = 0.5) { const t = byId[id]; return { x: t.x + t.w, y: Math.round(t.y + t.h * fy) }; }
function T(id, fx = 0.5) { const t = byId[id]; return { x: Math.round(t.x + t.w * fx), y: t.y }; }
function B(id, fx = 0.5) { const t = byId[id]; return { x: Math.round(t.x + t.w * fx), y: t.y + t.h }; }
function poly(pts) { return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${Math.round(p.x)} ${Math.round(p.y)}`).join(' '); }

// Локальные связи (ТОЛЬКО внутри своих модулей — никаких длинных проводов!)
const relLinks = [
  // M1
  { d: poly([R('projects', 0.35), { x: 380, y: R('projects', 0.35).y }, { x: 380, y: L('story_arcs', 0.5).y }, L('story_arcs', 0.5)]) },
  { d: poly([R('projects', 0.65), { x: 372, y: R('projects', 0.65).y }, { x: 372, y: L('volumes', 0.45).y }, L('volumes', 0.45)]) },
  { d: poly([B('volumes', 0.5), T('chapters', 0.5)]) },
  { d: poly([B('chapters', 0.5), T('text_blocks', 0.5)]) },
  { d: poly([B('story_arcs', 0.5), T('todos', 0.5)]) },
  { d: poly([R('volumes', 0.5), { x: 382, y: R('volumes', 0.5).y }, { x: 382, y: L('todos', 0.55).y }, L('todos', 0.55)]) },
  { d: poly([R('chapters', 0.35), { x: 390, y: R('chapters', 0.35).y }, { x: 390, y: L('todos', 0.78).y }, L('todos', 0.78)]) },
  { d: poly([R('chapters', 0.65), L('chapter_revisions', 0.5)]) },

  // M3
  { d: poly([B('p_m3_proj', 0.5), T('entity_schemas', 0.3)]) },
  { d: poly([R('entity_schemas', 0.5), L('schema_history', 0.5)]) },
  { d: poly([B('entity_schemas', 0.5), T('entities', 0.5)]) },
  { d: poly([R('entities', 0.5), L('entity_revisions', 0.5)]) },
  { d: poly([R('entity_rel', 0.5), L('entity_rel_revisions', 0.5)]) },
  { d: poly([R('p_m3_proj', 0.5), { x: 1640, y: R('p_m3_proj', 0.5).y }, { x: 1640, y: R('relation_schemas', 0.5).y }, R('relation_schemas', 0.5)]) },

  // M4
  { d: poly([B('p_m4_proj', 0.5), { x: 1756, y: 237 }, { x: 1862, y: 237 }, T('planets', 0.5)]) },
  { d: poly([B('planets', 0.5), T('calendars', 0.5)]) },
  { d: poly([B('calendars', 0.5), T('timeline_events', 0.5)]) },
];

const graphLinks = [
  // M1: contains
  { d: poly([B('projects', 0.5), T('contains', 0.5)]) },
  { d: poly([L('volumes', 0.25), { x: 130, y: L('volumes', 0.25).y }, { x: 130, y: L('contains', 0.5).y }, L('contains', 0.5)]) },
  { d: poly([B('contains', 0.35), T('volumes', 0.35)]) },
  { d: poly([R('contains', 0.65), { x: 376, y: R('contains', 0.65).y }, { x: 376, y: R('chapters', 0.2).y }, R('chapters', 0.2)]) },

  // M2: plot_promises hub + 5 relations
  { d: poly([B('p_m2_arcs', 0.5), T('advances_arc', 0.4)]) },
  { d: poly([L('p_m2_ch', 0.5), { x: 840, y: L('p_m2_ch', 0.5).y }, T('advances_arc', 0.72)]) },
  { d: poly([T('plot_promises', 0.5), B('advances_arc', 0.5)]) },

  { d: poly([B('p_m2_ent', 0.5), T('participant_of', 0.65)]) },
  { d: poly([B('participant_of', 0.5), { x: 1013, y: 495 }, R('plot_promises', 0.15)]) },

  { d: poly([R('plot_promises', 0.55), { x: 930, y: R('plot_promises', 0.55).y }, { x: 930, y: R('spans_blocks', 0.5).y }, R('spans_blocks', 0.5)]) },
  { d: poly([R('spans_blocks', 0.75), L('p_m2_blk', 0.5)]) },

  { d: poly([L('plot_promises', 0.75), { x: 666, y: L('plot_promises', 0.75).y }, { x: 666, y: L('promise_milestones', 0.5).y }, L('promise_milestones', 0.5)]) },
  { d: poly([R('promise_milestones', 0.5), { x: 946, y: R('promise_milestones', 0.5).y }, { x: 946, y: B('p_m2_blk', 0.5).y + 20 }, { x: B('p_m2_blk', 0.5).x, y: B('p_m2_blk', 0.5).y + 20 }, B('p_m2_blk', 0.5)]) },

  { d: poly([B('plot_promises', 0.5), { x: 790, y: 1002 }, T('occurs_at', 0.5)]) },
  { d: poly([R('occurs_at', 0.5), L('p_m2_ev', 0.5)]) },

  // M3: entity_rel & appears_in
  { d: poly([B('entities', 0.35), T('entity_rel', 0.35)]) },
  { d: poly([T('entity_rel', 0.72), B('entities', 0.72)]) },
  { d: poly([L('entities', 0.75), { x: 1170, y: L('entities', 0.75).y }, { x: 1170, y: L('appears_in', 0.5).y }, L('appears_in', 0.5)]) },
  { d: poly([R('appears_in', 0.5), L('p_m3_ch', 0.5)]) },

  // M4: participates_in & revealed_in
  { d: poly([R('p_m4_ent', 0.5), { x: 1922, y: R('p_m4_ent', 0.5).y }, T('participates_in', 0.5)]) },
  { d: poly([T('participates_in', 0.2), { x: 1855, y: 710 }, { x: 1855, y: B('timeline_events', 0.5).y + 10 }, B('timeline_events', 0.5)]) },
  { d: poly([R('timeline_events', 0.65), { x: 2044, y: R('timeline_events', 0.65).y }, { x: 2044, y: R('revealed_in', 0.5).y }, R('revealed_in', 0.5)]) },
  { d: poly([L('revealed_in', 0.5), R('p_m4_ch', 0.5)]) },
];

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const out = [];
out.push(`<?xml version="1.0" encoding="UTF-8"?>`);
out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="'Segoe UI', 'DejaVu Sans', Arial, sans-serif">`);
out.push(`
  <defs>
    <marker id="graph-arrow" viewBox="0 0 12 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto">
      <path d="M 0 1 L 11 5 L 0 9 z" fill="#000000"/>
    </marker>
    <marker id="one-start" viewBox="0 0 14 14" refX="0" refY="7" markerWidth="10" markerHeight="10" orient="auto-start-reverse">
      <line x1="6" y1="2" x2="6" y2="12" stroke="#444444" stroke-width="1.3"/>
    </marker>
    <marker id="many-opt-end" viewBox="0 0 22 14" refX="21" refY="7" markerWidth="14" markerHeight="10" orient="auto">
      <circle cx="5.5" cy="7" r="2.8" fill="#ffffff" stroke="#444444" stroke-width="1.2"/>
      <line x1="8.5" y1="7" x2="21" y2="7" stroke="#444444" stroke-width="1.2"/>
      <line x1="21" y1="2" x2="11" y2="7" stroke="#444444" stroke-width="1.2"/>
      <line x1="21" y1="12" x2="11" y2="7" stroke="#444444" stroke-width="1.2"/>
    </marker>
  </defs>
  <style>
    .bg { fill: #ffffff; }
    .frame-outer { fill: none; stroke: #000000; stroke-width: 1; }
    .frame-inner { fill: none; stroke: #000000; stroke-width: 2.2; }

    /* Module Frames and Top Overview Map */
    .mod-box { fill: #ffffff; stroke: #000000; stroke-width: 1.4; stroke-dasharray: 8 4; rx: 6; ry: 6; }
    .mod-hdr { fill: #222222; rx: 3; ry: 3; }
    .mod-hdr-txt { font-size: 11px; font-weight: 700; letter-spacing: 0.4px; fill: #ffffff; }
    .map-box { fill: #f5f5f5; stroke: #000000; stroke-width: 1.5; rx: 5; ry: 5; }
    .map-title { font-size: 11.5px; font-weight: 700; fill: #000000; text-anchor: middle; }
    .map-sub { font-size: 10px; fill: #333333; text-anchor: middle; }
    .map-lbl { font-size: 9.5px; font-style: italic; fill: #222222; text-anchor: middle; }

    /* Off-page Port Connectors */
    .port-box { fill: #f0f0f0; stroke: #333333; stroke-width: 1.2; stroke-dasharray: 3 2; rx: 10; ry: 10; }
    .port-txt { font-family: 'Consolas', monospace; font-size: 10px; font-weight: 700; fill: #111111; text-anchor: middle; }

    /* Tables */
    .tbl-normal { fill: #ffffff; stroke: #000000; stroke-width: 1.4; }
    .tbl-normal-hdr { fill: #222222; }
    .tbl-hub { fill: #ffffff; stroke: #000000; stroke-width: 2.1; }
    .tbl-hub-hdr { fill: #000000; }
    .tbl-rel { fill: #fafafa; stroke: #000000; stroke-width: 1.5; stroke-dasharray: 5 3; }
    .tbl-rel-hdr { fill: #444444; }
    .tbl-audit { fill: #ffffff; stroke: #555555; stroke-width: 1.2; }
    .tbl-audit-hdr { fill: #666666; }

    .hdr-title { font-size: 11.5px; font-weight: 700; fill: #ffffff; }
    .hdr-badge { font-size: 8.5px; font-weight: 700; fill: #ffffff; text-anchor: end; opacity: 0.9; }
    .io-box { fill: #eeeeee; stroke: #999999; stroke-width: 0.7; }
    .io-text { font-family: 'Consolas', monospace; font-size: 9.5px; fill: #111111; }
    .fld-key { font-family: 'Consolas', monospace; font-size: 8.8px; font-weight: 700; fill: #000000; }
    .fld-name { font-family: 'Consolas', monospace; font-size: 9.8px; fill: #000000; }
    .fld-name-pk { font-family: 'Consolas', monospace; font-size: 9.8px; font-weight: 700; text-decoration: underline; fill: #000000; }
    .fld-type { font-family: 'Consolas', monospace; font-size: 9px; fill: #444444; text-anchor: end; }
    .divider { stroke: #d4d4d4; stroke-width: 0.7; }

    .rel-line { fill: none; stroke: #444444; stroke-width: 1.15; stroke-dasharray: 4 3; stroke-linejoin: round; }
    .graph-line { fill: none; stroke: #000000; stroke-width: 1.7; stroke-linejoin: round; }

    /* GOST 2.104 Stamp and Legend */
    .stamp-line { fill: none; stroke: #000000; stroke-width: 1.1; }
    .stamp-bold { fill: none; stroke: #000000; stroke-width: 1.9; }
    .stamp-txt { font-size: 9.2px; fill: #000000; }
    .stamp-txt-b { font-size: 11.5px; font-weight: 700; fill: #000000; text-anchor: middle; }
    .stamp-title { font-size: 15px; font-weight: 700; fill: #000000; text-anchor: middle; }
    .legend-box { fill: #ffffff; stroke: #000000; stroke-width: 1.25; }
    .legend-hdr { font-size: 12px; font-weight: 700; fill: #000000; }
    .legend-txt { font-size: 11px; fill: #111111; }
  </style>
`);

// Рамка А3
out.push(`<rect class="bg" x="0" y="0" width="${W}" height="${H}"/>`);
out.push(`<rect class="frame-outer" x="1" y="1" width="${W - 2}" height="${H - 2}"/>`);
out.push(`<rect class="frame-inner" x="100" y="25" width="1975" height="1435"/>`);

// ============================================================================
// ВЕРХНЯЯ ОБЗОРНАЯ КАРТА СВЯЗЕЙ МЕЖДУ МОДУЛЯМИ (y = 40..144)
// ============================================================================
out.push(`<g>`);
out.push(`  <rect x="122" y="38" width="1932" height="108" fill="#fafafa" stroke="#000000" stroke-width="1.2" rx="5"/>`);
out.push(`  <text x="136" y="56" font-size="11" font-weight="700" fill="#000000">АРХИТЕКТУРНАЯ КАРТА ВЗАИМОСВЯЗИ ПОДСИСТЕМ (ДЕКОМПОЗИЦИЯ ЛОГИЧЕСКОЙ СХЕМЫ НА МОДУЛИ M1–M4)</text>`);

const mapNodes = [
  { x: 140,  y: 70, w: 380, h: 62, t: 'M1: Рукопись и планировщик',    s: 'projects, volumes, chapters, text_blocks, todos, arcs' },
  { x: 640,  y: 70, w: 380, h: 62, t: 'M2: Сюжетные узлы и обещания', s: 'plot_promises, advances_arc, milestones, occurs_at' },
  { x: 1140, y: 70, w: 390, h: 62, t: 'M3: Онтология лора и ревизии',  s: 'entity_schemas, entities, entity_rel, appears_in, audit' },
  { x: 1650, y: 70, w: 384, h: 62, t: 'M4: Хронология и система',      s: 'planets, calendars, timeline_events, revealed_in, meta' },
];
for (const m of mapNodes) {
  out.push(`  <rect class="map-box" x="${m.x}" y="${m.y}" width="${m.w}" height="${m.h}"/>`);
  out.push(`  <text class="map-title" x="${m.x + m.w / 2}" y="${m.y + 25}">${m.t}</text>`);
  out.push(`  <text class="map-sub" x="${m.x + m.w / 2}" y="${m.y + 45}">${m.s}</text>`);
}
// Стрелки между M1-M2-M3-M4 на обзорной карте
out.push(`  <line class="graph-line" x1="520" y1="101" x2="636" y2="101" marker-end="url(#graph-arrow)"/>`);
out.push(`  <text class="map-lbl" x="578" y="94">сцены / арки</text>`);
out.push(`  <line class="graph-line" x1="1140" y1="101" x2="1024" y2="101" marker-end="url(#graph-arrow)"/>`);
out.push(`  <text class="map-lbl" x="1082" y="94">участники</text>`);
out.push(`  <line class="graph-line" x1="1530" y1="101" x2="1646" y2="101" marker-end="url(#graph-arrow)"/>`);
out.push(`  <text class="map-lbl" x="1588" y="94">события</text>`);
out.push(`</g>`);

// ============================================================================
// 4 МОДУЛЬНЫХ ФРЕЙМА (M1..M4)
// ============================================================================
for (const m of modules) {
  out.push(`<g>`);
  out.push(`  <rect class="mod-box" x="${m.x}" y="${m.y}" width="${m.w}" height="${m.h}"/>`);
  out.push(`  <rect class="mod-hdr" x="${m.x}" y="${m.y}" width="${m.w}" height="24"/>`);
  out.push(`  <text class="mod-hdr-txt" x="${m.x + 12}" y="${m.y + 16}">${m.title}</text>`);
  out.push(`</g>`);
}

// Локальные связи внутри каждого модуля
for (const l of relLinks) {
  out.push(`<path class="rel-line" d="${l.d}" marker-start="url(#one-start)" marker-end="url(#many-opt-end)"/>`);
}
for (const l of graphLinks) {
  out.push(`<path class="graph-line" d="${l.d}" marker-end="url(#graph-arrow)"/>`);
}

// Внешние порты (off-page connectors)
for (const p of ports) {
  out.push(`<g>`);
  out.push(`  <rect class="port-box" x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}"/>`);
  out.push(`  <text class="port-txt" x="${p.x + p.w / 2}" y="${p.y + 15}">${esc(p.label)}</text>`);
  out.push(`</g>`);
}

// Все 28 таблиц
for (const t of tables) {
  const cls = t.kind === 'hub' ? 'tbl-hub' : t.kind === 'relation' ? 'tbl-rel' : t.kind === 'audit' ? 'tbl-audit' : 'tbl-normal';
  const hdrCls = t.kind === 'hub' ? 'tbl-hub-hdr' : t.kind === 'relation' ? 'tbl-rel-hdr' : t.kind === 'audit' ? 'tbl-audit-hdr' : 'tbl-normal-hdr';
  const badge = t.kind === 'hub' ? 'HUB' : t.kind === 'relation' ? 'RELATION' : t.kind === 'audit' ? 'AUDIT' : 'TABLE';

  out.push(`<g>`);
  out.push(`  <rect class="${cls}" x="${t.x}" y="${t.y}" width="${t.w}" height="${t.h}" rx="3" ry="3"/>`);
  out.push(`  <rect class="${hdrCls}" x="${t.x}" y="${t.y}" width="${t.w}" height="${HEADER_H}" rx="2" ry="2"/>`);
  out.push(`  <text class="hdr-title" x="${t.x + 8}" y="${t.y + 15}">${esc(t.id)}</text>`);
  out.push(`  <text class="hdr-badge" x="${t.x + t.w - 7}" y="${t.y + 15}">${badge}</text>`);

  let curY = t.y + HEADER_H;
  if (t.kind === 'relation') {
    out.push(`  <rect class="io-box" x="${t.x + 1}" y="${curY}" width="${t.w - 2}" height="${IO_H}"/>`);
    out.push(`  <text class="io-text" x="${t.x + 6}" y="${curY + 12}"><tspan font-weight="700">IN:</tspan>  ${esc(t.inTypes)}</text>`);
    out.push(`  <text class="io-text" x="${t.x + 6}" y="${curY + 24}"><tspan font-weight="700">OUT:</tspan> ${esc(t.outTypes)}</text>`);
    curY += IO_H;
  }

  t.fields.forEach((f, idx) => {
    const fy = curY + idx * ROW_H + 11;
    if (idx > 0 && t.fields[idx - 1].k === 'PK') {
      out.push(`  <line class="divider" x1="${t.x + 4}" y1="${curY + idx * ROW_H}" x2="${t.x + t.w - 4}" y2="${curY + idx * ROW_H}"/>`);
    }
    if (f.k) out.push(`  <text class="fld-key" x="${t.x + 6}" y="${fy}">${esc(f.k)}</text>`);
    out.push(`  <text class="${f.k === 'PK' ? 'fld-name-pk' : 'fld-name'}" x="${t.x + 25}" y="${fy}">${esc(f.name)}</text>`);
    out.push(`  <text class="fld-type" x="${t.x + t.w - 6}" y="${fy}">${esc(f.type)}</text>`);
  });

  out.push(`</g>`);
}

// ============================================================================
// ЛЕГЕНДА (x=122..1144, y=1265..1440)
// ============================================================================
out.push(`<g>`);
out.push(`  <rect class="legend-box" x="122" y="1265" width="1022" height="175" rx="4" ry="4"/>`);
out.push(`  <text class="legend-hdr" x="142" y="1290">Условные обозначения (модульная логическая нотация ER + Property Graph Association Class)</text>`);

out.push(`  <rect class="tbl-normal" x="142" y="1308" width="100" height="30" rx="2"/><rect class="tbl-normal-hdr" x="142" y="1308" width="100" height="13"/><text x="148" y="1318" font-size="8.5" font-weight="700" fill="#fff">TABLE</text>`);
out.push(`  <text class="legend-txt" x="254" y="1327">Обычная таблица узлов (PK / FK / UQ, «?» = option)</text>`);

out.push(`  <rect class="tbl-rel" x="142" y="1350" width="100" height="30" rx="2"/><rect class="tbl-rel-hdr" x="142" y="1350" width="100" height="13"/><text x="148" y="1360" font-size="8.5" font-weight="700" fill="#fff">RELATION</text>`);
out.push(`  <text class="legend-txt" x="254" y="1369">Графовое отношение TYPE RELATION (IN / OUT + атрибуты)</text>`);

out.push(`  <rect class="tbl-audit" x="142" y="1392" width="100" height="30" rx="2"/><rect class="tbl-audit-hdr" x="142" y="1392" width="100" height="13"/><text x="148" y="1402" font-size="8.5" font-weight="700" fill="#fff">AUDIT</text>`);
out.push(`  <text class="legend-txt" x="254" y="1411">Таблицы ревизий, схем связей и метаданных DDL</text>`);

out.push(`  <line class="graph-line" x1="650" y1="1323" x2="725" y2="1323" marker-end="url(#graph-arrow)"/>`);
out.push(`  <text class="legend-txt" x="738" y="1318">Графовый поток (IN → RELATION → OUT):</text>`);
out.push(`  <text class="legend-txt" x="738" y="1333" font-size="10" fill="#334155">1 ребро = 1 IN + 1 OUT; узел участвует в 0..N связях</text>`);

out.push(`  <line class="rel-line" x1="650" y1="1365" x2="725" y2="1365" marker-start="url(#one-start)" marker-end="url(#many-opt-end)"/>`);
out.push(`  <text class="legend-txt" x="738" y="1369">Реляционная связь FK (1:N / 0..N)</text>`);

out.push(`  <rect class="port-box" x="650" y="1395" width="75" height="24"/><text class="port-txt" x="687" y="1410">→ [M1] ...</text>`);
out.push(`  <text class="legend-txt" x="738" y="1411">Межмодульный коннектор (ссылка на таблицу другого модуля)</text>`);
out.push(`</g>`);

// ============================================================================
// ОСНОВНАЯ НАДПИСЬ ГОСТ 2.104 (Форма 1: 185x55 мм -> 925x275 px)
// ============================================================================
const sx = 1150, sy = 1185;
out.push(`<g>`);
out.push(`  <rect class="stamp-bold" x="${sx}" y="${sy}" width="925" height="275"/>`);
const colWidths = [52, 42, 111, 70, 50];
let cx = sx;
for (const cw of colWidths) { out.push(`  <line class="stamp-line" x1="${cx}" y1="${sy}" x2="${cx}" y2="${sy + 275}"/>`); cx += cw; }
out.push(`  <line class="stamp-bold" x1="${sx + 325}" y1="${sy}" x2="${sx + 325}" y2="${sy + 275}"/>`);
for (let r = 1; r < 11; r++) {
  const ry = sy + r * 25;
  out.push(`  <line class="${(r === 4 || r === 5) ? 'stamp-bold' : 'stamp-line'}" x1="${sx}" y1="${ry}" x2="${sx + 325}" y2="${ry}"/>`);
}
cx = sx;
['Изм.', 'Лист', '№ докум.', 'Подп.', 'Дата'].forEach((h, i) => {
  out.push(`  <text class="stamp-txt" x="${cx + colWidths[i] / 2}" y="${sy + 117}" text-anchor="middle">${h}</text>`);
  cx += colWidths[i];
});
['Разраб.', 'Проверил', 'Т.контр.', '', 'Н.контр.', 'Утв.'].forEach((role, i) => {
  if (role) out.push(`  <text class="stamp-txt" x="${sx + 4}" y="${sy + 142 + i * 25}">${role}</text>`);
});
out.push(`  <line class="stamp-bold" x1="${sx + 325}" y1="${sy + 70}" x2="${sx + 925}" y2="${sy + 70}"/>`);
out.push(`  <text class="stamp-title" x="${sx + 625}" y="${sy + 42}">КП.09.03.04.001 ДЗ</text>`);
out.push(`  <line class="stamp-bold" x1="${sx + 675}" y1="${sy + 70}" x2="${sx + 675}" y2="${sy + 275}"/>`);
out.push(`  <line class="stamp-bold" x1="${sx + 325}" y1="${sy + 200}" x2="${sx + 925}" y2="${sy + 200}"/>`);
out.push(`  <text class="stamp-title" x="${sx + 500}" y="${sy + 128}">WorldWiki</text>`);
out.push(`  <text class="stamp-txt-b" x="${sx + 500}" y="${sy + 155}">Логическая схема базы данных</text>`);
out.push(`  <text class="stamp-txt" x="${sx + 500}" y="${sy + 178}" text-anchor="middle">(Модули M1–M4: ER + Property Graph)</text>`);
out.push(`  <line class="stamp-line" x1="${sx + 675}" y1="${sy + 95}" x2="${sx + 925}" y2="${sy + 95}"/>`);
out.push(`  <line class="stamp-bold" x1="${sx + 675}" y1="${sy + 150}" x2="${sx + 925}" y2="${sy + 150}"/>`);
out.push(`  <line class="stamp-line" x1="${sx + 750}" y1="${sy + 70}" x2="${sx + 750}" y2="${sy + 150}"/>`);
out.push(`  <line class="stamp-line" x1="${sx + 835}" y1="${sy + 70}" x2="${sx + 835}" y2="${sy + 150}"/>`);
out.push(`  <line class="stamp-line" x1="${sx + 795}" y1="${sy + 150}" x2="${sx + 795}" y2="${sy + 200}"/>`);
out.push(`  <text class="stamp-txt" x="${sx + 712}" y="${sy + 87}" text-anchor="middle">Лит.</text>`);
out.push(`  <text class="stamp-txt" x="${sx + 792}" y="${sy + 87}" text-anchor="middle">Масса</text>`);
out.push(`  <text class="stamp-txt" x="${sx + 880}" y="${sy + 87}" text-anchor="middle">Масштаб</text>`);
out.push(`  <text class="stamp-txt-b" x="${sx + 712}" y="${sy + 128}">У</text>`);
out.push(`  <text class="stamp-txt" x="${sx + 735}" y="${sy + 178}" text-anchor="middle">Лист 1</text>`);
out.push(`  <text class="stamp-txt" x="${sx + 860}" y="${sy + 178}" text-anchor="middle">Листов 2</text>`);
out.push(`  <text class="stamp-txt" x="${sx + 500}" y="${sy + 242}" text-anchor="middle">SurrealDB v3.2 (SCHEMAFULL)</text>`);
out.push(`  <text class="stamp-txt-b" x="${sx + 800}" y="${sy + 235}">Кафедра ИТ / Группа</text>`);
out.push(`  <text class="stamp-txt" x="${sx + 800}" y="${sy + 256}" text-anchor="middle">(Курсовой проект)</text>`);
out.push(`</g>`);

out.push(`</svg>`);

const outPath = path.resolve('docs/coursework/diagrams/logical_schema_a3.svg');
fs.writeFileSync(outPath, out.join('\n'), 'utf8');
console.log('Generated:', outPath, 'Tables:', tables.length);

// Проверка пересечений всех таблиц и портов
const allItems = [...tables, ...ports];
let overlaps = 0;
for (let i = 0; i < allItems.length; i++) {
  const a = allItems[i];
  for (let j = i + 1; j < allItems.length; j++) {
    const b = allItems[j];
    if (a.x < b.x + b.w + 6 && a.x + a.w + 6 > b.x && a.y < b.y + b.h + 6 && a.y + a.h + 6 > b.y) {
      console.log('OVERLAP:', a.id, `(${a.x},${a.y})`, 'vs', b.id, `(${b.x},${b.y})`);
      overlaps++;
    }
  }
  if (a.x + a.w > 1140 && a.y + a.h > 1175) { console.log('HITS STAMP:', a.id); overlaps++; }
  if (a.x < 1144 && a.y + a.h > 1255) { console.log('HITS LEGEND:', a.id); overlaps++; }
}
console.log('Overlaps:', overlaps);
