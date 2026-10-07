import { describe, it, expect, beforeEach } from 'vitest';
import { purgeProjectStorage } from '../storage.purge';

describe('storage.purge', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('handles null, undefined or empty project gracefully', () => {
    localStorage.setItem('keep_me', '123');
    purgeProjectStorage(null);
    purgeProjectStorage(undefined);
    purgeProjectStorage('');
    expect(localStorage.getItem('keep_me')).toBe('123');
  });

  it('purges static and dynamic keys for a given project name', () => {
    localStorage.setItem('ww_plot_promises_novel1', JSON.stringify([{ id: 'p1' }]));
    localStorage.setItem('ww_plot_promises_projects:novel1', JSON.stringify([{ id: 'p2' }]));
    localStorage.setItem('worldwiki-state-novel1', JSON.stringify({ tab: 'editor' }));
    localStorage.setItem('worldwiki-state-projects:novel1', JSON.stringify({ tab: 'editor' }));
    localStorage.setItem('ww_schema_synced_novel1', 'v2_done');
    localStorage.setItem('entity-editor-draft-novel1', 'draft text');
    localStorage.setItem('chapters-sidebar-selected-arc-id', 'arc-123');
    localStorage.setItem('custom-novel1-cache', 'val');
    localStorage.setItem('unrelated_key', 'safe');

    purgeProjectStorage('novel1');

    expect(localStorage.getItem('ww_plot_promises_novel1')).toBeNull();
    expect(localStorage.getItem('ww_plot_promises_projects:novel1')).toBeNull();
    expect(localStorage.getItem('worldwiki-state-novel1')).toBeNull();
    expect(localStorage.getItem('worldwiki-state-projects:novel1')).toBeNull();
    expect(localStorage.getItem('ww_schema_synced_novel1')).toBeNull();
    expect(localStorage.getItem('entity-editor-draft-novel1')).toBeNull();
    expect(localStorage.getItem('chapters-sidebar-selected-arc-id')).toBeNull();
    expect(localStorage.getItem('custom-novel1-cache')).toBeNull();
    expect(localStorage.getItem('unrelated_key')).toBe('safe');
  });

  it('handles prefixed project names (projects:novel2)', () => {
    localStorage.setItem('ww_plot_promises_novel2', JSON.stringify([{ id: 'p1' }]));
    localStorage.setItem('worldwiki-state-novel2', JSON.stringify({ tab: 'lore' }));
    localStorage.setItem('other_project_data', 'keep');

    purgeProjectStorage('projects:novel2');

    expect(localStorage.getItem('ww_plot_promises_novel2')).toBeNull();
    expect(localStorage.getItem('worldwiki-state-novel2')).toBeNull();
    expect(localStorage.getItem('other_project_data')).toBe('keep');
  });
});
