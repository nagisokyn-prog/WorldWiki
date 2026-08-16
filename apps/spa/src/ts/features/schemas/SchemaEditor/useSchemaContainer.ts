import { computed, ref } from 'vue';
import uiEditorData from '../../../../../public/struct/editor/ui_editor.json';

export function useSchemaContainer(props: any) {
    const isDraggedOver = ref(false);
    const fullConfig = ref<any>(uiEditorData);

    const availableEntityTypes = computed(() => {
        const rawSchemas = (import.meta as any).glob('../../../../../public/struct/editor/*.json', { eager: true });
        const types = [];
        for (const path in rawSchemas) {
            if (path.includes('ui_editor')) continue;
            const data = (rawSchemas[path] as any).default || rawSchemas[path];
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

    const ensureFieldOverride = (item: any, fieldClass: string) => {
        if (!item.fieldOverrides) item.fieldOverrides = {};
        if (!item.fieldOverrides[fieldClass]) {
            item.fieldOverrides[fieldClass] = {};
        }
        return item.fieldOverrides[fieldClass];
    };

    const getFieldOverride = (item: any, fieldClass: string) => {
        return item.fieldOverrides?.[fieldClass] || {};
    };

    const toggleFieldOverride = (item: any, fieldClass: string) => {
        const override = ensureFieldOverride(item, fieldClass);
        override.hidden = !override.hidden;
    };

    const addFieldOption = (item: any, fieldClass: string) => {
        const override = ensureFieldOverride(item, fieldClass);
        if (!override.options) override.options = [];
        override.options.push({ value: 'new_val', label: 'Новый вариант' });
    };

    const isTimeline = computed(() => {
        return props.item.template && (props.item.template.includes('timeline') || props.item.template.includes('events'));
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

    const removeCustomField = (idx: number) => {
        if (props.item.customFields) {
            props.item.customFields.splice(idx, 1);
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
