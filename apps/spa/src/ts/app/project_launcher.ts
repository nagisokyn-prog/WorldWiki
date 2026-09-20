/**
 * @file project_launcher.ts
 * @description Лаунчер проектов World Wiki
 * @note Использует Vue.js для UI
 */

import * as Vue from 'vue';

import '@worldwiki/resources/styles/fonts.css';
import '@worldwiki/resources/styles/font-awesome.min.css';
import '@worldwiki/resources/styles/app.css';
import '@worldwiki/resources/styles/glass-animations.css';
import '@worldwiki/resources/styles/features/shell/ProjectLauncher.css';
import '@worldwiki/resources/styles/components/Settings.css';

import { createApp, ref, computed, onMounted, onUnmounted, shallowRef } from 'vue';
import { projectService, type ProjectStats } from '../services/project.service';
import { settingsService, XboxWheel } from '@worldwiki/components';
import CalendarsPanel from '../features/timeline/CalendarsPanel/CalendarsPanel.vue';
import CloudSyncModalVue from '../features/sync/CloudSyncModal.vue';
import { autoAnimatePlugin } from '@formkit/auto-animate/vue';
import { MotionPlugin } from '@vueuse/motion';
import { projectTypes, genres } from '../features/shell/projectLauncher.constants';

// Export Vue globally for components that use window.Vue
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).Vue = Vue;
}

const app = createApp({
  setup() {
    const projects = shallowRef<Array<{ name: string; icon: string; stats: ProjectStats | Record<string, unknown> }>>([]);
    const modalVisible = ref(false);
    const isEditing = ref(false);
    const editingProjectName = ref('');
    const calendarsPanelRef = ref<{ open?: () => void; saveAll?: () => Promise<void> } | null>(null);

    const formData = ref<{
      name: string;
      type: string;
      genres: string[];
      perfLevel: string;
    }>({
      name: '',
      type: 'book',
      genres: [],
      perfLevel: 'auto'
    });

    const sortedProjects = computed(() => {
      return [...projects.value].sort((a, b) => a.name.localeCompare(b.name));
    });

    const modalTitle = computed(() => {
      return isEditing.value ? 'Редактировать проект' : 'Создать проект';
    });

    const submitButtonText = computed(() => {
      return isEditing.value ? 'Сохранить' : 'Создать';
    });

    async function loadProjects() {
      try {
        const list = await projectService.getProjects();
        projects.value = list.map(p => ({
          name: p.name,
          icon: String(p.icon) || '📁',
          stats: p.stats || {}
        }));
      } catch (e) {
        console.error('Ошибка загрузки проектов:', e);
        projects.value = [];
      }
    }

    function openCreateModal() {
      isEditing.value = false;
      editingProjectName.value = '';
      formData.value = {
        name: '',
        type: 'book',
        genres: [] as string[],
        perfLevel: 'auto'
      };
      modalVisible.value = true;
    }

    async function openProject(name: string) {
      window.location.href = `app.html?project=${encodeURIComponent(name)}`;
    }

    async function editProject(name: string) {
      isEditing.value = true;
      editingProjectName.value = name;
      formData.value.name = name;
      try {
        const config = await projectService.getProjectConfig(name);
        if (config) {
          formData.value.type = (config.type as string) || 'book';
          formData.value.genres = (config.genres as string[]) || [];
          formData.value.perfLevel = (config.perfLevel as string) || 'auto';
        }
      } catch (e) {
        console.error('Ошибка загрузки конфигурации:', e);
      }
      modalVisible.value = true;
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

    async function submitForm() {
      try {
        if (isEditing.value) {
          await projectService.saveProjectConfig(editingProjectName.value, {
            type: formData.value.type,
            genres: formData.value.genres,
            perfLevel: formData.value.perfLevel
          });
          if (calendarsPanelRef.value && calendarsPanelRef.value.saveAll) {
            await calendarsPanelRef.value.saveAll();
          }
          await loadProjects();
        } else {
          await projectService.createProject({
            name: formData.value.name,
            type: formData.value.type,
            genres: formData.value.genres,
            perfLevel: formData.value.perfLevel
          });
          if (calendarsPanelRef.value && calendarsPanelRef.value.saveAll) {
            await calendarsPanelRef.value.saveAll();
          }
          await loadProjects();
          closeModal();
        }
        closeModal();
      } catch (e) {
        console.error('Ошибка сохранения проекта:', e);
      }
    }

    function closeModal() {
      modalVisible.value = false;
    }

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.code === 'F11') {
        e.preventDefault();
        const tauri = window.__TAURI__;
        if (tauri) {
          tauri.core.invoke('toggle_fullscreen').catch((err: unknown) => console.error(err));
        }
      }
    };

    onMounted(async () => {
      window.addEventListener('keydown', handleKeydown, true);

      await settingsService.loadSettings();
      settingsService.applySettings();
      loadProjects();
    });

    onUnmounted(() => {
      window.removeEventListener('keydown', handleKeydown, true);
    });

    const cloudSyncModalRef = ref<{ open: (mode: 'import' | 'export') => void } | null>(null);
    const cloudSyncMode = ref<'import' | 'export'>('export');

    function openCloudSync(mode: 'import' | 'export') {
      cloudSyncMode.value = mode;
      window.dispatchEvent(new CustomEvent('open-cloud-sync', { detail: mode }));
    }

    function showToast(toast: string | { message: string }) {
      console.log('Toast:', toast);
    }

    return {
      projects,
      sortedProjects,
      modalVisible,
      isEditing,
      formData,
      projectTypes,
      genres,
      modalTitle,
      submitButtonText,
      calendarsPanelRef,
      openCreateModal,
      openProject,
      editProject,
      confirmDelete,
      submitForm,
      closeModal,
      cloudSyncModalRef,
      openCloudSync,
      showToast
    };
  }
});

// Register CalendarsPanel
app.component('CalendarsPanel', CalendarsPanel);
app.component('VanillaXboxWheel', XboxWheel);
app.component('CloudSyncModal', CloudSyncModalVue);

// Get the HTML template content and use it as Vue template
const appEl = document.getElementById('app');
if (appEl) {
  app.use(autoAnimatePlugin as unknown as Parameters<typeof app.use>[0]);
  app.use(MotionPlugin as unknown as Parameters<typeof app.use>[0]);
  app.mount('#app');
}
