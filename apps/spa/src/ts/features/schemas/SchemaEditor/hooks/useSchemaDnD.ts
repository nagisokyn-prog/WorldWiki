import { ref } from 'vue';
import type { Ref } from 'vue';

export interface DraggedItemInfo {
    source: 'palette' | 'canvas';
    kind?: string;
    val?: string;
    label?: string;
    idx?: number;
    template?: string;
}

export interface SchemaSectionItem {
    type?: string;
    class?: string;
    label?: string;
    placeholder?: string;
    id?: string;
    dataPath?: string;
    template?: string;
    title?: string;
    emptyMessage?: string;
    customFields?: Array<Record<string, unknown>>;
    [key: string]: unknown;
}

export interface SchemaSection {
    items: SchemaSectionItem[];
    [key: string]: unknown;
}

export function useSchemaDnD(activeSection: Ref<SchemaSection>, activeSectionIdx: Ref<number>) {
    const draggedOverIdx = ref(-1);
    let draggedItemInfo: DraggedItemInfo | null = null;

    const handleDragStartPalette = (e: DragEvent, kind: string, val: string, label: string, template?: string) => {
        draggedItemInfo = { source: 'palette', kind, val, label, template: template || val };
        if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'copy';
            e.dataTransfer.setData('text/plain', kind);
        }
    };

    const handleItemDragStart = (e: DragEvent, idx: number) => {
        if (activeSectionIdx.value === 0 && idx === 0) {
            e.preventDefault();
            return;
        }
        draggedItemInfo = { source: 'canvas', idx };
        if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', 'canvasItem');
        }
    };

    const handleDragOverCanvas = (e: DragEvent) => {
        if (e.dataTransfer) e.dataTransfer.dropEffect = draggedItemInfo?.source === 'palette' ? 'copy' : 'move';
    };

    const handleDropNew = (_e: DragEvent) => {
        draggedOverIdx.value = -1;
        if (!draggedItemInfo) return;
        if (!activeSection.value.items) activeSection.value.items = [];
        if (draggedItemInfo.source === 'palette' && draggedItemInfo.kind === 'atomic') {
            activeSection.value.items.push({
                type: draggedItemInfo.val,
                class: `field_${Date.now()}`,
                label: (draggedItemInfo.label || '').toUpperCase(),
                placeholder: '...'
            });
        } else if (draggedItemInfo.source === 'palette' && draggedItemInfo.kind === 'module') {
            const modId = `module_${Date.now()}`;
            activeSection.value.items.push({
                id: modId,
                dataPath: modId,
                type: draggedItemInfo.template?.includes('timeline') ? 'timeline' : 'dynamic',
                template: draggedItemInfo.val,
                title: 'НОВЫЙ МОДУЛЬ',
                emptyMessage: 'Пусто...',
                customFields: []
            });
        }
        draggedItemInfo = null;
    };

    const handleItemDrop = (targetIdx: number) => {
        draggedOverIdx.value = -1;
        if (!draggedItemInfo) return;
        if (targetIdx === 0 && activeSectionIdx.value === 0) {
            targetIdx = 1;
        }
        if (!activeSection.value.items) activeSection.value.items = [];

        if (draggedItemInfo.source === 'canvas') {
            const srcIdx = draggedItemInfo.idx ?? -1;
            if (srcIdx === targetIdx || srcIdx < 0) return;
            const item = activeSection.value.items.splice(srcIdx, 1)[0];
            const insertIdx = srcIdx < targetIdx ? targetIdx : targetIdx;
            activeSection.value.items.splice(insertIdx, 0, item);
        } else if (draggedItemInfo.source === 'palette') {
            if (draggedItemInfo.kind === 'atomic') {
                activeSection.value.items.splice(targetIdx, 0, {
                    type: draggedItemInfo.val,
                    class: `field_${Date.now()}`,
                    label: (draggedItemInfo.label || '').toUpperCase(),
                    placeholder: '...'
                });
            } else if (draggedItemInfo.kind === 'module') {
                const modId = `module_${Date.now()}`;
                activeSection.value.items.splice(targetIdx, 0, {
                    id: modId,
                    dataPath: modId,
                    type: draggedItemInfo.template?.includes('timeline') ? 'timeline' : 'dynamic',
                    template: draggedItemInfo.val,
                    title: 'НОВЫЙ МОДУЛЬ',
                    emptyMessage: 'Пусто...',
                    customFields: []
                });
            }
        }
        draggedItemInfo = null;
    };

    const handleDropIntoModule = (moduleIdx: number) => {
        if (!draggedItemInfo) return;
        if (draggedItemInfo.source === 'palette' && draggedItemInfo.kind === 'atomic') {
            const mod = activeSection.value.items[moduleIdx];
            if (mod) {
                if (!mod.customFields) mod.customFields = [];
                mod.customFields.push({
                    type: draggedItemInfo.val,
                    class: `custom_${Date.now()}`,
                    label: (draggedItemInfo.label || '').toUpperCase(),
                    placeholder: '...',
                    sourceType: '',
                    targetType: ''
                });
            }
        }
        draggedItemInfo = null;
    };

    return {
        draggedOverIdx,
        handleDragStartPalette,
        handleItemDragStart,
        handleDragOverCanvas,
        handleDropNew,
        handleItemDrop,
        handleDropIntoModule
    };
}
