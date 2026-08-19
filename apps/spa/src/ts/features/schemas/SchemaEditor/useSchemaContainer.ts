import { computed, ref } from 'vue';
import uiEditorData from '../../../../../public/struct/editor/ui_editor.json';

export interface SchemaContainerItem {
    template?: string;
    title?: string;
    emptyMessage?: string;
    hidden?: boolean;
    customFields?: unknown[];
    fieldOverrides?: Record<string, { hidden?: boolean; options?: Array<{ value: string; label: string }>; [key: string]: unknown }>;
    [key: string]: unknown;
}

export function useSchemaContainer(props: { item: SchemaContainerItem }) {
    const isDraggedOver = ref(false);
    const fullConfig = ref<{ templates?: Record<string, { fields?: unknown[] }> }>(uiEditorData);

    const availableEntityTypes = computed(() => {
        let rawSchemas: Record<string, { default?: { name?: string; entityType?: string }; name?: string; entityType?: string }> = {};
        try {
            rawSchemas = import.meta.glob<Record<string, { default?: { name?: string; entityType?: string }; name?: string; entityType?: string }>>('../../../../../public/struct/editor/*.json', { eager: true });
        } catch {
            rawSchemas = {};
        }
        const types = [];
        for (const path in rawSchemas) {
            if (path.includes('ui_editor')) continue;
            const data = rawSchemas[path]?.default || rawSchemas[path];
            if (data && data.name) {
                types.push({ value: data.entityType || data.name, label: data.name });
            }
        }
        return types;
    });

    const atomicBricks = [
        { value: 'text', label: 'Текст' },
        { value: 'textarea', label: 'Абзац' },
        { value: 'select', label: 'Список' },
        { value: 'multiselect', label: 'Мульти' },
        { value: 'calendar_date', label: 'Дата' },
        { value: 'calendar_datetime', label: 'Дата и время' },
        { value: 'range', label: 'Шкала' },
        { value: 'number', label: 'Число' },
        { value: 'tags', label: 'Теги' },
        { value: 'photo', label: 'Фото' }
    ];

    const getRawTemplateFields = (templateName: string) => {
        return fullConfig.value.templates?.[templateName]?.fields || [];
    };

    const ensureFieldOverride = (item: SchemaContainerItem, fieldClass: string) => {
        if (!item.fieldOverrides) item.fieldOverrides = {};
        if (!item.fieldOverrides[fieldClass]) {
            item.fieldOverrides[fieldClass] = {};
        }
        return item.fieldOverrides[fieldClass];
    };

    const getFieldOverride = (item: SchemaContainerItem, fieldClass: string) => {
        return item.fieldOverrides?.[fieldClass] || {};
    };

    const toggleFieldOverride = (item: SchemaContainerItem, fieldClass: string) => {
        const override = ensureFieldOverride(item, fieldClass);
        override.hidden = !override.hidden;
    };

    const addFieldOption = (item: SchemaContainerItem, fieldClass: string) => {
        const override = ensureFieldOverride(item, fieldClass);
        if (!override.options) override.options = [];
        override.options.push({ value: 'new_val', label: 'Новый вариант' });
    };

    const isTimeline = computed(() => {
        return props.item.template ? (props.item.template.includes('timeline') || props.item.template.includes('events')) : undefined;
    });

    const updateTitle = (val: string) => {
        props.item.title = val;
    };

    const updateEmptyMessage = (val: string) => {
        props.item.emptyMessage = val;
    };

    const toggleHidden = () => {
        props.item.hidden = !props.item.hidden;
    };

    const removeCustomField = (index: number) => {
        if (Array.isArray(props.item.customFields)) {
            props.item.customFields.splice(index, 1);
        }
    };

    return {
        isDraggedOver,
        fullConfig,
        availableEntityTypes,
        atomicBricks,
        getRawTemplateFields,
        ensureFieldOverride,
        getFieldOverride,
        toggleFieldOverride,
        addFieldOption,
        isTimeline,
        updateTitle,
        updateEmptyMessage,
        toggleHidden,
        removeCustomField
    };
}
