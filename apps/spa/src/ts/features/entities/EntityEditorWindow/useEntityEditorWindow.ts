import { ref, onMounted, onUnmounted } from 'vue';
import type { EntityEditorWindowProps, EntityEditorWindowRevision } from './EntityEditorWindow.model';
import * as api from '@/services/api.client';
import { entityApi } from '@/services/Entity/entity.api';
import type { Entity } from '@/types/generated/Entity';
import { appAlert } from '@worldwiki/components';
import { deepMergeRecord } from './EntityEditorWindow.utils';

export function useEntityEditorWindow(props: EntityEditorWindowProps) {
  const isLoadingData = ref(true);
  const initialData = ref<Record<string, unknown>>({});
  const isUnsaved = ref(false);
  const editorRef = ref<{
    getFormData: () => Record<string, unknown>;
    getForeignUpdates?: () => Record<string, unknown>;
  } | null>(null);

  // История версий
  const showHistory = ref(false);
  const isLoadingHistory = ref(false);
  const revisions = ref<EntityEditorWindowRevision[]>([]);

  const isPreviewingHistory = ref(false);
  const previewingRevId = ref<string | null>(null);
  const previewData = ref<unknown>(null);
  const previewKey = ref(0);

  const loadData = async () => {
    try {
      if (props.project && props.entityType && props.entityId) {
        const detail = await entityApi.getEntity(props.project, props.entityType, props.entityId);
        if (detail) {
          initialData.value = detail as Record<string, unknown>;
        }
      }
    } catch (e: unknown) {
      console.error('Ошибка загрузки данных сущности:', e);
    } finally {
      isLoadingData.value = false;
    }
  };

  const loadHistory = async () => {
    if (!props.project || !props.entityId || typeof window === 'undefined' || !window.__TAURI__) {
      return;
    }
    isLoadingHistory.value = true;
    try {
      const rawRevisions = await window.__TAURI__.core.invoke<EntityEditorWindowRevision[]>(
        'get_entity_revisions',
        {
          project: props.project,
          entityId: props.entityId,
        }
      );
      revisions.value = rawRevisions.map((rev) => ({
        ...rev,
        formattedDate: new Date(rev.created_at).toLocaleString(),
      }));
    } catch (e: unknown) {
      console.error('Ошибка загрузки истории:', e);
      appAlert('Не удалось загрузить историю изменений');
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

  const previewHistory = (rev: EntityEditorWindowRevision) => {
    isPreviewingHistory.value = true;
    previewingRevId.value = rev.id;
    previewData.value = rev.content;
    previewKey.value++;
  };

  const exitHistoryPreview = () => {
    isPreviewingHistory.value = false;
    previewingRevId.value = null;
    previewData.value = null;
    previewKey.value++;
  };

  const restoreHistory = () => {
    initialData.value = JSON.parse(JSON.stringify(previewData.value || {}));
    isPreviewingHistory.value = false;
    previewingRevId.value = null;
    previewData.value = null;
    previewKey.value++;
    isUnsaved.value = true;
  };

  const save = async () => {
    if (!editorRef.value?.getFormData) {
      return;
    }
    const formData = editorRef.value.getFormData();
    const foreignUpdates = editorRef.value.getForeignUpdates
      ? editorRef.value.getForeignUpdates()
      : {};

    try {
      const entityIdFormatted = props.entityId.startsWith('entities:')
        ? props.entityId
        : `entities:${props.entityId}`;

      const mainPayload = entityApi.formatEntityPayload(
        props.project,
        props.entityType,
        formData,
        entityIdFormatted,
        (formData.name as string) || 'Сущность'
      );

      await api.saveEntityWithRelations(
        props.project,
        mainPayload as unknown as Entity,
        Object.values(foreignUpdates) as unknown as Entity[]
      );

      isUnsaved.value = false;
      if (showHistory.value) {
        loadHistory();
      }

      const { emit } = await import('@tauri-apps/api/event');
      await emit('ww-entity-saved', { type: props.entityType, id: props.entityId });
    } catch (e: unknown) {
      console.error('Ошибка сохранения:', e);
      appAlert('Ошибка сохранения сущности');
    }
  };

  let isLiveSyncing = false;
  let liveSyncTimer: ReturnType<typeof setTimeout> | null = null;

  let currentWindowLabel = `entity-editor-${props.entityType}-${props.entityId.replace(/:/g, '-')}`;
  if (typeof window !== 'undefined' && window.__TAURI__) {
    import('@tauri-apps/api/webviewWindow')
      .then(({ getCurrentWebviewWindow }) => {
        currentWindowLabel = getCurrentWebviewWindow().label;
      })
      .catch((e: unknown) => {
        console.warn('getCurrentWebviewWindow not available', e);
      });
  }

  const handleUpdateData = (data: Record<string, unknown>) => {
    if (isLiveSyncing) {
      return;
    }
    if (liveSyncTimer) {
      clearTimeout(liveSyncTimer);
    }
    liveSyncTimer = setTimeout(async () => {
      try {
        const { emit } = await import('@tauri-apps/api/event');
        await emit('ww-entity-live-sync', {
          type: props.entityType,
          id: props.entityId,
          data,
          sender: currentWindowLabel,
        });
      } catch (e: unknown) {
        console.error('[LiveSync] Error emitting', e);
      }
    }, 250);
  };

  let unlistenSaved: (() => void) | null = null;
  let unlistenSync: (() => void) | null = null;

  onMounted(async () => {
    loadData();

    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'EDITOR_LOADED', id: props.entityId }, '*');
    }

    try {
      const { listen } = await import('@tauri-apps/api/event');
      unlistenSaved = await listen<{ type: string; id: string }>(
        'ww-entity-saved',
        (event) => {
          const { type, id } = event.payload;
          const cleanId = (id || '').replace(/^entities:/, '');
          const cleanEntityId = (props.entityId || '').replace(/^entities:/, '');
          if (type === props.entityType && (cleanId === cleanEntityId || id === props.entityId)) {
            loadData();
          }
        }
      );

      unlistenSync = await listen<{
        type: string;
        id: string;
        data: Record<string, unknown>;
        sender?: string;
      }>('ww-entity-live-sync', (event) => {
        if (event.payload.sender && event.payload.sender === currentWindowLabel) {
          return;
        }
        const { type, id, data } = event.payload;
        const cleanId = (id || '').replace(/^entities:/, '');
        const cleanEntityId = (props.entityId || '').replace(/^entities:/, '');
        if (type === props.entityType && (cleanId === cleanEntityId || id === props.entityId)) {
          if (initialData.value) {
            const currentStr = JSON.stringify(initialData.value);
            const nextStr = JSON.stringify({ ...initialData.value, ...data });
            if (currentStr === nextStr) {
              return;
            }

            isLiveSyncing = true;
            deepMergeRecord(initialData.value, data);
            initialData.value = { ...initialData.value };
            setTimeout(() => {
              isLiveSyncing = false;
            }, 100);
          }
        }
      });
    } catch (e: unknown) {
      console.warn('Tauri listen not available in EntityEditorWindow', e);
    }
  });

  onUnmounted(() => {
    if (liveSyncTimer) {
      clearTimeout(liveSyncTimer);
    }
    if (unlistenSaved) {
      unlistenSaved();
    }
    if (unlistenSync) {
      unlistenSync();
    }
  });

  return {
    isLoadingData,
    initialData,
    isUnsaved,
    editorRef,
    showHistory,
    isLoadingHistory,
    revisions,
    isPreviewingHistory,
    previewingRevId,
    previewData,
    previewKey,
    loadData,
    loadHistory,
    toggleHistory,
    previewHistory,
    exitHistoryPreview,
    restoreHistory,
    save,
    handleUpdateData,
  };
}

