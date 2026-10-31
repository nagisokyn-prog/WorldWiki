import { ref, computed, watch, nextTick } from 'vue';
import * as api from '@/services/api.client';
import { projectRecordId } from '@/services/api/project.api';

export interface PlanItem {
    id: string;
    text: string;
    done: boolean;
    sort_order?: number;
    indent: number;
}

export interface PlanningPanelProps {
    project: string;
    parentType?: string;
    parentId?: string;
    parentTitle?: string;
}

export function usePlanningPanel(props: PlanningPanelProps) {
    const items = ref<PlanItem[]>([]);
    const listEl = ref<HTMLElement | null>(null);
    const saving = ref(false);

    // ─── Computed ────────────────────────────────────────────
    const normalizedParentType = computed(() => {
        if (!props.parentType) return '';
        return props.parentType === 'arc' ? 'story_arc' : props.parentType;
    });

    const nodeIcon = computed(() => {
        if (props.parentType === 'volume') return '📚';
        if (props.parentType === 'arc' || props.parentType === 'story_arc') return '🌀';
        return '📖';
    });

    const nodeName = computed(() => props.parentTitle || 'Без названия');

    const doneCount = computed(() => items.value.filter(i => i.done).length);
    const progressPct = computed(() =>
        items.value.length ? Math.round((doneCount.value / items.value.length) * 100) : 0
    );

    // ─── Load ────────────────────────────────────────────────
    const load = async () => {
        if (!props.parentId) {
            items.value = [];
            return;
        }
        try {
            const todos = await api.getTodos(props.parentId);
            items.value = (todos || [])
                .map(t => ({
                    id: t.id || '',
                    text: t.text || '',
                    done: !!t.is_done,
                    sort_order: Number(t.sort_order),
                    indent: 0,
                }))
                .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
        } catch (e) {
            console.error('Ошибка загрузки задач:', e);
            items.value = [];
        }
    };

    watch(() => [props.project, props.parentType, props.parentId], load, { immediate: true });

    // ─── Save ────────────────────────────────────────────────
    const saveItem = async (item: PlanItem) => {
        if (!item.text.trim() && !item.id) return; // пропускаем совсем пустые несохранённые
        if (!props.parentId) return;
        try {
            if (!item.id) {
                const createdId = await api.createTodo(
                    props.parentId,
                    item.text,
                    item.sort_order ?? items.value.indexOf(item)
                );
                item.id = createdId;
            }
        } catch (e) {
            console.error('Ошибка сохранения задачи:', e);
        }
    };

    // ─── Toggle ──────────────────────────────────────────────
    const toggleItem = async (item: PlanItem) => {
        item.done = !item.done;
        try {
            if (item.id) {
                await api.toggleTodo(item.id);
            } else {
                await saveItem(item);
            }
        } catch (e) {
            item.done = !item.done; // откат
            console.error('Ошибка переключения статуса задачи:', e);
        }
    };

    // ─── Add ─────────────────────────────────────────────────
    const addItem = async () => {
        const newItem: PlanItem = {
            id: '',
            text: '',
            done: false,
            indent: 0,
            sort_order: items.value.length,
        };
        items.value.push(newItem);
        await nextTick();
        const inputs = listEl.value?.querySelectorAll<HTMLInputElement>('.plan-text');
        if (inputs?.length) inputs[inputs.length - 1].focus();
    };

    const addItemAfter = async (idx: number, indent: number) => {
        const newItem: PlanItem = {
            id: '',
            text: '',
            done: false,
            indent: indent,
            sort_order: idx + 1,
        };
        if (items.value[idx]) await saveItem(items.value[idx]);

        items.value.splice(idx + 1, 0, newItem);
        items.value.forEach((it, i) => { it.sort_order = i; });

        await nextTick();
        const inputs = listEl.value?.querySelectorAll<HTMLInputElement>('.plan-text');
        if (inputs?.[idx + 1]) inputs[idx + 1].focus();
    };

    // ─── Indent ──────────────────────────────────────────────
    const indentItem = async (item: PlanItem, delta: number) => {
        item.indent = Math.max(0, Math.min(4, (item.indent || 0) + delta));
        await saveItem(item);
    };

    // ─── Delete ──────────────────────────────────────────────
    const deleteItem = async (item: PlanItem, idx: number) => {
        items.value.splice(idx, 1);
        if (item.id) {
            try {
                await api.deleteTodo(item.id);
            } catch (err) {
                console.warn('[usePlanningPanel] Failed to delete todo item:', err);
            }
        }
        items.value.forEach((it, i) => { it.sort_order = i; });
    };

    const onDeleteKey = async (e: KeyboardEvent, item: PlanItem, idx: number) => {
        if (item.text === '' && e.key === 'Backspace') {
            e.preventDefault();
            await deleteItem(item, idx);
            await nextTick();
            const inputs = listEl.value?.querySelectorAll<HTMLInputElement>('.plan-text');
            if (inputs?.[idx - 1]) inputs[idx - 1].focus();
        }
    };

    return {
        items,
        listEl,
        saving,
        nodeIcon,
        nodeName,
        doneCount,
        progressPct,
        load,
        saveItem,
        toggleItem,
        addItem,
        addItemAfter,
        indentItem,
        deleteItem,
        onDeleteKey
    };
}
