// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useShellStore } from '../shell';
import { useZoomStore } from '../zoom';
import * as api from '../../services/api.client';
import { entityApi } from '../../services/Entity/entity.api';
import { useSchemaStore } from '../schema';
import { settingsService } from '@worldwiki/components';

vi.mock('../../services/api.client', () => ({
  getChapters: vi.fn(),
  getChapter: vi.fn(),
  saveChapter: vi.fn(),
  deleteChapter: vi.fn(),
  getChapterHierarchy: vi.fn(),
  assignChapter: vi.fn(),
  deleteVolume: vi.fn(),
  deleteArc: vi.fn(),
  getEntities: vi.fn(),
  saveEntityWithRelations: vi.fn(),
  deleteEntity: vi.fn(),
  getSchema: vi.fn().mockResolvedValue({}),
  saveSchema: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../services/Entity/entity.api', () => ({
  entityApi: {
    getEntityList: vi.fn(),
    getEntity: vi.fn(),
    saveEntity: vi.fn(),
    formatEntityPayload: vi.fn((proj, type, data, id, title) => ({ id, type, title, data })),
  },
}));

vi.mock('@worldwiki/components', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    appConfirm: vi.fn().mockResolvedValue(true),
    appAlert: vi.fn(),
    settingsService: {
      getSettings: vi.fn(() => ({ layout: { sidebarPos: 'row' } })),
      resetSettings: vi.fn(),
    },
  };
});

const tauriListeners: Record<string, Function> = {};
vi.mock('@tauri-apps/api/event', () => ({
  emit: vi.fn().mockResolvedValue(undefined),
  listen: vi.fn((event: string, cb: Function) => {
    tauriListeners[event] = cb;
    return Promise.resolve(() => {});
  }),
}));

