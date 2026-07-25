import { ref, shallowRef } from 'vue';
import { apiService } from '../../../../services/api.service';

export function useSchemaHistory(props: any, schema: any, loadSchema: Function) {
    const showHistory = ref(false);
    const schemaHistory = shallowRef<any[]>([]);
    const maxSaves = ref(30);
    const isHistoryPreviewMode = ref(false);
    const historyPreviewId = ref<string | null>(null);

    const loadHistory = async () => {
        try {
            const history = await apiService.getSchemaHistory(props.project, props.entityType) || [];
            schemaHistory.value = history.map((h: any) => ({
                ...h,
                formattedDate: new Date(h.saved_at).toLocaleString()
            }));
        } catch (e) {
            console.error(e);
        }
    };

    const toggleHistoryPanel = async () => {
        showHistory.value = !showHistory.value;
        if (showHistory.value) {
            await loadHistory();
        }
    };

    const togglePin = async (history: any) => {
        try {
            await apiService.toggleSchemaHistoryPin(history.id, !history.is_pinned);
            history.is_pinned = !history.is_pinned;
        } catch (e) {
            console.error(e);
        }
    };

    const previewHistory = (history: any) => {
        isHistoryPreviewMode.value = true;
        historyPreviewId.value = history.id;
        const data = history.snapshot;
        if (data.full_schema) {
            schema.value = JSON.parse(JSON.stringify(data.full_schema));
            if (!schema.value.sections) schema.value.sections = [];
            schema.value.sections.forEach((sec: any) => {
                sec.items = [
                    ...(sec.fields || []).map((f: any) => ({ ...f, _isAtomic: true })),
                    ...(sec.dynamicContainers || []).map((c: any) => ({ ...c, _isAtomic: false }))
                ];
            });
        }
    };

    const exitPreviewMode = () => {
        isHistoryPreviewMode.value = false;
        historyPreviewId.value = null;
        loadSchema(false);
    };

    return {
        showHistory,
        schemaHistory,
        maxSaves,
        isHistoryPreviewMode,
        historyPreviewId,
        loadHistory,
        toggleHistoryPanel,
        togglePin,
        previewHistory,
        exitPreviewMode
    };
}
