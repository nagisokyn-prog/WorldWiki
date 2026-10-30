import { ref, computed } from 'vue';
import { open } from '@tauri-apps/plugin-dialog';
import { projectService } from '../../services/project.service';
import {
  projectTypes,
  genres as standardGenres,
  type ProjectFormData
} from './projectLauncher.constants';

const CUSTOM_TYPES_KEY = 'worldwiki_custom_project_types';

function loadStoredCustomTypes(): Array<{ value: string; label: string }> {
  try {
    const raw = localStorage.getItem(CUSTOM_TYPES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn('[ProjectLauncher] Failed to load custom project types:', e);
  }
  return [];
}

export function useProjectLauncherModal(
  loadProjects: () => Promise<void>
) {
  const modalVisible = ref(false);
  const isEditing = ref(false);
  const editingProjectName = ref('');
  const customGenreInput = ref('');
  const customTypeInput = ref('');
  const customGenresList = ref<Array<{ value: string; label: string }>>([]);
  const customStoredTypes = ref<Array<{ value: string; label: string }>>(loadStoredCustomTypes());

  const availableProjectTypes = computed(() => {
    const base = projectTypes.filter(t => t.value !== 'custom');
    const customs = customStoredTypes.value;
    return [...base, ...customs, { value: 'custom', label: '✨ Свой тип...' }];
  });

  const formData = ref<ProjectFormData>({
    name: '',
    type: 'novel',
    genres: [],
    perfLevel: 'auto',
    cover_image: null
  });

  const modalTitle = computed(() => {
    return isEditing.value ? 'Редактировать проект' : 'Создать проект';
  });

  const submitButtonText = computed(() => {
    return isEditing.value ? 'Сохранить' : 'Создать';
  });

  function saveCustomTypeToWheel() {
    const val = customTypeInput.value.trim();
    if (!val) return;
    const exists = availableProjectTypes.value.some(
      t => t.value.toLowerCase() === val.toLowerCase() || t.label.toLowerCase() === val.toLowerCase()
    );
    if (!exists) {
      const newEntry = { value: val, label: val };
      customStoredTypes.value.push(newEntry);
      try {
        localStorage.setItem(CUSTOM_TYPES_KEY, JSON.stringify(customStoredTypes.value));
      } catch (e) {
        console.warn('Failed to save custom type:', e);
      }
    }
    formData.value.type = val;
    customTypeInput.value = '';
  }

  function openCreateModal() {
    isEditing.value = false;
    editingProjectName.value = '';
    customGenreInput.value = '';
    customTypeInput.value = '';
    customGenresList.value = [];
    formData.value = {
      name: '',
      type: 'novel',
      genres: [] as string[],
      perfLevel: 'auto',
      cover_image: null
    };
    modalVisible.value = true;
  }

  async function editProject(name: string) {
    isEditing.value = true;
    editingProjectName.value = name;
    formData.value.name = name;
    formData.value.cover_image = null;
    customGenreInput.value = '';
    customTypeInput.value = '';
    customGenresList.value = [];

    try {
      const config = await projectService.getProjectConfig(name);
      if (config) {
        formData.value.name = (config.name as string) || name;

        const rawType = (config.type as string) || 'novel';
        const isStandardType = projectTypes.some(t => t.value !== 'custom' && t.value === rawType);
        if (isStandardType) {
          formData.value.type = rawType;
          customTypeInput.value = '';
        } else {
          // Если это кастомный тип, убедимся что он есть в барабане
          const inWheel = customStoredTypes.value.some(t => t.value === rawType);
          if (!inWheel) {
            customStoredTypes.value.push({ value: rawType, label: rawType });
            try {
              localStorage.setItem(CUSTOM_TYPES_KEY, JSON.stringify(customStoredTypes.value));
            } catch (err) {
              console.warn(err);
            }
          }
          formData.value.type = rawType;
          customTypeInput.value = '';
        }

        const projectGenres = (config.genres as string[]) || [];
        formData.value.genres = projectGenres;

        // Поиск кастомных жанров, не входящих в стандартный реестр
        const standardValues = new Set(standardGenres.map(g => g.value));
        const extraGenres = projectGenres.filter(g => !standardValues.has(g));
        customGenresList.value = extraGenres.map(g => ({ value: g, label: g }));

        formData.value.perfLevel = (config.perfLevel as string) || 'auto';
        formData.value.cover_image = (config.cover_image as string) || null;
      }
    } catch (e) {
      console.error('Ошибка загрузки конфигурации:', e);
    }
    modalVisible.value = true;
  }

  function closeModal() {
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    modalVisible.value = false;
  }

  function addCustomGenre() {
    const val = customGenreInput.value.trim();
    if (!val) return;

    const alreadyInStandard = standardGenres.some(g => g.value.toLowerCase() === val.toLowerCase() || g.label.toLowerCase() === val.toLowerCase());
    const alreadyInCustom = customGenresList.value.some(g => g.value.toLowerCase() === val.toLowerCase());

    if (!alreadyInStandard && !alreadyInCustom) {
      customGenresList.value.push({ value: val, label: val });
    }

    if (!formData.value.genres.includes(val)) {
      formData.value.genres.push(val);
    }
    customGenreInput.value = '';
  }

  function deleteCustomGenre(genreToRemove: string) {
    customGenresList.value = customGenresList.value.filter(g => g.value !== genreToRemove);
    formData.value.genres = formData.value.genres.filter(g => g !== genreToRemove);
  }

  function removeGenre(genreToRemove: string) {
    formData.value.genres = formData.value.genres.filter(g => g !== genreToRemove);
  }

  async function selectCoverImage() {
    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'Изображения',
          extensions: ['png', 'jpg', 'jpeg', 'webp']
        }]
      });

      if (selected && typeof selected === 'string') {
        const invoke = window.__TAURI__?.core?.invoke;
        if (invoke) {
          try {
            const savedPath = await invoke('copy_background_file', { sourcePath: selected });
            formData.value.cover_image = savedPath as string;
          } catch (err) {
            console.error('Ошибка копирования обложки в ассеты проекта:', err);
            formData.value.cover_image = selected;
          }
        } else {
          formData.value.cover_image = selected;
        }
      }
    } catch (e) {
      console.error('Ошибка выбора обложки:', e);
    }
  }

  function removeCoverImage() {
    formData.value.cover_image = null;
  }

  function resolveCoverUrl(path: string | null): string {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('asset://') || path.startsWith('data:')) {
      return path;
    }
    const convert = window.__TAURI__?.core?.convertFileSrc;
    if (typeof convert === 'function') {
      return convert(path);
    }
    return path;
  }

  async function submitForm() {
    if (!formData.value.name.trim()) return;

    let finalType = formData.value.type;
    if (finalType === 'custom') {
      const customVal = customTypeInput.value.trim();
      if (customVal) {
        saveCustomTypeToWheel();
        finalType = customVal;
      } else {
        finalType = 'novel';
      }
    }

    const payload = {
      name: formData.value.name.trim(),
      type: finalType,
      genres: [...formData.value.genres],
      perfLevel: formData.value.perfLevel,
      cover_image: formData.value.cover_image
    };

    if (isEditing.value) {
      await projectService.saveProjectConfig(editingProjectName.value, payload);
    } else {
      await projectService.createProject(payload);
    }

    modalVisible.value = false;
    await loadProjects();
  }

  return {
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
  };
}
