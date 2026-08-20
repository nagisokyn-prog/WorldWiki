import { ref } from 'vue';

export interface ExportChapterItem {
    id?: string;
    title?: string | null;
    [key: string]: unknown;
}

export interface ExportPayload {
    format: string;
    chapterIds: string[];
    options: {
        addTOC: boolean;
        addPageNumbers: boolean;
        includeMetadata: boolean;
    };
}

export interface ExportModalProps {
    isOpen: boolean;
    allChapters?: ExportChapterItem[];
    currentChapterId?: string | null;
}

export function useExportModal(
    props: ExportModalProps,
    emit: (event: 'close' | 'export', ...args: unknown[]) => void
) {
    const format = ref('txt');
    const selectionMode = ref('current');
    const selectedChapters = ref<string[]>([]);
    const addTOC = ref(true);
    const addPageNumbers = ref(true);
    const includeMetadata = ref(true);
    const loading = ref(false);

    const selectAll = () => {
        selectedChapters.value = (props.allChapters || []).map((c) => String(c.id || '')).filter(Boolean);
    };

    const clearSelection = () => {
        selectedChapters.value = [];
    };

    const exportData = async () => {
        let targets: string[];
        if (selectionMode.value === 'current' && props.currentChapterId) {
            targets = [props.currentChapterId];
        } else if (selectionMode.value === 'all') {
            targets = (props.allChapters || []).map((c) => String(c.id || '')).filter(Boolean);
        } else {
            targets = [...selectedChapters.value];
        }

        const { appAlert } = await import('@worldwiki/components');
        if (targets.length === 0) {
            appAlert('Не выбраны главы для экспорта');
            return;
        }

        loading.value = true;
        const payload: ExportPayload = {
            format: format.value,
            chapterIds: targets,
            options: {
                addTOC: addTOC.value,
                addPageNumbers: addPageNumbers.value,
                includeMetadata: includeMetadata.value
            }
        };
        emit('export', payload);

        setTimeout(() => {
            loading.value = false;
            emit('close');
        }, 1000); // Simulate export time
    };

    return {
        format,
        selectionMode,
        selectedChapters,
        addTOC,
        addPageNumbers,
        includeMetadata,
        loading,
        selectAll,
        clearSelection,
        exportData
    };
}
