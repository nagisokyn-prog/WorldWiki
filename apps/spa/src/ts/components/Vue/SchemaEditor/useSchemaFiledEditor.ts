export function useSchemaFieldEditor(props: any) {
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

    const addOption = () => {
        if (!props.item.options) props.item.options = [];
        props.item.options.push({ value: 'new_val', label: 'Новая опция' });
    };

    const removeOption = (idx: number) => {
        props.item.options.splice(idx, 1);
    };

    return {
        typeOptions,
        monthsList,
        addOption,
        removeOption
    };
}
