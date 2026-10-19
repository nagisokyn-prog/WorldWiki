import { ref, computed } from 'vue';
import { projectService } from '../../services/project.service';
import type { ProjectFormData } from './projectLauncher.constants';

export function useProjectLauncherModal(
  loadProjects: () => Promise<void>
) {
  const modalVisible = ref(false);
  const isEditing = ref(false);
  const editingProjectName = ref('');

  const formData = ref<ProjectFormData>({
    name: '',
    type: 'book',
    genres: [],
    perfLevel: 'auto'
  });

  const modalTitle = computed(() => {
    return isEditing.value ? 'Редактировать проект' : 'Создать проект';
  });

  const submitButtonText = computed(() => {
    return isEditing.value ? 'Сохранить' : 'Создать';
  });

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

  function closeModal() {
    modalVisible.value = false;
  }

  async function submitForm() {
    try {
      if (isEditing.value) {
        await projectService.saveProjectConfig(editingProjectName.value, {
          type: formData.value.type,
          genres: formData.value.genres,
          perfLevel: formData.value.perfLevel
        });
        await loadProjects();
      } else {
        await projectService.createProject({
          name: formData.value.name,
          type: formData.value.type,
          genres: formData.value.genres,
          perfLevel: formData.value.perfLevel
        });
        await loadProjects();
      }
      closeModal();
    } catch (e) {
      console.error('Ошибка сохранения проекта:', e);
    }
  }

  return {
    modalVisible,
    isEditing,
    editingProjectName,
    formData,
    modalTitle,
    submitButtonText,
    openCreateModal,
    editProject,
    closeModal,
    submitForm
  };
}
