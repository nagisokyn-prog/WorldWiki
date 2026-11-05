/**
 * @file useEntityHiddenConfig.ts
 * @description Управление скрытыми элементами конкретной сущности (страницы, поля, динамические контейнеры)
 */
import { ref, computed, watch, type Ref, type ShallowRef } from 'vue';
import type {
  EntityHiddenConfig,
  SchemaSection,
  SchemaField,
  DynamicContainer,
  SchemaConfig,
} from '../EntityEditor.model';

export function parseEntityHiddenConfig(raw: unknown): EntityHiddenConfig {
  const result: EntityHiddenConfig = {
    sections: [],
    fields: [],
    containers: [],
  };
  if (!raw || typeof raw !== 'object') return result;
  const obj = raw as Record<string, unknown>;
  if (Array.isArray(obj.sections)) {
    result.sections = obj.sections.map(String).filter(Boolean);
  }
  if (Array.isArray(obj.fields)) {
    result.fields = obj.fields.map(String).filter(Boolean);
  }
  if (Array.isArray(obj.containers)) {
    result.containers = obj.containers.map(String).filter(Boolean);
  }
  return result;
}

export function useEntityHiddenConfig(
  formData: Ref<Record<string, unknown>>,
  config: ShallowRef<SchemaConfig | null> | Ref<SchemaConfig | null>,
  onChanged: () => void
) {
  const hiddenConfig = ref<EntityHiddenConfig>(
    parseEntityHiddenConfig(
      formData.value._hidden ?? (formData.value.attributes as Record<string, unknown> | undefined)?._hidden
    )
  );

  watch(
    () => formData.value._hidden ?? (formData.value.attributes as Record<string, unknown> | undefined)?._hidden,
    (newVal) => {
      const parsed = parseEntityHiddenConfig(newVal);
      if (JSON.stringify(parsed) !== JSON.stringify(hiddenConfig.value)) {
        hiddenConfig.value = parsed;
      }
    },
    { deep: true }
  );

  const isSectionHidden = (id: string): boolean => {
    if (!id) return false;
    return hiddenConfig.value.sections.includes(id);
  };

  const isFieldHidden = (pathOrId: string): boolean => {
    if (!pathOrId) return false;
    return hiddenConfig.value.fields.includes(pathOrId);
  };

  const isContainerHidden = (idOrDataPath: string): boolean => {
    if (!idOrDataPath) return false;
    return hiddenConfig.value.containers.includes(idOrDataPath);
  };

  const canHideSection = (sec: SchemaSection, idx: number): boolean => {
    if (!sec || idx === 0) return false;
    if (sec.isSystem || sec.preventHide) return false;
    return true;
  };

  const canHideField = (field: SchemaField): boolean => {
    if (!field) return false;
    if (field.isSystem || field._isSystemName || field.preventHide || field.required) return false;
    const firstSection = config.value?.sections?.[0];
    const firstField = firstSection?.fields?.[0];
    const firstFieldKey =
      firstField?.path || firstField?.id || firstField?.class || config.value?.titleField;
    const currentKey = field.path || field.id || field.class;
    if (firstFieldKey && currentKey === firstFieldKey) return false;
    return true;
  };

  const canHideContainer = (container: DynamicContainer): boolean => {
    if (!container) return false;
    if (container.isSystem || container.preventHide) return false;
    return true;
  };

  const syncToFormData = () => {
    formData.value._hidden = JSON.parse(JSON.stringify(hiddenConfig.value));
    if (formData.value.attributes && typeof formData.value.attributes === 'object') {
      (formData.value.attributes as Record<string, unknown>)._hidden = JSON.parse(
        JSON.stringify(hiddenConfig.value)
      );
    }
    onChanged();
  };

  const hideSection = (id: string) => {
    if (!id || hiddenConfig.value.sections.includes(id)) return;
    hiddenConfig.value.sections.push(id);
    syncToFormData();
  };

  const unhideSection = (id: string) => {
    const idx = hiddenConfig.value.sections.indexOf(id);
    if (idx !== -1) {
      hiddenConfig.value.sections.splice(idx, 1);
      syncToFormData();
    }
  };

  const hideField = (pathOrId: string) => {
    if (!pathOrId || hiddenConfig.value.fields.includes(pathOrId)) return;
    hiddenConfig.value.fields.push(pathOrId);
    syncToFormData();
  };

  const unhideField = (pathOrId: string) => {
    const idx = hiddenConfig.value.fields.indexOf(pathOrId);
    if (idx !== -1) {
      hiddenConfig.value.fields.splice(idx, 1);
      syncToFormData();
    }
  };

  const hideContainer = (idOrDataPath: string) => {
    if (!idOrDataPath || hiddenConfig.value.containers.includes(idOrDataPath)) return;
    hiddenConfig.value.containers.push(idOrDataPath);
    syncToFormData();
  };

  const unhideContainer = (idOrDataPath: string) => {
    const idx = hiddenConfig.value.containers.indexOf(idOrDataPath);
    if (idx !== -1) {
      hiddenConfig.value.containers.splice(idx, 1);
      syncToFormData();
    }
  };

  const unhideAll = () => {
    hiddenConfig.value = { sections: [], fields: [], containers: [] };
    syncToFormData();
  };

  const totalHiddenCount = computed(() => {
    return (
      hiddenConfig.value.sections.length +
      hiddenConfig.value.fields.length +
      hiddenConfig.value.containers.length
    );
  });

  return {
    hiddenConfig,
    isSectionHidden,
    isFieldHidden,
    isContainerHidden,
    canHideSection,
    canHideField,
    canHideContainer,
    hideSection,
    unhideSection,
    hideField,
    unhideField,
    hideContainer,
    unhideContainer,
    unhideAll,
    totalHiddenCount,
  };
}
