import { ref } from 'vue';

export function useExportModal(props: any, emit: any) {
    const format = ref('txt');
    const selectionMode = ref('current');
    const selectedChapters = ref<string[]>([]);
    const addTOC = ref(true);
    const addPageNumbers = ref(true);
    const includeMetadata = ref(true);
    const loading = ref(false);

    const selectAll = () => {
        selectedChapters.value = props.allChapters.map((c: any) => c.id);
    };

    const clearSelection = () => {
        selectedChapters.value = [];
    };

    const exportData = () => {
        let targets: string[] = [];
        if (selectionMode.value === 'current' && props.currentChapterId) {
            targets = [props.currentChapterId];
        } else if (selectionMode.value === 'all') {
            targets = props.allChapters.map((c: any) => c.id);
        } else {
            targets = [...selectedChapters.value];
        }

        if (targets.length === 0) {
            alert('Не выбраны главы для экспорта');
            return;
        }

        loading.value = true;
        emit('export', {
            format: format.value,
            chapterIds: targets,
            options: {
                addTOC: addTOC.value,
                addPageNumbers: addPageNumbers.value,
                includeMetadata: includeMetadata.value
            }
        });

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
