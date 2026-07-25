import { ref, computed, watch, nextTick } from 'vue';
import { apiService } from '../../../../services/api.service';

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
            items.value = await apiService.getPlanItems(props.project, props.parentType, props.parentId);
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
            const id = await apiService.savePlanItem(props.project, {
                id: item.id,
                parentType: props.parentType,
                parentId: props.parentId,
                text: item.text,
                done: item.done,
                indent: item.indent,
                sortOrder: item.sortOrder ?? items.value.indexOf(item),
            });
            if (!item.id) item.id = id;
        } catch (e) {
            console.error('Ошибка сохранения пункта:', e);
        }
    };

    // ─── Toggle ──────────────────────────────────────────────
    const toggleItem = async (item: any) => {
        item.done = !item.done;
        try {
            if (item.id) {
                await apiService.togglePlanItem(props.project, item.id);
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
            sortOrder: items.value.length,
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
            sortOrder: idx + 1,
        };
        if (items.value[idx]) await saveItem(items.value[idx]);

        items.value.splice(idx + 1, 0, newItem);
        items.value.forEach((it, i) => { it.sortOrder = i; });

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
            try { await apiService.deletePlanItem(props.project, item.id); } catch { }
        }
        items.value.forEach((it, i) => { it.sortOrder = i; });
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
