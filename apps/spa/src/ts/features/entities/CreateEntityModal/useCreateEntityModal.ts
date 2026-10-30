/**
 * @file useCreateEntityModal.ts
 * @description Composable для управления модальным окном создания сущности без хардкода типов
 */
import { ref, computed, watch } from 'vue';
import * as api from '../../../services/api.client';
import { entityApi } from '../../../services/Entity/entity.api';
import type {
  CreateEntityModalProps,
  CreateEntityModalEmits,
  EntityTypeOption,
} from './CreateEntityModal.model';

export function useCreateEntityModal(
  props: CreateEntityModalProps,
  emit: CreateEntityModalEmits
) {
  const entityName = ref('');
  const selectedEntityType = ref('');
  const availableTypes = ref<EntityTypeOption[]>([]);
  const searchTypeQuery = ref('');
  const isLoading = ref(false);
  const errorMessage = ref<string | null>(null);

  const filteredTypes = computed<EntityTypeOption[]>(() => {
    const q = searchTypeQuery.value.trim().toLowerCase();
    if (!q) return availableTypes.value;
    return availableTypes.value.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.type.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q))
    );
  });

  const loadEntityTypes = async () => {
    if (!props.isOpen) return;
    isLoading.value = true;
    errorMessage.value = null;

    try {
      const schemas = await api.getEntitySchemas(props.projectName || 'default');
      const options: EntityTypeOption[] = [];

      if (Array.isArray(schemas) && schemas.length > 0) {
        for (const s of schemas) {
          if (!s.type_key) continue;
          options.push({
            type: s.type_key,
            name: s.type_name || s.type_key,
            icon: s.icon || '📄',
            description: typeof s.full_schema === 'object' && s.full_schema !== null
              ? (s.full_schema as Record<string, unknown>).description as string | undefined
              : undefined,
          });
        }
      }

      // Fallback: если бэкенд вернул пустой список, запрашиваем через entityApi
      if (options.length === 0) {
        const dict = await entityApi.getSchemas(props.projectName || 'default');
        for (const [key, val] of Object.entries(dict)) {
          options.push({
            type: key,
            name: val.name || key,
            icon: val.icon || '📄',
            description: typeof val.full_schema === 'object' && val.full_schema !== null
              ? (val.full_schema as Record<string, unknown>).description as string | undefined
              : undefined,
          });
        }
      }

      availableTypes.value = options;

      // Выбор типа: сначала проверяем initialEntityType, затем первый доступный
      if (props.initialEntityType && options.some((o) => o.type === props.initialEntityType)) {
        selectedEntityType.value = props.initialEntityType;
      } else if (options.length > 0) {
        selectedEntityType.value = options[0].type;
      } else {
        selectedEntityType.value = '';
      }

      entityName.value = props.initialName || '';
    } catch (err: unknown) {
      console.error('[useCreateEntityModal] Failed to load entity schemas:', err);
      errorMessage.value = 'Не удалось загрузить типы сущностей';
    } finally {
      isLoading.value = false;
    }
  };

  watch(
    () => props.isOpen,
    (open) => {
      if (open) {
        searchTypeQuery.value = '';
        void loadEntityTypes();
      } else {
        entityName.value = '';
        selectedEntityType.value = '';
        errorMessage.value = null;
      }
    },
    { immediate: true }
  );

  const selectType = (typeKey: string) => {
    selectedEntityType.value = typeKey;
  };

  const handleClose = () => {
    emit('close');
  };

  const handleSubmit = () => {
    const trimmed = entityName.value.trim();
    if (!trimmed) {
      errorMessage.value = 'Введите название сущности';
      return;
    }
    if (!selectedEntityType.value) {
      errorMessage.value = 'Выберите тип сущности';
      return;
    }
    errorMessage.value = null;
    emit('create', {
      entityType: selectedEntityType.value,
      name: trimmed,
    });
  };

  return {
    entityName,
    selectedEntityType,
    availableTypes,
    filteredTypes,
    searchTypeQuery,
    isLoading,
    errorMessage,
    selectType,
    handleClose,
    handleSubmit,
    loadEntityTypes,
  };
}

