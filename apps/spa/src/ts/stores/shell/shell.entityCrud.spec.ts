import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { useShellEntityCrud, type EntityCrudDeps } from './shell.entityCrud';
import * as api from '@/services/api.client';
import { entityApi } from '@/services/Entity/entity.api';

vi.mock('@/services/api.client', () => ({
  deleteEntity: vi.fn(async () => undefined),
}));

vi.mock('@/services/Entity/entity.api', () => ({
  entityApi: {
    getEntity: vi.fn(),
    saveEntity: vi.fn(),
  },
}));

vi.mock('@worldwiki/components', () => ({
  appConfirm: vi.fn(async () => true),
  appAlert: vi.fn(),
}));

describe('shell.entityCrud', () => {
  let deps: EntityCrudDeps;

  beforeEach(() => {
    vi.clearAllMocks();
    deps = {
      projectName: ref('proj_1'),
      eg: {} as any,
      schema: {
        loadSchema: vi.fn(async () => ({
          titleField: 'meta.title',
          sections: [{ fields: [{ path: 'name' }] }],
        })),
      } as any,
      activeTreeNode: ref({ type: 'character', node: { id: 'c1' } }),
      currentSidebarTab: ref('character'),
      chapterTreeRef: ref({ load: vi.fn(async () => undefined) }),
      chapters: ref([]),
      addLog: vi.fn(),
      addToast: vi.fn(),
      closeEditor: vi.fn(async () => undefined),
      openEntity: vi.fn(),
      openChapterTab: vi.fn(),
      loadEntityList: vi.fn(async () => undefined),
      handleUpdateData: vi.fn(),
      confirmCreateChapter: vi.fn(async () => undefined),
    };
  });

  it('deletes entity (confirmed, cancelled, silent, error)', async () => {
    const { appConfirm, appAlert } = await import('@worldwiki/components');
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const crud = useShellEntityCrud(deps, ref(false));

    vi.mocked(appConfirm).mockResolvedValueOnce(false);
    await crud.deleteEntity('entities:c1', 'character', false);
    expect(api.deleteEntity).not.toHaveBeenCalled();

    await crud.deleteEntity('entities:c1', 'character', true);
    expect(api.deleteEntity).toHaveBeenCalledWith('c1');
    expect(deps.activeTreeNode.value).toBeNull();
    expect(deps.loadEntityList).toHaveBeenCalledWith('character');

    vi.mocked(api.deleteEntity).mockRejectedValueOnce(new Error('del err'));
    await crud.deleteEntity('c2', 'character', true);
    expect(appAlert).toHaveBeenCalled();

    errSpy.mockRestore();
    logSpy.mockRestore();
  });

  it('renames entity with nested titleField and attributes', async () => {
    const crud = useShellEntityCrud(deps, ref(false));
    vi.mocked(entityApi.getEntity).mockResolvedValueOnce({
      id: 'entities:c1',
      attributes: { 'meta.title': 'Old' },
    } as any);
    vi.mocked(entityApi.saveEntity).mockResolvedValueOnce({ id: 'entities:c1' } as any);

    await crud.renameEntity('character', 'entities:c1', 'Новое имя');
    expect(entityApi.saveEntity).toHaveBeenCalledWith(
      'proj_1',
      'character',
      expect.objectContaining({ name: 'Новое имя', meta: { title: 'Новое имя' } }),
      'entities:c1',
      'Новое имя'
    );
  });

  it('opens/closes create modal, confirms entity creation (success, missing id, missing entity, error), and adds new chapter/entity', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const crud = useShellEntityCrud(deps, ref(false));

    crud.openCreateEntityModal();
    expect(crud.createEntityTargetType.value).toBe('character');
    crud.closeCreateEntityModal();
    expect(crud.isCreateEntityModalOpen.value).toBe(false);

    // Guard empty name
    await crud.confirmCreateEntity({ entityType: 'character', name: '  ' });
    expect(entityApi.saveEntity).not.toHaveBeenCalled();

    // Missing id from saveEntity
    vi.mocked(entityApi.saveEntity).mockResolvedValueOnce({} as any);
    await crud.confirmCreateEntity({ entityType: 'character', name: 'А' });
    expect(deps.addToast).toHaveBeenCalledWith('Ошибка при создании сущности', 'error');

    // Null from getEntity
    vi.mocked(entityApi.saveEntity).mockResolvedValueOnce({ id: 'entities:new_1' } as any);
    vi.mocked(entityApi.getEntity).mockResolvedValueOnce(null as any);
    await crud.confirmCreateEntity({ entityType: 'character', name: 'Б' });

    // Success
    vi.mocked(entityApi.saveEntity).mockResolvedValueOnce({ id: 'entities:new_2' } as any);
    vi.mocked(entityApi.getEntity).mockResolvedValueOnce({ id: 'entities:new_2', name: 'В' } as any);
    await crud.confirmCreateEntity({ entityType: 'character', name: 'В' });
    expect(deps.openEntity).toHaveBeenCalled();

    // Error catch
    vi.mocked(entityApi.saveEntity).mockRejectedValueOnce(new Error('save fail'));
    await crud.confirmCreateEntity({ entityType: 'character', name: 'Г' });
    expect(deps.addToast).toHaveBeenCalledWith(expect.stringContaining('Ошибка создания:'), 'error');

    // addNewEntity for chapters & prompt fallback
    await crud.addNewEntity('');
    await crud.addNewEntity('chapters', 'Глава 1');
    expect(deps.confirmCreateChapter).toHaveBeenCalledWith({ title: 'Глава 1', volumeId: null });

    const origPrompt = window.prompt;
    window.prompt = vi.fn().mockReturnValueOnce('Имя из промпта').mockReturnValueOnce(null);
    vi.mocked(entityApi.saveEntity).mockResolvedValueOnce({ id: 'entities:new_3' } as any);
    vi.mocked(entityApi.getEntity).mockResolvedValueOnce({ id: 'entities:new_3' } as any);
    await crud.addNewEntity('location');
    await crud.addNewEntity('location'); // null prompt -> cancel
    window.prompt = origPrompt;

    errSpy.mockRestore();
  });
});
