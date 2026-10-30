import { ref, watch, onMounted, onUnmounted, nextTick, shallowRef } from 'vue';
import { settingsService } from '@worldwiki/components';
import { useEntityHistory } from './hooks/useEntityHistory';
import { useEntityHelpers } from './hooks/useEntityHelpers';
import { useEntityPhoto } from './hooks/useEntityPhoto';
import { useEntityDynamicOps } from './hooks/useEntityDynamicOps';
import { useEntityConfigLoader } from './hooks/useEntityConfigLoader';
import type { EntityEditorProps, SchemaConfig, SchemaSection, SchemaField } from './EntityEditor.model';

export function normalizeEntityFormData(data: Record<string, unknown> | undefined | null): Record<string, unknown> {
  const normalized = data ? JSON.parse(JSON.stringify(data)) : {};
  const rawTags = normalized['теги'] ?? normalized.tags ?? (normalized.attributes && (normalized.attributes['теги'] ?? normalized.attributes.tags)) ?? [];
  const cleanTags = Array.isArray(rawTags)
    ? rawTags.map((t: unknown) => String(t).trim().replace(/^#/, '')).filter(Boolean)
    : typeof rawTags === 'string'
      ? rawTags.split(',').map((t: string) => t.trim().replace(/^#/, '')).filter(Boolean)
      : [];
  normalized['теги'] = cleanTags;
  normalized.tags = cleanTags;
  if (!normalized['название'] && normalized.name) {
    normalized['название'] = normalized.name;
  }
  if (!normalized.name && normalized['название']) {
    normalized.name = normalized['название'];
  }
  return normalized;
}

export function useEntityEditor(props: EntityEditorProps, emit: (event: string, ...args: unknown[]) => void) {
  const loading = ref(true);
  const isInitializing = ref(false);
  const config = shallowRef<SchemaConfig | null>(null);
  const formData = ref<Record<string, unknown>>(normalizeEntityFormData(props.initialData));
  const lastEmittedData = ref<string | null>(null);
  const foreignUpdates = ref<Record<string, unknown>>({});
  const activeSection = ref('');
  const referenceData = ref<Record<string, Array<{ value: string; label: string }>>>({});
  const hoverState = ref(false);
  const scrollContainer = ref<HTMLElement | null>(null);
  const wheelHorizontal = ref(settingsService.getSettings()?.dropdowns?.wheelOrientation === 'horizontal');

  const historyHook = useEntityHistory(props, emit, formData);
  const helpers = useEntityHelpers(formData, config);

  const markModified = () => {
    if (isInitializing.value || historyHook.isPreviewingHistory.value) return;

    const combinedData = { ...formData.value, __foreignUpdates: foreignUpdates.value };
    const currentSerialized = JSON.stringify(combinedData);

    if (currentSerialized !== lastEmittedData.value) {
      emit('modified');
      emit('update:modelValue', combinedData);
      emit('update-data', combinedData);
      lastEmittedData.value = currentSerialized;
    }
  };

  const {
    photoInputs,
    triggerPhotoUpload,
    handlePhotoFile,
    handlePhotoDrop,
    removePhoto
  } = useEntityPhoto((path, val) => helpers.setProp(path, val));

  const {
    handleForeignUpdate,
    onDynamicUpdate,
    addDynamicItem,
    removeDynamicItem
  } = useEntityDynamicOps({
    formData,
    foreignUpdates,
    config,
    getDynamicList: helpers.getDynamicList,
    setProp: helpers.setProp,
    markModified
  });

  const {
    loadReferenceData,
    loadConfigAndData
  } = useEntityConfigLoader({
    props,
    config,
    loading,
    isInitializing,
    activeSection,
    formData,
    foreignUpdates,
    lastEmittedData,
    referenceData,
    scrollContainer,
    emit
  });

  const onSchemaUpdated = (e: Event) => {
    const customEvent = e as CustomEvent<{ entityType?: string }>;
    if (!customEvent.detail || customEvent.detail.entityType === props.entityType) {
      loadConfigAndData();
    }
  };

  const handleToggleHistory = (e: CustomEvent) => {
    if (e.detail.id === props.entityId || e.detail.id === `${props.entityType}:${props.entityId}`) {
      historyHook.toggleHistory();
    }
  };

  const onTagsUpdated = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    if (!detail) return;
    const targetId = String(detail.entityId || detail.id || '');
    const myId = String(props.entityId || '');
    const cleanTarget = targetId.split(':').pop();
    const cleanMy = myId.split(':').pop();
    if (cleanTarget && cleanMy && cleanTarget === cleanMy && Array.isArray(detail.tags)) {
      const cleanTags = detail.tags.map((t: unknown) => String(t).trim().replace(/^#/, '')).filter(Boolean);
      formData.value['теги'] = cleanTags;
      formData.value.tags = cleanTags;
      if (formData.value.attributes && typeof formData.value.attributes === 'object') {
        (formData.value.attributes as Record<string, unknown>)['теги'] = cleanTags;
        (formData.value.attributes as Record<string, unknown>).tags = cleanTags;
      }
    }
  };

  onMounted(() => {
    loadConfigAndData();
    window.addEventListener('ww:schema-updated', onSchemaUpdated);
    window.addEventListener('ww:global-save-triggered', historyHook.loadHistory);
    document.addEventListener('ww:toggle-entity-history', handleToggleHistory as EventListener);
    document.addEventListener('ww:tags-updated', onTagsUpdated);
  });

  onUnmounted(() => {
    window.removeEventListener('ww:schema-updated', onSchemaUpdated);
    window.removeEventListener('ww:global-save-triggered', historyHook.loadHistory);
    document.removeEventListener('ww:toggle-entity-history', handleToggleHistory as EventListener);
    document.removeEventListener('ww:tags-updated', onTagsUpdated);
  });

  watch(() => config.value, (newConfig) => {
    if (newConfig) {
      const firstSection = newConfig.sections?.[0];
      const firstField = firstSection?.fields?.[0];
      const firstFieldPath = firstField?.path || firstField?.id || firstField?.class || newConfig.titleField;
      if (firstFieldPath && formData.value.name && !formData.value[firstFieldPath]) {
        formData.value[firstFieldPath] = formData.value.name;
      }
      if (newConfig.sections && newConfig.sections.length > 0 && !activeSection.value) {
        if (props.initialSection && newConfig.sections.some((s: SchemaSection) => s.id === props.initialSection)) {
          activeSection.value = props.initialSection;
        } else {
          activeSection.value = newConfig.sections[0].id;
        }
        emit('section-change', activeSection.value);
      }
    }
  }, { immediate: true });

  watch(() => props.initialData, (newVal) => {
    if (!historyHook.isPreviewingHistory.value) {
      const normalized = normalizeEntityFormData(newVal);
      const isDiff = JSON.stringify(normalized) !== JSON.stringify(formData.value);
      if (isDiff) {
        isInitializing.value = true;
        formData.value = normalized;
        lastEmittedData.value = JSON.stringify({ ...formData.value, __foreignUpdates: foreignUpdates.value });
        nextTick(() => {
          isInitializing.value = false;
        });
      }
    }
  }, { deep: true });

  watch(formData, () => {
    markModified();
  }, { deep: true });

  watch(foreignUpdates, () => {
    markModified();
  }, { deep: true });

  watch(activeSection, (newSec) => {
    if (newSec) emit('section-change', newSec);
  });

  const getOptionsFor = (field: SchemaField) => {
    if (field.entityType && referenceData.value[`${field.entityType}_list`]) {
      return referenceData.value[`${field.entityType}_list`];
    }
    return field.options || [];
  };

  const isChapterField = (field: { class?: string; id?: string; type?: string; entityType?: string }): boolean => {
    if (field.entityType === 'chapter') return true;
    if (field.type === 'manuscript_point' || field.type === 'chapter') return true;
    const cls = (field.class || field.id || '').toLowerCase();
    return cls.includes('глава') || cls.includes('chapter') || cls === 'начальная_глава' || cls === 'конечная_глава';
  };

  return {
    loading,
    isInitializing,
    config,
    formData,
    activeSection,
    referenceData,
    photoInputs,
    hoverState,
    scrollContainer,
    wheelHorizontal,
    triggerPhotoUpload,
    handlePhotoFile,
    handlePhotoDrop,
    removePhoto,
    onDynamicUpdate,
    lastEmittedData,
    foreignUpdates,
    loadConfigAndData,
    loadReferenceData,
    getOptionsFor,
    markModified,
    handleForeignUpdate,
    addDynamicItem,
    removeDynamicItem,
    isChapterField,
    ...historyHook,
    ...helpers
  };
}