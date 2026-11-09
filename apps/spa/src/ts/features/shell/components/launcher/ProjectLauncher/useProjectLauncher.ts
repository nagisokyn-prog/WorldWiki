import { ref, shallowRef, computed, onMounted, onUnmounted, getCurrentInstance } from 'vue';
import { useRouter } from 'vue-router';
import { invoke } from '@tauri-apps/api/core';
import { projectService } from '@/services/project.service';
import { settingsService, appAlert } from '@worldwiki/components';
import {
  projectTypes,
  genres,
  type ProjectData,
  type ProjectFormData
} from './projectLauncher.constants';
import { useProjectLauncherModal } from './useProjectLauncherModal';

export {
  projectTypes,
  genres,
  type ProjectData,
  type ProjectFormData
};

export function useProjectLauncher() {
  const router = useRouter();

  const projects = shallowRef<ProjectData[]>([]);
  const cloudSyncMode = ref<'import' | 'export'>('export');

  async function loadProjects() {
    try {
      const list = await projectService.getProjects();
      projects.value = list.map((p: { name: string; type?: unknown; genres?: unknown; icon?: unknown; stats?: unknown; cover_image?: unknown }) => ({
        name: p.name,
        type: typeof p.type === 'string' ? p.type : 'novel',
        genres: Array.isArray(p.genres) ? (p.genres as string[]) : [],
        icon: String(p.icon || '📁'),
        cover_image: typeof p.cover_image === 'string' ? p.cover_image : null,
        stats: (p.stats as unknown as Record<string, number>) || {}
      }));
    } catch (e) {
      console.error('Ошибка загрузки проектов:', e);
      projects.value = [];
    }
  }

  const {
    modalVisible,
    isEditing,
    editingProjectName,
    formData,
    customGenreInput,
    customTypeInput,
    customGenresList,
    availableProjectTypes,
    saveCustomTypeToWheel,
    modalTitle,
    submitButtonText,
    openCreateModal,
    editProject,
    closeModal,
    addCustomGenre,
    deleteCustomGenre,
    removeGenre,
    selectCoverImage,
    removeCoverImage,
    resolveCoverUrl,
    submitForm
  } = useProjectLauncherModal(loadProjects);

  const sortedProjects = computed(() => {
    return [...projects.value].sort((a, b) => a.name.localeCompare(b.name));
  });

  async function openProject(name: string) {
    await router.push({ path: '/app', query: { project: name } });
  }

  async function confirmDelete(name: string) {
    const { appConfirm } = await import('@worldwiki/components');
    if (await appConfirm(`Удалить проект "${name}"?`)) {
      try {
        await projectService.deleteProject(name);
        await loadProjects();
      } catch (e) {
        console.error('Ошибка удаления проекта:', e);
      }
    }
  }

  function openCloudSync(mode: 'import' | 'export') {
    cloudSyncMode.value = mode;
    window.dispatchEvent(new CustomEvent('open-cloud-sync', { detail: mode }));
  }

  async function showToast(toast: { text?: string; type?: string; [key: string]: unknown }) {
    console.log('Toast:', toast);
    if (toast.type === 'error') {
      await appAlert(toast.text || 'Произошла ошибка', 'Синхронизация WorldWiki');
    } else if (toast.type === 'success') {
      await appAlert(toast.text || 'Операция завершена успешно', 'Синхронизация WorldWiki');
    }
  }

  const handleKeydown = (e: KeyboardEvent) => {
    if (e.code === 'F11') {
      e.preventDefault();
      invoke('toggle_fullscreen').catch((err: unknown) => console.error(err));
    }
  };

  if (getCurrentInstance()) {
    onMounted(async () => {
      window.addEventListener('keydown', handleKeydown, true);

      await settingsService.loadSettings();
      settingsService.applySettings();
      await loadProjects();
    });

    onUnmounted(() => {
      window.removeEventListener('keydown', handleKeydown, true);
    });
  }

  const toggleGlobalTime = () => {
    window.dispatchEvent(new CustomEvent('ww:toggle-global-time'));
  };

  return {
    projects,
    sortedProjects,
    modalVisible,
    isEditing,
    editingProjectName,
    cloudSyncMode,
    formData,
    customGenreInput,
    customTypeInput,
    customGenresList,
    availableProjectTypes,
    saveCustomTypeToWheel,
    projectTypes,
    genres,
    modalTitle,
    submitButtonText,
    loadProjects,
    openCreateModal,
    openProject,
    editProject,
    confirmDelete,
    submitForm,
    closeModal,
    addCustomGenre,
    deleteCustomGenre,
    removeGenre,
    selectCoverImage,
    removeCoverImage,
    resolveCoverUrl,
    openCloudSync,
    showToast,
    toggleGlobalTime
  };
}
