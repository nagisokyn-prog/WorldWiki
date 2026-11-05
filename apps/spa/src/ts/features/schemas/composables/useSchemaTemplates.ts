import { ref, computed, onMounted } from 'vue';

export interface SchemaTemplateItem {
    type?: string;
    fields?: unknown[];
    [key: string]: unknown;
}

const templatesCache = ref<Record<string, SchemaTemplateItem>>({});
let isFetchingTemplates = false;

async function ensureTemplatesLoaded() {
    if (Object.keys(templatesCache.value).length > 0 || isFetchingTemplates) return;
    isFetchingTemplates = true;
    try {
        const res = await fetch('/struct/editor/ui_editor.json');
        if (res.ok) {
            const data = await res.json() as { templates?: Record<string, SchemaTemplateItem> };
            if (data.templates) {
                templatesCache.value = data.templates;
            }
        }
    } catch (e) {
        console.warn('Failed to load ui_editor.json templates:', e);
    } finally {
        isFetchingTemplates = false;
    }
}

export function useSchemaTemplates() {
    onMounted(() => {
        void ensureTemplatesLoaded();
    });

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

    const ALLOWED_TIMELINE_KEYS = ['Базовая хронология'];
    const ALLOWED_DYNAMIC_KEYS = ['Динамический элемент', 'Двунаправленная связь', 'Одиночный параметр'];

    const timelineTemplates = computed<Record<string, SchemaTemplateItem>>(() => {
        const all = templatesCache.value;
        const result: Record<string, SchemaTemplateItem> = {};
        for (const key of ALLOWED_TIMELINE_KEYS) {
            if (all[key]) {
                result[key] = all[key];
            }
        }
        return result;
    });

    const dynamicTemplates = computed<Record<string, SchemaTemplateItem>>(() => {
        const all = templatesCache.value;
        const result: Record<string, SchemaTemplateItem> = {};
        for (const key of ALLOWED_DYNAMIC_KEYS) {
            if (all[key]) {
                result[key] = all[key];
            }
        }
        return result;
    });


    const isAtomicField = (item: { type?: string } | null | undefined) => {
        if (!item) return false;
        return atomicBricks.some(b => b.val === item.type) || item.type === 'tags' || item.type === 'range';
    };

    return {
        atomicBricks,
        timelineTemplates,
        dynamicTemplates,
        isAtomicField
    };
}
