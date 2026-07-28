import { ref, computed, watch, nextTick } from 'vue';
import * as api from '../../../services/api.client';;

export function usePlanningPanel(props: any) {
    const items = ref<any[]>([]);
    const listEl = ref<any>(null);
    const saving = ref(false);

    // ─── Computed ────────────────────────────────────────────
    const nodeIcon = computed(() => {
        if (props.parentType === 'volume') return '📚';
        if (props.parentType === 'arc') return '🌀';
        return '📖';
    });

    const nodeName = computed(() => props.parentTitle || 'Без названия');

    const doneCount = computed(() => items.value.filter(i => i.done).length);
    const progressPct = computed(() =>
        items.value.length ? Math.round((doneCount.value / items.value.length) * 100) : 0
    );

    // ─── Load ────────────────────────────────────────────────
    const load = async () => {
        if (!props.project || !props.parentType || !props.parentId) {
            items.value = [];
            return;
        }
        try {
            items.value = await api.getPlans(props.project).then(plans => plans.filter(p => p.parent_type === props.parentType && p.parent_ref === props.parentId));
        } catch (e) {
            console.error('Ошибка загрузки плана:', e);
            items.value = [];
        }
    };

    watch(() => [props.project, props.parentType, props.parentId], load, { immediate: true });

    // ─── Save ────────────────────────────────────────────────
    const saveItem = async (item: any) => {
        if (!item.text.trim() && !item.id) return; // пропускаем совсем пустые несохранённые
        try {
            const planToSave: any = {
                id: item.id || null,
                project_id: props.project,
                parent_type: props.parentType,
                parent_ref: props.parentId,
                title: item.text,
                completed: item.done,
                sort_order: item.sort_order ?? items.value.indexOf(item)
            };
            const savedPlan = await api.savePlan(planToSave);
            if (!item.id && savedPlan.id) item.id = savedPlan.id;
        } catch (e) {
            console.error('Ошибка сохранения пункта:', e);
        }
    };

    // ─── Toggle ──────────────────────────────────────────────
    const toggleItem = async (item: any) => {
        item.done = !item.done;
        try {
            if (item.id) {
                await api.getPlans(props.project).then(async plans => { const p = plans.find(x => x.id === item.id); if (p) { p.completed = !p.completed; await api.savePlan(p); } });
            } else {
                await saveItem(item);
            }
        } catch (e) {
            item.done = !item.done; // откат
            console.error('Ошибка переключения статуса:', e);
        }
    };

    // ─── Add ─────────────────────────────────────────────────
    const addItem = async () => {
        const newItem = {
            id: '',
            text: '',
            done: false,
            indent: 0,
            sort_order: items.value.length,
        };
        items.value.push(newItem);
        await nextTick();
        const inputs = listEl.value?.querySelectorAll('.plan-text');
        if (inputs?.length) inputs[inputs.length - 1].focus();
    };

    const addItemAfter = async (idx: number, indent: number) => {
        const newItem = {
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
        const inputs = listEl.value?.querySelectorAll('.plan-text');
        if (inputs?.[idx + 1]) inputs[idx + 1].focus();
    };

    // ─── Indent ──────────────────────────────────────────────
    const indentItem = async (item: any, delta: number) => {
        item.indent = Math.max(0, Math.min(4, (item.indent || 0) + delta));
        await saveItem(item);
    };

    // ─── Delete ──────────────────────────────────────────────
    const deleteItem = async (item: any, idx: number) => {
        items.value.splice(idx, 1);
        if (item.id) {
            try { await api.deletePlan(item.id); } catch { }
        }
        items.value.forEach((it, i) => { it.sort_order = i; });
    };

    const onDeleteKey = async (e: any, item: any, idx: number) => {
        if (item.text === '' && e.key === 'Backspace') {
            e.preventDefault();
            await deleteItem(item, idx);
            await nextTick();
            const inputs = listEl.value?.querySelectorAll('.plan-text');
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
