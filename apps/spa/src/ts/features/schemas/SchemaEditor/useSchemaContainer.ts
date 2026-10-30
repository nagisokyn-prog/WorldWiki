import { computed, ref } from 'vue';

export interface SchemaCustomField {
    label?: string;
    type?: string;
    placeholder?: string;
    sourceType?: string;
    targetType?: string;
    options?: Array<{ value: string; label: string }>;
    [key: string]: unknown;
}

export interface SchemaTemplateField {
    class: string;
    label?: string;
    type?: string;
    placeholder?: string;
    entityType?: string;
    options?: Array<{ value: string; label: string }>;
    [key: string]: unknown;
}

export interface SchemaDynamicContainer {
    id: string;
    title?: string;
    emptyMessage?: string;
    fields?: SchemaTemplateField[];
    [key: string]: unknown;
}

export interface SchemaTemplateConfig {
    isBidirectional?: boolean;
    fields?: SchemaTemplateField[];
    dynamicContainers?: SchemaDynamicContainer[];
    [key: string]: unknown;
}

export interface SchemaFieldOverride {
    hidden?: boolean;
    label?: string;
    placeholder?: string;
    type?: string;
    entityType?: string;
    options?: Array<{ value: string; label: string }>;
    [key: string]: unknown;
}

export interface SchemaContainerItem {
    id?: string;
    type?: string;
    template?: string;
    title?: string;
    emptyMessage?: string;
    hidden?: boolean;
    customFields?: SchemaCustomField[];
    fieldOverrides?: Record<string, SchemaFieldOverride>;
    [key: string]: unknown;
}

export function useSchemaContainer(props: { item: SchemaContainerItem }) {
    const isDraggedOver = ref(false);
    const rawConfigs = import.meta.glob<Record<string, { default?: { templates?: Record<string, SchemaTemplateConfig> }; templates?: Record<string, SchemaTemplateConfig> }>>(
        '../../../struct/editor/ui_editor.json',
        { eager: true }
    );
    const uiMod = Object.values(rawConfigs)[0];
    const initialConfig = (uiMod && ('default' in uiMod ? uiMod.default : uiMod)) || {};
    const fullConfig = ref<{ templates?: Record<string, SchemaTemplateConfig>; [key: string]: unknown }>(initialConfig as { templates?: Record<string, SchemaTemplateConfig> });



    const availableEntityTypes = computed(() => {
        let rawSchemas: Record<string, { default?: { name?: string; entityType?: string }; name?: string; entityType?: string }>;
        try {
            rawSchemas = import.meta.glob<Record<string, { default?: { name?: string; entityType?: string }; name?: string; entityType?: string }>>('../../../struct/editor/*.json', { eager: true });
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

    const getRawTemplateFields = (templateName?: string): SchemaTemplateField[] => {
        if (!templateName) return [];
        return (fullConfig.value.templates?.[templateName]?.fields as SchemaTemplateField[]) || [];
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

    const isProtectedField = (fieldClass?: string): boolean => {
        if (!fieldClass) return false;
        const normalized = fieldClass.replace(/__b$/, '');
        return ['начальная_глава', 'конечная_глава'].includes(normalized);
    };

    const toggleFieldOverride = (item: SchemaContainerItem, fieldClass: string) => {
        if (isProtectedField(fieldClass)) return;
        if (!item.fieldOverrides) {
            item.fieldOverrides = {};
        }
        const current = item.fieldOverrides[fieldClass] || {};
        const isHidden = !current.hidden;
        item.fieldOverrides = {
            ...item.fieldOverrides,
            [fieldClass]: {
                ...current,
                hidden: isHidden
            }
        };
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

    const isChapterField = (field: { class?: string; id?: string; type?: string; entityType?: string }): boolean => {
        if (field.entityType === 'chapter') return true;
        if (field.type === 'manuscript_point' || field.type === 'chapter') return true;
        const cls = (field.class || field.id || '').toLowerCase();
        return cls.includes('глава') || cls.includes('chapter') || cls === 'начальная_глава' || cls === 'конечная_глава';
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
        isProtectedField,
        addFieldOption,
        isTimeline,
        updateTitle,
        updateEmptyMessage,
        toggleHidden,
        removeCustomField,
        isChapterField
    };
}
