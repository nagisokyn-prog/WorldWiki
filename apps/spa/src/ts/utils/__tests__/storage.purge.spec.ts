import { describe, it, expect, beforeEach } from 'vitest';
import { purgeProjectStorage } from '../storage.purge';

describe('storage.purge', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // ─── Guard cases ─────────────────────────────────────────────────────────
  it('handles null, undefined or empty project gracefully', () => {
    localStorage.setItem('keep_me', '123');
    purgeProjectStorage(null);
    purgeProjectStorage(undefined);
    purgeProjectStorage('');
    expect(localStorage.getItem('keep_me')).toBe('123');
  });

  // ─── Static keys ─────────────────────────────────────────────────────────
  it('purges all known static project keys (raw name)', () => {
    localStorage.setItem('ww_plot_promises_novel1', 'p1');
    localStorage.setItem('ww_plot_promises_projects:novel1', 'p2');
    localStorage.setItem('worldwiki-state-novel1', '{}');
    localStorage.setItem('worldwiki-state-projects:novel1', '{}');
    // реальный ключ синхронизации схем (entity.api.ts)
    localStorage.setItem('worldwiki_schema_sync_v2_novel1', 'v2_done');
    localStorage.setItem('worldwiki_schema_sync_v2_projects:novel1', 'v2_done');
    // легаси-ключ (старые профили)
    localStorage.setItem('ww_schema_synced_novel1', 'v2_done');
    // черновик сущности
    localStorage.setItem('entity-editor-draft-novel1', 'draft');
    // планеты (calendar.store)
    localStorage.setItem('worldwiki:planets:novel1', '[]');
    // несвязанный ключ — должен остаться
    localStorage.setItem('unrelated_key', 'safe');

    purgeProjectStorage('novel1');

    expect(localStorage.getItem('ww_plot_promises_novel1')).toBeNull();
    expect(localStorage.getItem('ww_plot_promises_projects:novel1')).toBeNull();
    expect(localStorage.getItem('worldwiki-state-novel1')).toBeNull();
    expect(localStorage.getItem('worldwiki-state-projects:novel1')).toBeNull();
    expect(localStorage.getItem('worldwiki_schema_sync_v2_novel1')).toBeNull();
    expect(localStorage.getItem('worldwiki_schema_sync_v2_projects:novel1')).toBeNull();
    expect(localStorage.getItem('ww_schema_synced_novel1')).toBeNull();
    expect(localStorage.getItem('entity-editor-draft-novel1')).toBeNull();
    expect(localStorage.getItem('worldwiki:planets:novel1')).toBeNull();
    expect(localStorage.getItem('unrelated_key')).toBe('safe');
  });

  // ─── Global session keys ─────────────────────────────────────────────────
  it('purges global session keys (sidebar state) on any project purge', () => {
    localStorage.setItem('chapters-sidebar-selected-arc-id', 'arc-123');
    localStorage.setItem('chapters-sidebar-active-tab', 'plans');
    localStorage.setItem('chapters-sidebar-plan-scope', 'volume');
    localStorage.setItem('unrelated_key', 'safe');

    purgeProjectStorage('novel1');

    expect(localStorage.getItem('chapters-sidebar-selected-arc-id')).toBeNull();
    expect(localStorage.getItem('chapters-sidebar-active-tab')).toBeNull();
    expect(localStorage.getItem('chapters-sidebar-plan-scope')).toBeNull();
    expect(localStorage.getItem('unrelated_key')).toBe('safe');
  });

  // ─── Dynamic scan: editor-state-* ────────────────────────────────────────
  it('purges dynamic editor-state keys (project-title combinations)', () => {
    localStorage.setItem('editor-state-novel1-chapter_one', '{"cursor":0}');
    localStorage.setItem('editor-state-novel1-prologue', '{"cursor":10}');
    // ключ другого проекта — должен остаться
    localStorage.setItem('editor-state-novel2-chapter_one', '{"cursor":5}');

    purgeProjectStorage('novel1');

    expect(localStorage.getItem('editor-state-novel1-chapter_one')).toBeNull();
    expect(localStorage.getItem('editor-state-novel1-prologue')).toBeNull();
    expect(localStorage.getItem('editor-state-novel2-chapter_one')).toBe('{"cursor":5}');
  });

  // ─── Dynamic scan: custom project-named keys ──────────────────────────────
  it('purges arbitrary project-named keys found during scan', () => {
    localStorage.setItem('custom-novel1-cache', 'val');
    localStorage.setItem('unrelated_key', 'safe');

    purgeProjectStorage('novel1');

    expect(localStorage.getItem('custom-novel1-cache')).toBeNull();
    expect(localStorage.getItem('unrelated_key')).toBe('safe');
  });

  // ─── Prefixed project name ────────────────────────────────────────────────
  it('handles prefixed project names (projects:novel2)', () => {
    localStorage.setItem('ww_plot_promises_novel2', 'p1');
    localStorage.setItem('worldwiki-state-novel2', '{}');
    localStorage.setItem('worldwiki_schema_sync_v2_novel2', 'v2_done');
    localStorage.setItem('editor-state-novel2-ch1', '{}');
    localStorage.setItem('other_project_data', 'keep');

    purgeProjectStorage('projects:novel2');

    expect(localStorage.getItem('ww_plot_promises_novel2')).toBeNull();
    expect(localStorage.getItem('worldwiki-state-novel2')).toBeNull();
    expect(localStorage.getItem('worldwiki_schema_sync_v2_novel2')).toBeNull();
    expect(localStorage.getItem('editor-state-novel2-ch1')).toBeNull();
    expect(localStorage.getItem('other_project_data')).toBe('keep');
  });

  // ─── Device-level keys must NOT be touched ───────────────────────────────
  it('does NOT purge device-level layout keys', () => {
    localStorage.setItem('app-zoom', '1.25');
    localStorage.setItem('app-panel-height', '200');
    localStorage.setItem('app-sidebar-width', '300');
    localStorage.setItem('chapters-sidebar-width', '280');
    localStorage.setItem('chapters-right-panel-visible', 'true');
    localStorage.setItem('split-view-show-structure', 'true');
    localStorage.setItem('default-editor-mode', 'wysiwyg');
    localStorage.setItem('worldwiki-calendar-widget-height', '170');

    purgeProjectStorage('novel1');

    expect(localStorage.getItem('app-zoom')).toBe('1.25');
    expect(localStorage.getItem('app-panel-height')).toBe('200');
    expect(localStorage.getItem('app-sidebar-width')).toBe('300');
    expect(localStorage.getItem('chapters-sidebar-width')).toBe('280');
    expect(localStorage.getItem('chapters-right-panel-visible')).toBe('true');
    expect(localStorage.getItem('split-view-show-structure')).toBe('true');
    expect(localStorage.getItem('default-editor-mode')).toBe('wysiwyg');
    expect(localStorage.getItem('worldwiki-calendar-widget-height')).toBe('170');
  });
});
