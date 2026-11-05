import { useAvailableEntityTypes } from './hooks/useAvailableEntityTypes';

export interface SchemaFieldItem {
    label?: string;
    hidden?: boolean;
    _val?: unknown;
    type?: string;
    placeholder?: string;
    isSystem?: boolean;
    preventDelete?: boolean;
    preventHide?: boolean;
    optionsSource?: 'custom' | 'entities';
    entityTypes?: string[];
    entityType?: string;
    options?: Array<{ value: string; label: string }>;
    [key: string]: unknown;
}

export function useSchemaFieldEditor(props: { item: SchemaFieldItem }) {
    const { availableTypes, isLoading: isTypesLoading } = useAvailableEntityTypes();

    const typeOptions = [
        { val: 'text', icon: '📝', label: 'Текст' },
        { val: 'textarea', icon: '📄', label: 'Абзац' },
        { val: 'select', icon: '🔽', label: 'Список' },
        { val: 'multiselect', icon: '☑️', label: 'Мультивыбор' },
        { val: 'calendar_date', icon: '📅', label: 'Дата' },
        { val: 'calendar_datetime', icon: '🕒', label: 'Дата и время' },
        { val: 'range', icon: '🎚️', label: 'Шкала (0-100)' },
        { val: 'number', icon: '🔢', label: 'Число' },
        { val: 'tags', icon: '🏷️', label: 'Теги' },
        { val: 'photo', icon: '🖼️', label: 'Фото' }
    ];

    const monthsList = [
        { value: 1, label: 'Январь' }, { value: 2, label: 'Февраль' }, { value: 3, label: 'Март' },
        { value: 4, label: 'Апрель' }, { value: 5, label: 'Май' }, { value: 6, label: 'Июнь' },
        { value: 7, label: 'Июль' }, { value: 8, label: 'Август' }, { value: 9, label: 'Сентябрь' },
        { value: 10, label: 'Октябрь' }, { value: 11, label: 'Ноябрь' }, { value: 12, label: 'Декабрь' }
    ];

    const updateLabel = (val: string) => {
        props.item.label = val;
    };

    const toggleHidden = () => {
        props.item.hidden = !props.item.hidden;
    };

    const updateVal = (val: unknown) => {
        props.item._val = val;
    };

    const setType = (type: string) => {
        props.item.type = type;
    };

    const updatePlaceholder = (val: string) => {
        props.item.placeholder = val;
    };

    const addOption = () => {
        if (!props.item.options) props.item.options = [];
        props.item.options.push({ value: 'Новый вариант', label: 'Новый вариант' });
    };

    const removeOption = (idx: number) => {
        props.item.options?.splice(idx, 1);
    };

    const setOptionsSource = (source: 'custom' | 'entities') => {
        props.item.optionsSource = source;
        if (source === 'entities' && !props.item.entityTypes) {
            props.item.entityTypes = props.item.entityType ? [props.item.entityType] : [];
        }
    };

    const toggleEntityType = (typeKey: string) => {
        if (!Array.isArray(props.item.entityTypes)) {
            props.item.entityTypes = props.item.entityType ? [props.item.entityType] : [];
        }
        const idx = props.item.entityTypes.indexOf(typeKey);
        if (idx >= 0) {
            props.item.entityTypes.splice(idx, 1);
        } else {
            props.item.entityTypes.push(typeKey);
        }
        props.item.entityType = props.item.entityTypes[0] || '';
    };

    const isEntityTypeSelected = (typeKey: string): boolean => {
        return Boolean(
            props.item.entityTypes?.includes(typeKey) || props.item.entityType === typeKey
        );
    };

    return {
        typeOptions,
        monthsList,
        availableTypes,
        isTypesLoading,
        updateLabel,
        toggleHidden,
        updateVal,
        setType,
        updatePlaceholder,
        addOption,
        removeOption,
        setOptionsSource,
        toggleEntityType,
        isEntityTypeSelected
    };
}
