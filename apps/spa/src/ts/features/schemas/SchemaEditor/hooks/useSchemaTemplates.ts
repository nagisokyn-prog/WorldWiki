import { computed } from 'vue';
import uiEditorData from '../../../../../../public/struct/editor/ui_editor.json';

export function useSchemaTemplates() {
    const atomicBricks = [
        { val: 'text', icon: '📝', label: 'Текст' },
        { val: 'textarea', icon: '📄', label: 'Абзац' },
        { val: 'select', icon: '🔽', label: 'Список' },
        { val: 'multiselect', icon: '☑️', label: 'Мульти' },
        { val: 'calendar_date', icon: '📅', label: 'Дата' },
        { val: 'calendar_datetime', icon: '🕒', label: 'Дата и время' },
        { val: 'range', icon: '🎚️', label: 'Шкала' },
        { val: 'number', icon: '🔢', label: 'Число' },
        { val: 'tags', icon: '🏷️', label: 'Теги' },
        { val: 'photo', icon: '🖼️', label: 'Фото' }
    ];

    const HELPER_TEMPLATES = ['dynamicEndDateTemplate', 'dynamicDisbandDateTemplate', 'dynamicAbolitionDateTemplate', 'stateCollapseDateTemplate'];

    const timelineTemplates = computed(() => {
        const all = uiEditorData.templates || {} as any;
        const result: Record<string, any> = {};
        Object.entries(all).forEach(([key, tpl]: [string, any]) => {
            if (HELPER_TEMPLATES.includes(key)) return;
            if (tpl.type === 'timeline') result[key] = tpl;
        });
        return result;
    });

    const dynamicTemplates = computed(() => {
        const all = uiEditorData.templates || {} as any;
        const result: Record<string, any> = {};
        Object.entries(all).forEach(([key, tpl]: [string, any]) => {
            if (HELPER_TEMPLATES.includes(key)) return;
            if (tpl.type === 'dynamic') result[key] = tpl;
        });
        return result;
    });

    const isAtomicField = (item: any) => {
        return atomicBricks.some(b => b.val === item.type) || item.type === 'tags' || item.type === 'range';
    };

    return {
        atomicBricks,
        timelineTemplates,
        dynamicTemplates,
        isAtomicField
    };
}
