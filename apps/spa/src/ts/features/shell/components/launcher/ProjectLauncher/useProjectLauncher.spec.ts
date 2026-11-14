import { describe, it, expect, vi, beforeEach } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import { useProjectLauncher } from './useProjectLauncher';

const mockPush = vi.fn();
const mockInvoke = vi.fn();
const mockGetProjects = vi.fn();
const mockDeleteProject = vi.fn();
const mockLoadSettings = vi.fn();
const mockApplySettings = vi.fn();
const mockAppAlert = vi.fn();
const mockAppConfirm = vi.fn();

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockPush
  })
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args)
}));

vi.mock('@/services/project.service', () => ({
  projectService: {
    getProjects: (...args: unknown[]) => mockGetProjects(...args),
    deleteProject: (...args: unknown[]) => mockDeleteProject(...args)
  }
}));

vi.mock('@worldwiki/components', () => ({
  settingsService: {
    loadSettings: (...args: unknown[]) => mockLoadSettings(...args),
    applySettings: (...args: unknown[]) => mockApplySettings(...args)
  },
  appAlert: (...args: unknown[]) => mockAppAlert(...args),
  appConfirm: (...args: unknown[]) => mockAppConfirm(...args)
}));

vi.mock('./useProjectLauncherModal', () => ({
  useProjectLauncherModal: () => ({
    modalVisible: ref(false),
    isEditing: ref(false),
    editingProjectName: ref(''),
    formData: ref({}),
    customGenreInput: ref(''),
    customTypeInput: ref(''),
    customGenresList: ref([]),
    availableProjectTypes: ref([]),
    saveCustomTypeToWheel: vi.fn(),
    modalTitle: ref(''),
    submitButtonText: ref(''),
    openCreateModal: vi.fn(),
    editProject: vi.fn(),
    closeModal: vi.fn(),
    addCustomGenre: vi.fn(),
    deleteCustomGenre: vi.fn(),
    removeGenre: vi.fn(),
    selectCoverImage: vi.fn(),
    removeCoverImage: vi.fn(),
    resolveCoverUrl: vi.fn(),
    submitForm: vi.fn()
  })
}));

describe('useProjectLauncher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetProjects.mockResolvedValue([]);
    mockLoadSettings.mockResolvedValue(undefined);
    mockInvoke.mockResolvedValue(undefined);
  });

  function mountLauncher() {
    let api!: ReturnType<typeof useProjectLauncher>;
    const Comp = defineComponent({
      setup() {
        api = useProjectLauncher();
        return () => h('div');
      }
    });
    const wrapper = mount(Comp);
    return { wrapper, api };
  }

  it('loads settings and projects on mount and sorts projects alphabetically', async () => {
    mockGetProjects.mockResolvedValueOnce([
      { name: 'Зета', type: 'novel', genres: ['fantasy'], icon: '📘', cover_image: 'c.png', stats: { chapters: 3 } },
      { name: 'Альфа', type: 123, genres: null, icon: '', cover_image: 42, stats: null }
    ]);

    const { wrapper, api } = mountLauncher();
    await flushPromises();

    expect(mockLoadSettings).toHaveBeenCalledTimes(1);
    expect(mockApplySettings).toHaveBeenCalledTimes(1);
    expect(api.projects.value).toHaveLength(2);
    expect(api.sortedProjects.value.map((p) => p.name)).toEqual(['Альфа', 'Зета']);
    expect(api.sortedProjects.value[0]).toMatchObject({
      name: 'Альфа',
      type: 'novel',
      genres: [],
      icon: '📁',
      cover_image: null,
      stats: {}
    });

    wrapper.unmount();
  });

  it('handles loadProjects errors by resetting list', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockGetProjects.mockRejectedValueOnce(new Error('Load fail'));

    const { wrapper, api } = mountLauncher();
    await flushPromises();

    expect(api.projects.value).toEqual([]);
    errSpy.mockRestore();
    wrapper.unmount();
  });

  it('opens project, confirms/cancels delete, and handles delete errors', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { wrapper, api } = mountLauncher();
    await flushPromises();

    await api.openProject('MyWorld');
    expect(mockPush).toHaveBeenCalledWith({ path: '/app', query: { project: 'MyWorld' } });

    mockAppConfirm.mockResolvedValueOnce(false);
    await api.confirmDelete('MyWorld');
    expect(mockDeleteProject).not.toHaveBeenCalled();

    mockAppConfirm.mockResolvedValueOnce(true);
    mockDeleteProject.mockResolvedValueOnce(undefined);
    await api.confirmDelete('MyWorld');
    expect(mockDeleteProject).toHaveBeenCalledWith('MyWorld');
    expect(mockGetProjects).toHaveBeenCalledTimes(2);

    mockAppConfirm.mockResolvedValueOnce(true);
    mockDeleteProject.mockRejectedValueOnce(new Error('Delete error'));
    await api.confirmDelete('MyWorld');
    expect(errSpy).toHaveBeenCalled();

    errSpy.mockRestore();
    wrapper.unmount();
  });

  it('dispatches cloud sync, global time, shows toasts, and handles F11', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { wrapper, api } = mountLauncher();
    await flushPromises();

    const syncEvents: CustomEvent[] = [];
    const timeEvents: Event[] = [];
    const onSync = (e: Event) => syncEvents.push(e as CustomEvent);
    const onTime = (e: Event) => timeEvents.push(e);
    window.addEventListener('open-cloud-sync', onSync);
    window.addEventListener('ww:toggle-global-time', onTime);

    api.openCloudSync('import');
    expect(api.cloudSyncMode.value).toBe('import');
    expect(syncEvents[0].detail).toBe('import');

    api.toggleGlobalTime();
    expect(timeEvents).toHaveLength(1);

    await api.showToast({ type: 'error', text: 'Сбой' });
    expect(mockAppAlert).toHaveBeenLastCalledWith('Сбой', 'Синхронизация WorldWiki');
    await api.showToast({ type: 'success' });
    expect(mockAppAlert).toHaveBeenLastCalledWith('Операция завершена успешно', 'Синхронизация WorldWiki');
    await api.showToast({ type: 'info', text: 'Инфо' });

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'F11' }));
    expect(mockInvoke).toHaveBeenCalledWith('toggle_fullscreen');

    mockInvoke.mockClear();
    wrapper.unmount();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'F11' }));
    expect(mockInvoke).not.toHaveBeenCalled();

    window.removeEventListener('open-cloud-sync', onSync);
    window.removeEventListener('ww:toggle-global-time', onTime);
    logSpy.mockRestore();
  });
});

