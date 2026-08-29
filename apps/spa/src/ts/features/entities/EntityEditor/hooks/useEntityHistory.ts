import { ref, shallowRef } from 'vue';
import type { Ref } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import * as api from '../../../../services/api.client';
import type { EntityRevision, EntityEditorProps } from '../EntityEditor.model';

export function useEntityHistory(
  props: EntityEditorProps,
  emit: (event: string, ...args: unknown[]) => void,
  formData: Ref<Record<string, unknown>>
) {
  const showHistory = ref(false);
  const isLoadingHistory = ref(false);
  const revisions = shallowRef<EntityRevision[]>([]);
  const isPreviewingHistory = ref(false);
  const previewingRevId = ref<string | null>(null);
  const currentSavedData = shallowRef<Record<string, unknown> | null>(null);
  const maxSaves = ref(30);

  const togglePin = async (rev: EntityRevision) => {
    const newStatus = !rev.is_pinned;
    try {
      await api.toggleEntityHistoryPin(rev.id, newStatus);
      rev.is_pinned = newStatus;
    } catch (e) {
      console.error('Ошибка при пине ревизии:', e);
    }
  };

  const loadHistory = async () => {
    if (!props.project || !props.entityId) {
      return;
    }
    isLoadingHistory.value = true;
    try {
      const rawRevisions = await invoke<EntityRevision[]>('get_entity_revisions', {
        project: props.project,
        entityId: props.entityId
      }) || [];
      revisions.value = rawRevisions.map((rev) => ({
        ...rev,
        formattedDate: new Date(rev.created_at).toLocaleString()
      }));
    } catch (e) {
      console.error('Ошибка загрузки истории:', e);
    } finally {
      isLoadingHistory.value = false;
    }
  };

  const toggleHistory = () => {
    showHistory.value = !showHistory.value;
    if (showHistory.value && revisions.value.length === 0) {
      loadHistory();
    }
  };

  const previewHistory = (rev: EntityRevision) => {
    if (!isPreviewingHistory.value) {
      currentSavedData.value = JSON.parse(JSON.stringify(formData.value));
    }
    isPreviewingHistory.value = true;
    previewingRevId.value = rev.id;
    
    const content = rev.content as { attributes?: Record<string, unknown>; data?: Record<string, unknown> } | Record<string, unknown>;
    formData.value = JSON.parse(JSON.stringify(content?.attributes || content?.data || content || {}));
  };

  const exitHistoryPreview = () => {
    if (currentSavedData.value) {
      formData.value = JSON.parse(JSON.stringify(currentSavedData.value));
    }
    isPreviewingHistory.value = false;
    previewingRevId.value = null;
    currentSavedData.value = null;
  };

  const restoreHistory = async () => {
    if (!previewingRevId.value) return;
    const rev = revisions.value.find((r) => r.id === previewingRevId.value);
    if (rev && rev.content) {
      const content = rev.content as { attributes?: Record<string, unknown>; data?: Record<string, unknown> } | Record<string, unknown>;
      const restored = JSON.parse(JSON.stringify(content.attributes || content.data || content));
      currentSavedData.value = null;
      formData.value = restored;
      emit('modified');
      emit('update:modelValue', formData.value);
      exitHistoryPreview();
    }
  };

  const getDiffSummary = (current: EntityRevision, previous: EntityRevision | undefined) => {
    if (!previous) return '';
    const curr = current.content as { attributes?: Record<string, unknown>; data?: Record<string, unknown> } | Record<string, unknown>;
    const prev = previous.content as { attributes?: Record<string, unknown>; data?: Record<string, unknown> } | Record<string, unknown>;
    const currData = (curr?.attributes || curr?.data || curr || {}) as Record<string, unknown>;
    const prevData = (prev?.attributes || prev?.data || prev || {}) as Record<string, unknown>;
    
    const changes = [];
    
    for (const key of Object.keys(currData)) {
      const cVal = JSON.stringify(currData[key]);
      const pVal = JSON.stringify(prevData[key]);
      if (cVal !== pVal) {
        if (!prevData[key] && currData[key]) {
          changes.push(`<span class="text-success">+ ${key}</span>`);
        } else {
          changes.push(`<span class="text-warning">~ ${key}</span>`);
        }
      }
    }
    
    for (const key of Object.keys(prevData)) {
      if (!(key in currData)) {
        changes.push(`<span class="text-error">- ${key}</span>`);
      }
    }
    
    if (changes.length === 0) return 'Без изменений';
    return changes.join(', ');
  };

  const isFieldChanged = (path: string) => {
    if (!isPreviewingHistory.value || !currentSavedData.value) return false;
    const currentVal = path.split('.').reduce<unknown>((obj, key) => (obj && typeof obj === 'object' && (obj as Record<string, unknown>)[key] !== undefined) ? (obj as Record<string, unknown>)[key] : undefined, currentSavedData.value);
    const historyVal = path.split('.').reduce<unknown>((obj, key) => (obj && typeof obj === 'object' && (obj as Record<string, unknown>)[key] !== undefined) ? (obj as Record<string, unknown>)[key] : undefined, formData.value);
    return JSON.stringify(currentVal) !== JSON.stringify(historyVal);
  };

  return {
    showHistory,
    isLoadingHistory,
    revisions,
    isPreviewingHistory,
    previewingRevId,
    currentSavedData,
    maxSaves,
    togglePin,
    loadHistory,
    toggleHistory,
    previewHistory,
    exitHistoryPreview,
    restoreHistory,
    getDiffSummary,
    isFieldChanged
  };
}
