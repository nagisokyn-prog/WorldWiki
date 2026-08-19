import { ref, shallowRef } from 'vue';
import type { Ref } from 'vue';
import * as api from '../../../../services/api.client';

export interface SchemaHistoryRecord {
    id: string;
    saved_at: string;
    is_pinned: boolean;
    formattedDate?: string;
    snapshot?: {
        full_schema?: {
            sections?: Array<{
                fields?: Array<Record<string, unknown>>;
                dynamicContainers?: Array<Record<string, unknown>>;
                items?: Array<Record<string, unknown>>;
                [key: string]: unknown;
            }>;
            [key: string]: unknown;
        };
        [key: string]: unknown;
    };
    [key: string]: unknown;
}

export interface SchemaObject {
    sections?: Array<{
        fields?: Array<Record<string, unknown>>;
        dynamicContainers?: Array<Record<string, unknown>>;
        items?: Array<Record<string, unknown>>;
        [key: string]: unknown;
    }>;
    [key: string]: unknown;
}

export function useSchemaHistory(
    props: { project: string; entityType?: string; [key: string]: unknown },
    schema: Ref<SchemaObject>,
    loadSchema: (checkHistory?: boolean) => void | Promise<void>
) {
    const showHistory = ref(false);
    const schemaHistory = shallowRef<SchemaHistoryRecord[]>([]);
    const maxSaves = ref(30);
    const isHistoryPreviewMode = ref(false);
    const historyPreviewId = ref<string | null>(null);

    const loadHistory = async () => {
        try {
            const history = await api.getSchemaHistory(props.project, props.entityType || '') || [];
            schemaHistory.value = (history as unknown as SchemaHistoryRecord[]).map((h: SchemaHistoryRecord) => ({
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

    const togglePin = async (history: SchemaHistoryRecord) => {
        try {
            await api.toggleSchemaHistoryPin(history.id, !history.is_pinned);
            history.is_pinned = !history.is_pinned;
        } catch (e) {
            console.error(e);
        }
    };

    const previewHistory = (history: SchemaHistoryRecord) => {
        isHistoryPreviewMode.value = true;
        historyPreviewId.value = history.id;
        const data = history.snapshot;
        if (data?.full_schema) {
            schema.value = JSON.parse(JSON.stringify(data.full_schema));
            if (!schema.value.sections) schema.value.sections = [];
            schema.value.sections.forEach((sec) => {
                sec.items = [
                    ...(sec.fields || []).map((f) => ({ ...f, _isAtomic: true })),
                    ...(sec.dynamicContainers || []).map((c) => ({ ...c, _isAtomic: false }))
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