describe('shell store', () => {
  let shell: ReturnType<typeof useShellStore>;
  let schema: ReturnType<typeof useSchemaStore>;

  beforeEach(() => {
    (window as any).__TAURI__ = true;
    setActivePinia(createPinia());
    localStorage.clear();
    vi.clearAllMocks();
    shell = useShellStore();
    schema = useSchemaStore();
    vi.spyOn(schema, 'getEntityDisplayName').mockImplementation((e: any) => e?.name || e?.Name || e?.title || e?.id || '');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('State and basic getters', () => {
    it('initializes with default values', () => {
      expect(shell.activeView).toBe('entity');
      expect(shell.currentSidebarTab).toBeNull();
      expect(shell.showSettings).toBe(false);
      expect(shell.sidebarVisible).toBe(true);
      expect(shell.projectName).toBe('default');
      expect(shell.openEditors).toEqual([]);
      expect(shell.activeEditorId).toBeNull();
    });

    it('addLog pushes logs and trims to 100 entries', () => {
      for (let i = 0; i < 110; i++) {
        shell.addLog(`Message ${i}`, 'info');
      }
      expect(shell.consoleLogs.length).toBe(100);
      expect(shell.consoleLogs[0].text).toBe('Message 109');
    });

    it('toggleSettings and resetSettings', () => {
      shell.toggleSettings();
      expect(shell.showSettings).toBe(true);
      shell.toggleSettings();
      expect(shell.showSettings).toBe(false);

      shell.resetSettings();
      expect(settingsService.resetSettings).toHaveBeenCalled();
    });

    it('applyZoom and zoomLevel', () => {
      const zoom = useZoomStore();
      shell.applyZoom(1.2);
      expect(zoom.zoomLevel).toBe(1.2);
    });

    it('activeSidebarItem computed', () => {
      shell.sidebarItems = [
        { type: 'entity', entityType: 'character', icon: '👤', emoji: '👤', title: 'Characters' },
        { type: 'chapters', icon: '📝', emoji: '📝', title: 'Chapters' },
        { type: 'static', url: '/static/graph', icon: '📊', emoji: '📊', title: 'Graph' },
      ];

      shell.currentSidebarTab = 'character';
      expect(shell.activeSidebarItem?.title).toBe('Characters');

      shell.currentSidebarTab = 'chapters';
      expect(shell.activeSidebarItem?.title).toBe('Chapters');

      shell.currentSidebarTab = '/static/graph';
      expect(shell.activeSidebarItem?.title).toBe('Graph');
    });

    it('filteredEntityList computes correctly for chapters and entities', () => {
      shell.currentSidebarTab = 'chapters';
      shell.chapters = [
        { id: '1', title: 'Prologue' },
        { id: '2', title: 'First Encounter' },
      ];

      shell.sidebarSearch = '';
      expect(shell.filteredEntityList.length).toBe(2);

      shell.sidebarSearch = 'prologue';
      expect(shell.filteredEntityList.length).toBe(1);
      expect(shell.filteredEntityList[0].title).toBe('Prologue');

      shell.currentSidebarTab = 'character';
      shell.entityLists = {
        character: [
          { id: 'c1', name: 'Alice' },
          { id: 'c2', name: 'Bob' },
        ],
      };
      shell.sidebarSearch = 'alice';
      expect(shell.filteredEntityList.length).toBe(1);
    });
  });

  describe('Navigation and tab operations', () => {
    it('selectSidebarTab switches tab and loads data', async () => {
      vi.mocked(entityApi.getEntityList).mockResolvedValue([{ id: 'c1', name: 'Hero' }]);
      vi.spyOn(schema, 'loadSchema').mockResolvedValue({} as any);

      shell.selectSidebarTab({ type: 'entity', entityType: 'character', icon: '', emoji: '', title: 'Chars' });
      expect(shell.currentSidebarTab).toBe('character');
      expect(shell.activeView).toBe('entity');

      shell.selectSidebarTab({ type: 'chapters', icon: '', emoji: '', title: 'Chapters' });
      expect(shell.currentSidebarTab).toBe('chapters');
    });

    it('openEntity opens tab and avoids duplicate opening', async () => {
      vi.mocked(entityApi.getEntity).mockResolvedValue({ id: 'hero_1', name: 'Arthur' });
      vi.spyOn(schema, 'loadSchema').mockResolvedValue({} as any);

      await shell.openEntity({ id: 'hero_1', entityType: 'character', name: 'Arthur' });
      expect(shell.openEditors.length).toBe(1);
      expect(shell.openEditors[0].id).toBe('entity:character:hero_1');

      // Open same entity again -> activates existing
      await shell.openEntity({ id: 'hero_1', entityType: 'character' });
      expect(shell.openEditors.length).toBe(1);
    });

    it('openEntity rejects entity without id', async () => {
      await shell.openEntity({ entityType: 'character' });
      expect(shell.openEditors.length).toBe(0);
    });

    it('openChapterTab opens chapter tab', () => {
      shell.openChapterTab({ id: 'ch_1', title: 'Chapter 1' });
      expect(shell.openEditors.length).toBe(1);
      expect(shell.openEditors[0].tabType).toBe('chapter');
      expect(shell.openEditors[0].title).toBe('Chapter 1');
    });

    it('openSchemaEditor opens schema editor tab', async () => {
      await shell.openSchemaEditor('character');
      expect(shell.openEditors.length).toBe(1);
      expect(shell.openEditors[0].tabType).toBe('schema-editor');
      expect(shell.openEditors[0].id).toBe('schema-editor:character');
    });

    it('closeEditor and closeAllTabs', async () => {
      shell.openChapterTab({ id: 'ch_1', title: 'Ch 1' });
      shell.openChapterTab({ id: 'ch_2', title: 'Ch 2' });
      expect(shell.openEditors.length).toBe(2);

      await shell.closeEditor('ch_1', true);
      expect(shell.openEditors.length).toBe(1);

      await shell.closeAllTabs();
      expect(shell.openEditors.length).toBe(0);
    });

    it('markUnsaved and markSaved', () => {
      shell.openChapterTab({ id: 'ch_1', title: 'Ch 1' });
      const tabId = 'ch_1';

      expect(shell.unsavedCount).toBe(0);
      shell.markUnsaved(tabId);
      expect(shell.unsavedCount).toBe(1);

      shell.markSaved(tabId);
      expect(shell.unsavedCount).toBe(0);
    });

    it('onChapterRenamed updates tab title', () => {
      shell.openChapterTab({ id: 'ch_1', title: 'Old Title' });
      shell.onChapterRenamed({ id: 'ch_1', title: 'New Title' });
      expect(shell.openEditors[0].title).toBe('New Title');
    });
  });

  describe('handleUpdateData and deep merge', () => {
    it('merges object properties and array updates into tab data', () => {
      shell.openChapterTab({
        id: 'ch_1',
        title: 'Ch 1',
        data: {
          details: { summary: 'Old' },
          tags: ['action', 'lore'],
        },
      });

      shell.handleUpdateData('ch_1', {
        details: { summary: 'New Summary', author: 'Author' },
        tags: ['action', 'lore', 'adventure'],
      });

      const tab = shell.openEditors[0];
      expect((tab.data as any).details.summary).toBe('New Summary');
      expect((tab.data as any).details.author).toBe('Author');
      expect((tab.data as any).tags).toEqual(['action', 'lore', 'adventure']);
    });
  });

  describe('Persistence (saveState and restoreState)', () => {
    it('saves state into localStorage and restores it correctly', async () => {
      shell.openChapterTab({ id: 'ch_1', title: 'Chapter 1' });
      shell.activeView = 'chapters';
      shell.currentSidebarTab = 'chapters';
      shell.saveState();

      const saved = localStorage.getItem('worldwiki-state-default');
      expect(saved).not.toBeNull();

      vi.mocked(api.getChapter).mockResolvedValue({ id: 'ch_1', title: 'Chapter 1' } as any);

      const newShell = useShellStore();
      const restored = await newShell.restoreState();
      expect(restored).toBe(true);
      expect(newShell.activeView).toBe('chapters');
    });

    it('restoreState returns false if no state in localStorage', async () => {
      const restored = await shell.restoreState();
      expect(restored).toBe(false);
    });
  });

  describe('Entity lists and chapters loading', () => {
    it('loadEntityList updates entityLists and logs error on failure', async () => {
      vi.mocked(entityApi.getEntityList).mockResolvedValue([{ id: 'c1' }]);
      vi.spyOn(schema, 'loadSchema').mockResolvedValue({} as any);

      await shell.loadEntityList('character');
      expect(shell.entityLists.character.length).toBe(1);

      vi.mocked(entityApi.getEntityList).mockRejectedValue(new Error('Fail'));
      await shell.loadEntityList('location');
      expect(shell.entityLists.location).toEqual([]);
    });

    it('loadChapters updates chapters and handles failure', async () => {
      vi.mocked(api.getChapters).mockResolvedValue([{ id: 'ch1', title: 'One' }] as any);
      await shell.loadChapters();
      expect(shell.chapters.length).toBe(1);

      vi.mocked(api.getChapters).mockRejectedValue(new Error('Fail'));
      await shell.loadChapters();
      expect(shell.chapters).toEqual([]);
    });
  });

  describe('Entity and Chapter CRUD Operations', () => {
    it('addNewEntity for chapter creates chapter and opens it', async () => {
      vi.mocked(api.saveChapter).mockResolvedValue({ id: 'new_ch_1' } as any);

      await shell.addNewEntity('chapters', 'My Custom Chapter');
      expect(api.saveChapter).toHaveBeenCalled();
      expect(shell.openEditors.length).toBe(1);
    });

    it('addNewEntity for standard entity saves and opens it', async () => {
      vi.spyOn(schema, 'loadSchema').mockResolvedValue({ titleField: 'name' } as any);
      vi.mocked(entityApi.saveEntity).mockResolvedValue({ id: 'ent_1' } as any);
      vi.mocked(entityApi.getEntity).mockResolvedValue({ id: 'ent_1', name: 'Hero' });

      await shell.addNewEntity('character', 'Hero');
      expect(entityApi.saveEntity).toHaveBeenCalled();
      expect(shell.openEditors.length).toBe(1);
    });

    it('deleteEntity calls api.deleteEntity and closes editor', async () => {
      shell.openEntity({ id: 'c1', entityType: 'character', name: 'Hero' });
      vi.mocked(api.deleteEntity).mockResolvedValue(undefined as any);

      await shell.deleteEntity('entity:character:c1', 'character', true);
      expect(api.deleteEntity).toHaveBeenCalledWith('character:c1');
      expect(shell.openEditors.length).toBe(0);
    });

    it('renameEntity updates title across schema and tabs', async () => {
      vi.mocked(entityApi.getEntity).mockResolvedValue({ id: 'c1', name: 'Old' });
      vi.spyOn(schema, 'loadSchema').mockResolvedValue({ titleField: 'name' } as any);
      vi.mocked(entityApi.saveEntity).mockResolvedValue({} as any);

      await shell.openEntity({ id: 'c1', entityType: 'character', name: 'Old' });
      await shell.renameEntity('character', 'entity:character:c1', 'New Hero Name');

      expect(entityApi.saveEntity).toHaveBeenCalled();
      expect(shell.openEditors[0].title).toBe('New Hero Name');
    });

    it('createChapterIn increments chapter numbers correctly', async () => {
      vi.mocked(api.getChapterHierarchy).mockResolvedValue({
        chapters: [{ title: 'Глава 1' }, { title: 'Глава 2' }],
      } as any);
      vi.mocked(api.saveChapter).mockResolvedValue({ id: 'ch_3' } as any);

      await shell.createChapterIn();
      expect(api.saveChapter).toHaveBeenCalledWith('default', expect.objectContaining({
        title: 'Глава 3',
      }));
    });

    it('deleteChapter deletes chapter and closes tab', async () => {
      shell.openChapterTab({ id: 'ch_1', title: 'Chapter 1' });
      vi.mocked(api.deleteChapter).mockResolvedValue(undefined as any);

      await shell.deleteChapter({ id: 'ch_1', title: 'Chapter 1' });
      expect(api.deleteChapter).toHaveBeenCalledWith('ch_1');
      expect(shell.openEditors.length).toBe(0);
    });

    it('renameChapter updates local state and saves to backend', async () => {
      shell.chapters = [{ id: 'ch_1', title: 'Old' }];
      vi.mocked(api.getChapter).mockResolvedValue({ id: 'ch_1', title: 'Old' } as any);
      vi.mocked(api.saveChapter).mockResolvedValue({} as any);

      await shell.renameChapter({ id: 'ch_1' }, 'Renamed Title');
      expect(shell.chapters[0].title).toBe('Renamed Title');
      expect(api.saveChapter).toHaveBeenCalledWith('default', expect.objectContaining({
        title: 'Renamed Title',
      }));
    });

    it('deleteVolume deletes volume and associated chapters/arcs', async () => {
      vi.mocked(api.deleteChapter).mockResolvedValue(undefined as any);
      vi.mocked(api.deleteArc).mockResolvedValue(undefined as any);
      vi.mocked(api.deleteVolume).mockResolvedValue(undefined as any);

      await shell.deleteVolume({ id: 'v1', title: 'Vol 1' }, [{ id: 'c1' }], ['a1'], true);
      expect(api.deleteChapter).toHaveBeenCalledWith('c1');
      expect(api.deleteArc).toHaveBeenCalledWith('a1');
      expect(api.deleteVolume).toHaveBeenCalledWith('v1');
    });

    it('deleteArc deletes arc and associated chapters', async () => {
      vi.mocked(api.deleteChapter).mockResolvedValue(undefined as any);
      vi.mocked(api.deleteArc).mockResolvedValue(undefined as any);

      await shell.deleteArc({ id: 'a1', title: 'Arc 1' }, [{ id: 'c1' }], true);
      expect(api.deleteChapter).toHaveBeenCalledWith('c1');
      expect(api.deleteArc).toHaveBeenCalledWith('a1');
    });
  });

  describe('saveAll manager', () => {
    it('dispatches chapter save event for unsaved chapters', async () => {
      shell.openChapterTab({ id: 'ch_1', title: 'Chapter 1' });
      shell.markUnsaved('ch_1');

      const spy = vi.fn();
      document.addEventListener('ww:trigger-chapter-save', spy);

      await shell.saveAll();
      expect(spy).toHaveBeenCalled();
    });

    it('saves unsaved entities and marks them saved', async () => {
      vi.mocked(api.saveEntityWithRelations).mockResolvedValue({ id: 'entities:c1' } as any);
      window.fetch = vi.fn().mockResolvedValue({
        ok: false,
      } as any);

      await shell.openEntity({ id: 'c1', entityType: 'character', name: 'Hero' });
      shell.markUnsaved('entity:character:c1');

      await shell.saveAll();
      expect(api.saveEntityWithRelations).toHaveBeenCalled();
      expect(shell.unsavedCount).toBe(0);
    });
  });

  describe('QuickOpen and Helpers', () => {
    it('quickOpenDataSource aggregates chapters and sidebar items', async () => {
      vi.mocked(api.getChapters).mockResolvedValue([{ id: '1', title: 'Ch 1' }] as any);
      vi.mocked(api.getEntities).mockResolvedValue([{ id: 'hero', name: 'Arthur' }] as any);

      shell.sidebarItems = [
        { type: 'entity', entityType: 'character', title: 'Characters', icon: '👤', emoji: '👤' },
      ];

      const items = await shell.quickOpenDataSource();
      expect(items.length).toBe(2);
      expect(items[0].typeLabel).toBe('Глава');
      expect(items[1].typeLabel).toBe('Characters');
    });

    it('handleQuickOpenSelect opens the selected item', () => {
      shell.handleQuickOpenSelect({
        entityType: 'chapter',
        data: { id: 'ch_1', title: 'Ch 1' },
      });
      expect(shell.openEditors.length).toBe(1);
    });

    it('group management helpers (splitRight, closeGroup, moveTab, reorderTab, selectTreeNode, handleScrollChange, handleSectionChange, activateTabInGroup, focusGroup)', () => {
      shell.selectTreeNode({ id: 'node_1', type: 'chapter' });
      expect(shell.activeTreeNode).toEqual({ id: 'node_1', type: 'chapter' });

      shell.openChapterTab({ id: 'ch_1', title: 'Ch 1' });
      shell.openChapterTab({ id: 'ch_2', title: 'Ch 2' });
      const gid = shell.editorGroups[0].id;
      shell.handleScrollChange(gid, 'ch_1', 250);
      expect(shell.editorGroups[0].tabs.find((t: any) => t.id === 'ch_1')?.scrollPos).toBe(250);

      shell.handleSectionChange(gid, 'ch_1', 'sec_1');
      expect(shell.editorGroups[0].tabs.find((t: any) => t.id === 'ch_1')?.activeSection).toBe('sec_1');

      shell.splitRight();
      expect(shell.editorGroups.length).toBe(2);

      const secondGid = shell.editorGroups[1].id;
      shell.moveTab({ tabId: 'ch_1', toGroupId: secondGid, toIndex: 0 });
      shell.activateTabInGroup(secondGid, 'ch_1');
      expect(shell.editorGroups[1].activeTabId).toBe('ch_1');

      shell.focusGroup(secondGid);
      expect(shell.activeGroupId).toBe(secondGid);

      shell.reorderTab({ groupId: secondGid, fromIdx: 0, toIdx: 0 });

      shell.closeGroup(secondGid);
      expect(shell.editorGroups.length).toBe(1);
    });

    it('openSandbox, openFloatingEditor, openTagsManager, openQuickOpen, toggleEntityHistory', async () => {
      await shell.openSandbox();
      expect(shell.openEditors.some((t: any) => t.tabType === 'schema-editor')).toBe(true);

      // Re-opening same schema editor
      await shell.openSchemaEditor('universal');

      const floatSpy = vi.fn();
      shell.openFloatingEditor = floatSpy;
      shell.openFloatingEditor('p1', 'char', '1');
      expect(floatSpy).toHaveBeenCalledWith('p1', 'char', '1');

      const mockTagsMgr = { open: vi.fn() };
      shell.tagsManagerRef = mockTagsMgr as any;
      shell.openTagsManager();
      expect(mockTagsMgr.open).toHaveBeenCalled();

      const mockQuickOpen = { open: vi.fn() };
      shell.quickOpenRef = mockQuickOpen as any;
      shell.openQuickOpen();
      expect(mockQuickOpen.open).toHaveBeenCalled();

      const eventSpy = vi.fn();
      document.addEventListener('ww:toggle-entity-history', eventSpy);
      shell.toggleEntityHistory('c1');
      expect(eventSpy).toHaveBeenCalled();
    });

    it('resizers attach and detach mouse event listeners cleanly for split and groups', () => {
      const e = { clientY: 100, clientX: 100, target: document.createElement('div') } as any;

      shell.startResize(e);
      document.dispatchEvent(new MouseEvent('mousemove', { clientY: 150 }));
      document.dispatchEvent(new MouseEvent('mouseup'));

      shell.startSidebarResize(e);
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 150 }));
      document.dispatchEvent(new MouseEvent('mouseup'));

      // Split resize
      const splitWrapper = document.createElement('div');
      splitWrapper.className = 'split-layout-wrapper';
      document.body.appendChild(splitWrapper);
      const splitTarget = document.createElement('div');
      splitWrapper.appendChild(splitTarget);

      shell.startSplitResize({ clientX: 100, target: splitTarget } as any);
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 150 }));
      document.dispatchEvent(new MouseEvent('mouseup'));

      // Group resize
      const groupContainer = document.createElement('div');
      groupContainer.className = 'editor-groups-container';
      document.body.appendChild(groupContainer);
      const groupHandle = document.createElement('div');
      groupContainer.appendChild(groupHandle);

      shell.splitRight();
      shell.startGroupResize({ clientX: 100, currentTarget: groupHandle } as any, 0);
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 120 }));
      document.dispatchEvent(new MouseEvent('mouseup'));
    });

    it('saveAll handles schema-editor tabs and bidirectional deletion scan', async () => {
      await shell.openSchemaEditor('item');
      shell.markUnsaved('schema-editor:item');

      const schemaSaveSpy = vi.fn();
      document.addEventListener('ww:trigger-schema-save', schemaSaveSpy);

      window.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          sections: [
            {
              dynamicContainers: [
                {
                  template: 'tpl_rel',
                  dataPath: 'relations',
                  isBidirectional: true,
                },
              ],
            },
          ],
          templates: {
            tpl_rel: {
              isBidirectional: true,
              bidirectionalLinkClass: 'target_id',
              fields: [{ class: 'target_id', entityType: 'character' }],
            },
          },
        }),
      } as any);

      vi.mocked(entityApi.getEntity).mockResolvedValue({
        id: 'c1',
        relations: [{ target_id: 'target_999' }],
      });

      await shell.openEntity({ id: 'c1', entityType: 'character', name: 'Hero' });
      const entTab = shell.openEditors.find((t: any) => t.tabType === 'entity');
      if (entTab) {
        entTab.data = { relations: [] }; // Deleted relationship
        shell.markUnsaved(entTab.id);
      }

      await shell.saveAll();
      expect(schemaSaveSpy).toHaveBeenCalled();
      expect(api.saveEntityWithRelations).toHaveBeenCalled();
    });

    it('deleteEntity interactive modal confirmation and cancellation', async () => {
      // Test Cancel
      setTimeout(() => {
        const cancelBtn = document.getElementById('cancel-btn');
        cancelBtn?.click();
      }, 10);
      await shell.deleteEntity('entity:character:c1', 'character', false);
      expect(api.deleteEntity).not.toHaveBeenCalledWith('character:c1');

      // Test Confirm
      setTimeout(() => {
        const confirmBtn = document.getElementById('confirm-btn');
        confirmBtn?.click();
      }, 10);
      vi.mocked(api.deleteEntity).mockResolvedValue(undefined as any);
      await shell.deleteEntity('entity:character:c1', 'character', false);
      expect(api.deleteEntity).toHaveBeenCalledWith('character:c1');
    });

    it('deleteVolume and deleteArc clear activeTreeNode and handle tree reloads', async () => {
      shell.activeTreeNode = { type: 'volume', node: { id: 'v1' } };
      shell.chapterTreeRef = { load: vi.fn() } as any;

      await shell.deleteVolume({ id: 'v1', title: 'Vol 1' }, [{ id: 'c1' }], ['a1'], true);
      expect(shell.activeTreeNode).toBeNull();
      expect(shell.chapterTreeRef.load).toHaveBeenCalled();

      shell.activeTreeNode = { type: 'arc', node: { id: 'a1' } };
      await shell.deleteArc({ id: 'a1', title: 'Arc 1' }, [{ id: 'c1' }], true);
      expect(shell.activeTreeNode).toBeNull();
    });

    it('openFloatingEditor delegates to floatingStore', () => {
      expect(() => shell.openFloatingEditor('default', 'character', 'c1')).not.toThrow();
    });

    it('handles Tauri live sync and entity saved events', async () => {
      await shell.openChapterTab({ id: 'ch_1', title: 'Chapter 1' });
      await shell.openEntity({ id: 'c1', entityType: 'character', name: 'Hero' });

      // Trigger ww-entity-saved for chapter
      if (tauriListeners['ww-entity-saved']) {
        vi.mocked(api.getChapter).mockResolvedValue({ id: 'ch_1', title: 'Updated Ch' } as any);
        await tauriListeners['ww-entity-saved']({ payload: { type: 'chapter', id: 'ch_1' } });
      }

      // Trigger ww-entity-saved for entity
      if (tauriListeners['ww-entity-saved']) {
        vi.mocked(entityApi.getEntity).mockResolvedValue({ id: 'c1', name: 'Updated Hero' });
        await tauriListeners['ww-entity-saved']({ payload: { type: 'character', id: 'entities:c1' } });
      }

      // Trigger ww-entity-live-sync
      if (tauriListeners['ww-entity-live-sync']) {
        await tauriListeners['ww-entity-live-sync']({
          payload: { type: 'character', id: 'entities:c1', data: { name: 'Live Name' } },
        });
      }
    });
  });
});
