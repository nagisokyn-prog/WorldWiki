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
    let lastDropTimestamp = 0;

    const isDuplicateDrop = (): boolean => {
        const now = Date.now();
        if (now - lastDropTimestamp < 100) {
            return true;
        }
        lastDropTimestamp = now;
        return false;
    };

    const getDraggedInfo = (e?: DragEvent): DraggedItemInfo | null => {
        if (draggedItemInfo) {
            const info = draggedItemInfo;
            draggedItemInfo = null;
            return info;
        }
        if (e?.dataTransfer) {
            try {
                const raw = e.dataTransfer.getData('application/json');
                if (raw) return JSON.parse(raw);
            } catch (err) {
                console.warn('[useSchemaDnD] Failed to parse drag payload JSON:', err);
            }
        }
        return null;
    };

    const handleDragStartPalette = (e: DragEvent, kind: string, val: string, label: string, template?: string) => {
        lastDropTimestamp = 0;
        draggedItemInfo = { source: 'palette', kind, val, label, template: template || val };
        if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'copy';
            e.dataTransfer.setData('text/plain', kind);
            try {
                e.dataTransfer.setData('application/json', JSON.stringify(draggedItemInfo));
            } catch (err) {
                console.warn('[useSchemaDnD] Failed to serialize palette drag data:', err);
            }
        }
    };

    const handleItemDragStart = (e: DragEvent, idx: number) => {
        if (activeSectionIdx.value === 0 && idx === 0) {
            if (e?.preventDefault) e.preventDefault();
            return;
        }
        lastDropTimestamp = 0;
        draggedItemInfo = { source: 'canvas', idx };
        if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', 'canvasItem');
            try {
                e.dataTransfer.setData('application/json', JSON.stringify(draggedItemInfo));
            } catch (err) {
                console.warn('[useSchemaDnD] Failed to serialize canvas drag data:', err);
            }
        }
    };

    const handleDragOverCanvas = (e: DragEvent) => {
        if (e?.preventDefault) e.preventDefault();
        if (e.dataTransfer) {
            e.dataTransfer.dropEffect = draggedItemInfo?.source === 'palette' ? 'copy' : 'move';
        }
    };

    const handleDropNew = (e?: DragEvent) => {
        if (e?.preventDefault) e.preventDefault();
        draggedOverIdx.value = -1;
        if (isDuplicateDrop()) return;
        const info = getDraggedInfo(e);
        if (!info) return;
        if (!activeSection.value.items) activeSection.value.items = [];

        if (info.source === 'palette' && info.kind === 'atomic') {
            activeSection.value.items.push({
                type: info.val,
                class: `field_${Date.now()}`,
                label: (info.label || '').toUpperCase(),
                placeholder: '...'
            });
        } else if (info.source === 'palette' && info.kind === 'module') {
            const modId = `module_${Date.now()}`;
            activeSection.value.items.push({
                id: modId,
                dataPath: modId,
                type: info.template?.includes('timeline') ? 'timeline' : 'dynamic',
                template: info.val,
                title: 'НОВЫЙ МОДУЛЬ',
                emptyMessage: 'Пусто...',
                customFields: []
            });
        } else if (info.source === 'canvas') {
            const srcIdx = info.idx ?? -1;
            if (srcIdx >= 0 && srcIdx < activeSection.value.items.length) {
                const item = activeSection.value.items.splice(srcIdx, 1)[0];
                activeSection.value.items.push(item);
            }
        }
        draggedItemInfo = null;
    };

    const handleItemDrop = (targetIdx: number, e?: DragEvent) => {
        if (e?.preventDefault) e.preventDefault();
        draggedOverIdx.value = -1;
        if (isDuplicateDrop()) return;
        const info = getDraggedInfo(e);
        if (!info) return;
        if (targetIdx === 0 && activeSectionIdx.value === 0) {
            targetIdx = 1;
        }
        if (!activeSection.value.items) activeSection.value.items = [];

        if (info.source === 'canvas') {
            const srcIdx = info.idx ?? -1;
            if (srcIdx === targetIdx || srcIdx < 0 || srcIdx >= activeSection.value.items.length) return;
            const item = activeSection.value.items.splice(srcIdx, 1)[0];
            activeSection.value.items.splice(targetIdx, 0, item);
        } else if (info.source === 'palette') {
            if (info.kind === 'atomic') {
                activeSection.value.items.splice(targetIdx, 0, {
                    type: info.val,
                    class: `field_${Date.now()}`,
                    label: (info.label || '').toUpperCase(),
                    placeholder: '...'
                });
            } else if (info.kind === 'module') {
                const modId = `module_${Date.now()}`;
                activeSection.value.items.splice(targetIdx, 0, {
                    id: modId,
                    dataPath: modId,
                    type: info.template?.includes('timeline') ? 'timeline' : 'dynamic',
                    template: info.val,
                    title: 'НОВЫЙ МОДУЛЬ',
                    emptyMessage: 'Пусто...',
                    customFields: []
                });
            }
        }
        draggedItemInfo = null;
    };

    const handleDropIntoModule = (moduleIdx: number, e?: DragEvent) => {
        if (e?.preventDefault) e.preventDefault();
        const info = getDraggedInfo(e);
        if (!info) return;
        if (info.source === 'palette' && info.kind === 'atomic') {
            const mod = activeSection.value.items[moduleIdx];
            if (mod) {
                if (!mod.customFields) mod.customFields = [];
                (mod.customFields as Array<Record<string, unknown>>).push({
                    type: info.val,
                    class: `custom_${Date.now()}`,
                    label: (info.label || '').toUpperCase(),
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
