import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { effectScope, ref } from 'vue';
import { setupShellTauriEvents } from './shell.events';
import * as api from '@/services/api.client';
import { entityApi } from '@/services/Entity/entity.api';
import { listen } from '@tauri-apps/api/event';

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
}));

vi.mock('@/services/api.client', () => ({
  getChapter: vi.fn(),
}));

vi.mock('@/services/Entity/entity.api', () => ({
  entityApi: {
    getEntity: vi.fn(),
  },
}));

describe('setupShellTauriEvents', () => {
  const listeners = new Map<string, (ev: { payload: any }) => void>();

  beforeEach(() => {
    vi.clearAllMocks();
    listeners.clear();
    (window as any).__TAURI__ = {};
    vi.mocked(listen).mockImplementation(async (name, cb) => {
      listeners.set(name, cb as any);
      return () => {};
    });
  });

  afterEach(() => {
    delete (window as any).__TAURI__;
  });

  it('handles ww-entity-saved, ww-entity-live-sync, and ww:chapter-renamed events', async () => {
    vi.useFakeTimers();
    const scope = effectScope();
    const chTab = { id: 'chapters:c1', rawId: 'chapters:c1', entityType: 'chapter', title: 'Old Ch', data: {} };
    const entTab = { id: 'entity:character:e1', rawId: 'entities:e1', entityType: 'character', title: 'Old Ent', data: {} };
    const deps = {
      eg: {
        groups: ref([{ id: 'g1', tabs: [chTab, entTab] }]),
        updateTabData: vi.fn(),
      } as any,
      projectName: ref('proj_1'),
      layout: { currentSidebarTab: ref('character') } as any,
      entityOps: {
        loadEntityList: vi.fn(),
        setIsLiveSyncing: vi.fn(),
        handleUpdateData: vi.fn(),
      } as any,
      chapterTreeRef: ref({ load: vi.fn() }),
    };

    scope.run(() => {
      setupShellTauriEvents(deps);
    });
    await vi.advanceTimersByTimeAsync(10);

    vi.mocked(api.getChapter).mockResolvedValueOnce({ id: 'chapters:c1', title: 'New Ch' } as any);
    listeners.get('ww-entity-saved')?.({ payload: { type: 'chapter', id: 'chapters:c1' } });
    await vi.advanceTimersByTimeAsync(10);
    expect(deps.eg.updateTabData).toHaveBeenCalledWith('chapters:c1', expect.objectContaining({ title: 'New Ch' }));

    vi.mocked(entityApi.getEntity).mockResolvedValueOnce({ id: 'entities:e1', name: 'New Ent' } as any);
    listeners.get('ww-entity-saved')?.({ payload: { type: 'character', id: 'entities:e1' } });
    await vi.advanceTimersByTimeAsync(10);
    expect(deps.entityOps.loadEntityList).toHaveBeenCalledWith('character');
    expect(deps.chapterTreeRef.value?.load).toHaveBeenCalled();

    // Live sync: ignore sender === 'main', handle external sender
    listeners.get('ww-entity-live-sync')?.({ payload: { type: 'character', id: 'entities:e1', data: {}, sender: 'main' } });
    expect(deps.entityOps.setIsLiveSyncing).not.toHaveBeenCalled();

    listeners.get('ww-entity-live-sync')?.({ payload: { type: 'character', id: 'entities:e1', data: { name: 'Live' }, sender: 'ext' } });
    expect(deps.entityOps.setIsLiveSyncing).toHaveBeenCalledWith(true);
    vi.advanceTimersByTime(150);
    expect(deps.entityOps.setIsLiveSyncing).toHaveBeenCalledWith(false);

    // Chapter renamed DOM event
    document.dispatchEvent(new CustomEvent('ww:chapter-renamed', { detail: { id: 'chapters:c1', title: 'Renamed' } }));
    expect(deps.eg.updateTabData).toHaveBeenCalledWith('chapters:c1', { title: 'Renamed' });

    // Trigger ww-entity-saved without title on chapter and entity, and live-sync from 'main'
    const apiMod = await import('@/services/api.client');
    const entMod = await import('@/services/Entity/entity.api');
    vi.mocked(apiMod.getChapter).mockResolvedValueOnce({ id: 'chapters:c1', title: '' } as any);
    vi.mocked(entMod.entityApi.getEntity).mockResolvedValueOnce({ id: 'entities:e1' } as any);
    // Find registered listeners on window.__TAURI__? Instead, dispatch ww-entity-saved if listen was captured
    const { listen } = await import('@tauri-apps/api/event');
    const savedCb = vi.mocked(listen).mock.calls.find((c) => c[0] === 'ww-entity-saved')?.[1] as any;
    const syncCb = vi.mocked(listen).mock.calls.find((c) => c[0] === 'ww-entity-live-sync')?.[1] as any;
    if (savedCb) {
      await savedCb({ payload: { type: 'chapter', id: 'c1' } });
      await savedCb({ payload: { type: 'character', id: 'e1' } });
    }
    if (syncCb) {
      syncCb({ payload: { sender: 'main', type: 'character', id: 'e1', data: {} } });
    }

    scope.stop();
    vi.useRealTimers();
  });
});
