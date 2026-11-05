import { describe, it, expect, beforeEach, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { useProjectLauncherModal } from './useProjectLauncherModal';
import { projectService } from '@/services/project.service';

vi.mock('../../../services/project.service', () => ({
  projectService: {
    getProjectConfig: vi.fn(),
    saveProjectConfig: vi.fn(),
    createProject: vi.fn()
  }
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn()
}));

describe('useProjectLauncherModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('manages custom genres correctly and populates customGenresList', () => {
    const loadProjectsMock = vi.fn().mockResolvedValue(undefined);
    const modal = useProjectLauncherModal(loadProjectsMock);

    modal.openCreateModal();
    expect(modal.formData.value.genres).toEqual([]);
    expect(modal.customGenresList.value).toEqual([]);

    modal.customGenreInput.value = 'Киберпанк';
    modal.addCustomGenre();
    expect(modal.formData.value.genres).toContain('Киберпанк');
    expect(modal.customGenresList.value).toEqual([{ value: 'Киберпанк', label: 'Киберпанк' }]);
    expect(modal.customGenreInput.value).toBe('');

    // Не дублирует одинаковые жанры
    modal.customGenreInput.value = 'Киберпанк';
    modal.addCustomGenre();
    expect(modal.formData.value.genres).toEqual(['Киберпанк']);
    expect(modal.customGenresList.value).toHaveLength(1);

    // Удаление кастомного жанра
    modal.deleteCustomGenre('Киберпанк');
    expect(modal.formData.value.genres).not.toContain('Киберпанк');
    expect(modal.customGenresList.value).toEqual([]);
  });

  it('saves custom type to wheel and updates availableProjectTypes', () => {
    const loadProjectsMock = vi.fn().mockResolvedValue(undefined);
    const modal = useProjectLauncherModal(loadProjectsMock);

    modal.customTypeInput.value = 'Ранобэ';
    modal.saveCustomTypeToWheel();

    expect(modal.formData.value.type).toBe('Ранобэ');
    expect(modal.customTypeInput.value).toBe('');
    expect(modal.availableProjectTypes.value.some(t => t.value === 'Ранобэ')).toBe(true);
  });

  it('handles custom project type correctly on submit', async () => {
    vi.mocked(projectService.createProject).mockResolvedValue({ success: true });

    const loadProjectsMock = vi.fn().mockResolvedValue(undefined);
    const modal = useProjectLauncherModal(loadProjectsMock);

    modal.openCreateModal();
    modal.formData.value.name = 'Мой Комикс';
    modal.formData.value.type = 'custom';
    modal.customTypeInput.value = 'Манга';

    await modal.submitForm();
    await flushPromises();

    expect(projectService.createProject).toHaveBeenCalledWith({
      name: 'Мой Комикс',
      type: 'Манга',
      genres: [],
      cover_image: null
    });
  });

  it('loads existing project config including cover, custom type and custom genres on edit', async () => {
    vi.mocked(projectService.getProjectConfig).mockResolvedValue({
      name: 'Метро 2033',
      type: 'Фанфик',
      genres: ['Постапокалипсис', 'Выживание'],
      cover_image: 'C:/data/user_images/metro.png'
    });

    const loadProjectsMock = vi.fn().mockResolvedValue(undefined);
    const modal = useProjectLauncherModal(loadProjectsMock);

    await modal.editProject('Метро 2033');
    await flushPromises();

    expect(modal.isEditing.value).toBe(true);
    expect(modal.formData.value.name).toBe('Метро 2033');
    expect(modal.formData.value.type).toBe('custom');
    expect(modal.customTypeInput.value).toBe('Фанфик');
    expect(modal.formData.value.genres).toEqual(['Постапокалипсис', 'Выживание']);
    expect(modal.customGenresList.value).toEqual([
      { value: 'Постапокалипсис', label: 'Постапокалипсис' },
      { value: 'Выживание', label: 'Выживание' }
    ]);
    expect(modal.formData.value.cover_image).toBe('C:/data/user_images/metro.png');
  });

  it('submits updated project name, cover and genres on save', async () => {
    vi.mocked(projectService.getProjectConfig).mockResolvedValue({
      name: 'Старое имя',
      type: 'novel',
      genres: ['fantasy'],
      cover_image: null
    });
    vi.mocked(projectService.saveProjectConfig).mockResolvedValue({ success: true });

    const loadProjectsMock = vi.fn().mockResolvedValue(undefined);
    const modal = useProjectLauncherModal(loadProjectsMock);

    await modal.editProject('Старое имя');
    await flushPromises();

    // Пользователь переименовывает произведение и ставит обложку
    modal.formData.value.name = 'Новое имя книги';
    modal.formData.value.cover_image = 'C:/data/cover.webp';
    modal.formData.value.genres.push('Тёмное фэнтези');

    await modal.submitForm();
    await flushPromises();

    expect(projectService.saveProjectConfig).toHaveBeenCalledWith('Старое имя', {
      name: 'Новое имя книги',
      type: 'novel',
      genres: ['fantasy', 'Тёмное фэнтези'],
      cover_image: 'C:/data/cover.webp'
    });
    expect(loadProjectsMock).toHaveBeenCalledTimes(1);
    expect(modal.modalVisible.value).toBe(false);
  });

  it('resets cover image on removeCoverImage', () => {
    const loadProjectsMock = vi.fn().mockResolvedValue(undefined);
    const modal = useProjectLauncherModal(loadProjectsMock);

    modal.formData.value.cover_image = 'path/to/cover.png';
    modal.removeCoverImage();
    expect(modal.formData.value.cover_image).toBeNull();
  });
});
