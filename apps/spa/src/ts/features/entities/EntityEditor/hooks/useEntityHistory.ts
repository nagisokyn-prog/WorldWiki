import { ref, shallowRef } from 'vue';
import { apiService } from '../../../../services/api.service';

export function useEntityHistory(props: any, emit: any, formData: any) {
  const showHistory = ref(false);
  const isLoadingHistory = ref(false);
  const revisions = shallowRef<any[]>([]);
  const isPreviewingHistory = ref(false);
  const previewingRevId = ref<string | null>(null);
  const currentSavedData = shallowRef<any>(null);
  const maxSaves = ref(30);

  const togglePin = async (rev: any) => {
    const newStatus = !rev.is_pinned;
    try {
      await apiService.toggleEntityHistoryPin(rev.id, newStatus);
      rev.is_pinned = newStatus;
    } catch (e) {
      console.error('Ошибка при пине ревизии:', e);
    }
  };

  const loadHistory = async () => {
    console.log(`[EntityEditor.vue] loadHistory called for project=`, props.project, ` entityId=`, props.entityId);
    if (!props.project || !props.entityId || !(window as any).__TAURI__) {
      console.warn(`[EntityEditor.vue] loadHistory aborted due to missing props or TAURI`);
      return;
    }
    isLoadingHistory.value = true;
    try {
      console.log(`[EntityEditor.vue] invoking get_entity_revisions...`);
      const rawRevisions = await (window as any).__TAURI__.core.invoke('get_entity_revisions', {
        project: props.project,
        entityId: props.entityId
      }) || [];
      revisions.value = rawRevisions.map((rev: any) => ({
        ...rev,
        formattedDate: new Date(rev.created_at).toLocaleString()
      }));
      console.log(`[EntityEditor.vue] get_entity_revisions returned formatted:`, revisions.value);
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

  const previewHistory = (rev: any) => {
    if (!isPreviewingHistory.value) {
      currentSavedData.value = JSON.parse(JSON.stringify(formData.value));
    }
    isPreviewingHistory.value = true;
    previewingRevId.value = rev.id;
    
    console.log('[EntityEditor] previewHistory rev:', rev);
    formData.value = JSON.parse(JSON.stringify(rev.content?.attributes || rev.content?.data || rev.content || {}));
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
    const rev = revisions.value.find((r: any) => r.id === previewingRevId.value);
    if (rev && rev.content) {
      formData.value = JSON.parse(JSON.stringify(rev.content.data || rev.content));
      emit('modified');
      emit('update:modelValue', formData.value);
      exitHistoryPreview();
    }
  };

  const getDiffSummary = (current: any, previous: any) => {
    if (!previous) return '';
    const currData = current.content?.attributes || current.content?.data || current.content || {};
    const prevData = previous.content?.attributes || previous.content?.data || previous.content || {};
    
    const changes = [];
    
    for (const key of Object.keys(currData)) {
      const cVal = JSON.stringify(currData[key]);
      const pVal = JSON.stringify(prevData[key]);
      if (cVal !== pVal) {
        if (!prevData[key] && currData[key]) {
          changes.push(`<span style="color: #10b981;">+ ${key}</span>`);
        } else {
          changes.push(`<span style="color: #f5a623;">~ ${key}</span>`);
        }
      }
    }
    
    for (const key of Object.keys(prevData)) {
      if (!(key in currData)) {
        changes.push(`<span style="color: #ef4444;">- ${key}</span>`);
      }
    }
    
    if (changes.length === 0) return 'Без изменений';
    return changes.join(', ');
  };

  const isFieldChanged = (path: string) => {
    if (!isPreviewingHistory.value || !currentSavedData.value) return false;
    const currentVal = path.split('.').reduce((obj: any, key: string) => (obj && obj[key] !== 'undefined') ? obj[key] : undefined, currentSavedData.value);
    const historyVal = path.split('.').reduce((obj: any, key: string) => (obj && obj[key] !== 'undefined') ? obj[key] : undefined, formData.value);
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
