/**
 * @file useCreateChapterModal.ts
 * @description Логика управления модальным окном создания главы
 */
import { ref, watch } from 'vue';
import * as api from '../../../services/api.client';
import type { CreateChapterModalProps, CreateChapterModalEmits, VolumeOption } from './CreateChapterModal.model';

export function useCreateChapterModal(
  props: CreateChapterModalProps,
  emit: CreateChapterModalEmits
) {
  const title = ref('');
  const selectedVolumeId = ref<string | null>(null);
  const volumes = ref<VolumeOption[]>([{ id: null, title: 'Без тома (корень рукописи)' }]);
  const isLoading = ref(false);
  const errorMessage = ref<string | null>(null);

  const calculateNextChapterTitle = (
    chapters: Array<{ title?: string | null; volume_id?: string | null }>,
    targetVolumeId: string | null
  ): string => {
    let maxNum = 0;
    const relevant = chapters.filter((c) => {
      const cVol = c.volume_id ? String(c.volume_id).split(':').pop() : null;
      const tVol = targetVolumeId ? String(targetVolumeId).split(':').pop() : null;
      return cVol === tVol;
    });

    for (const c of relevant) {
      const match = (c.title || '').match(/Глава\s*(\d+)/i);
      if (match) {
        const n = parseInt(match[1], 10);
        if (n > maxNum) maxNum = n;
      }
    }
    return `Глава ${maxNum + 1}`;
  };

  const loadVolumesAndInit = async () => {
    if (!props.isOpen) return;
    isLoading.value = true;
    errorMessage.value = null;

    try {
      const hierarchy = await api.getChapterHierarchy(props.projectName || 'default');
      const loadedVolumes: VolumeOption[] = [
        { id: null, title: 'Без тома (корень рукописи)' },
      ];

      if (Array.isArray(hierarchy.volumes)) {
        for (const v of hierarchy.volumes) {
          loadedVolumes.push({
            id: String(v.id),
            title: v.title || 'Безымянный том',
          });
        }
      }
      volumes.value = loadedVolumes;

      // Устанавливаем выбранный том
      const initialVol = props.initialVolumeId ? String(props.initialVolumeId) : null;
      const matched = loadedVolumes.some((v) => v.id === initialVol);
      selectedVolumeId.value = matched ? initialVol : null;

      // Рассчитываем название главы по умолчанию, если не передано явно
      if (props.initialTitle && props.initialTitle.trim().length > 0) {
        title.value = props.initialTitle;
      } else {
        const allChapters = Array.isArray(hierarchy.chapters) ? hierarchy.chapters : [];
        title.value = calculateNextChapterTitle(allChapters, selectedVolumeId.value);
      }
    } catch (err) {
      console.error('[useCreateChapterModal] Failed to load hierarchy:', err);
      errorMessage.value = 'Не удалось загрузить список томов';
      title.value = props.initialTitle || 'Глава 1';
    } finally {
      isLoading.value = false;
    }
  };

  watch(
    () => props.isOpen,
    (open) => {
      if (open) {
        void loadVolumesAndInit();
      } else {
        title.value = '';
        selectedVolumeId.value = null;
        errorMessage.value = null;
      }
    },
    { immediate: true }
  );

  const onVolumeChange = async (newVolId: string | null) => {
    selectedVolumeId.value = newVolId;
    // Пересчитываем дефолтное название, если пользователь еще не ввел нестандартное
    if (!title.value || /^Глава\s*\d+$/i.test(title.value.trim())) {
      try {
        const hierarchy = await api.getChapterHierarchy(props.projectName || 'default');
        const allChapters = Array.isArray(hierarchy.chapters) ? hierarchy.chapters : [];
        title.value = calculateNextChapterTitle(allChapters, newVolId);
      } catch (err) {
        console.warn('[useCreateChapterModal] Volume change chapter recalculation failed:', err);
      }
    }
  };

  const handleClose = () => {
    emit('close');
  };

  const handleSubmit = () => {
    const trimmed = title.value.trim();
    if (!trimmed) {
      errorMessage.value = 'Название главы не может быть пустым';
      return;
    }
    errorMessage.value = null;
    emit('create', {
      title: trimmed,
      volumeId: selectedVolumeId.value,
    });
  };

  return {
    title,
    selectedVolumeId,
    volumes,
    isLoading,
    errorMessage,
    onVolumeChange,
    handleClose,
    handleSubmit,
    loadVolumesAndInit,
    calculateNextChapterTitle,
  };
}

