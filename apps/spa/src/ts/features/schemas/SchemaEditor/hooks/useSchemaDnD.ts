import { ref } from 'vue';

export function useSchemaDnD(activeSection: any, activeSectionIdx: any) {
    const draggedOverIdx = ref(-1);
    let draggedItemInfo: any = null;

    const handleDragStartPalette = (e: DragEvent, kind: string, val: string, label: string) => {
        draggedItemInfo = { source: 'palette', kind, val, label };
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

    const handleDropNew = (e: DragEvent) => {
        draggedOverIdx.value = -1;
        if (!draggedItemInfo) return;
        if (draggedItemInfo.source === 'palette' && draggedItemInfo.kind === 'atomic') {
            activeSection.value.items.push({
                type: draggedItemInfo.val,
                class: `field_${Date.now()}`,
                label: draggedItemInfo.label.toUpperCase(),
                placeholder: '...'
            });
        } else if (draggedItemInfo.source === 'palette' && draggedItemInfo.kind === 'module') {
            activeSection.value.items.push({
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
        if (targetIdx === 0 && activeSectionIdx.value === 0) return;

        if (draggedItemInfo.source === 'canvas') {
            const srcIdx = draggedItemInfo.idx;
            if (srcIdx === targetIdx) return;
            const item = activeSection.value.items.splice(srcIdx, 1)[0];
            const insertIdx = srcIdx < targetIdx ? targetIdx : targetIdx;
            activeSection.value.items.splice(insertIdx, 0, item);
        } else if (draggedItemInfo.source === 'palette') {
            if (draggedItemInfo.kind === 'atomic') {
                activeSection.value.items.splice(targetIdx, 0, {
                    type: draggedItemInfo.val,
                    class: `field_${Date.now()}`,
                    label: draggedItemInfo.label.toUpperCase(),
                    placeholder: '...'
                });
            } else if (draggedItemInfo.kind === 'module') {
                activeSection.value.items.splice(targetIdx, 0, {
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
            if (!mod.customFields) mod.customFields = [];
            mod.customFields.push({
                type: draggedItemInfo.val,
                class: `custom_${Date.now()}`,
                label: draggedItemInfo.label.toUpperCase(),
                placeholder: '...',
                sourceType: '',
                targetType: ''
            });
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
