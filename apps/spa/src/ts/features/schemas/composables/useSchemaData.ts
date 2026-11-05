import { ref, computed } from 'vue';
import type { Ref } from 'vue';
import * as api from '@/services/api.client';
import type { EntitySchema } from '@/types/generated/EntitySchema';

export interface SchemaDataSection {
    id: string;
    title: string;
    icon: string;
    items: Array<Record<string, unknown>>;
    dynamicContainers?: Array<Record<string, unknown>>;
    fields?: Array<Record<string, unknown>>;
    [key: string]: unknown;
}

export interface SchemaDataModel {
    name?: string;
    entityType?: string;
    type_key?: string;
    titleField?: string;
    sections: SchemaDataSection[];
    [key: string]: unknown;
}

export function useSchemaData(
    props: { project: string; entityType?: string; initialSection?: string; initialScrollPos?: number; [key: string]: unknown },
    _emit: (event: string, ...args: unknown[]) => void,
    localEntityType: Ref<string>,
    scrollContainer: Ref<HTMLElement | null>
) {
    const schema = ref<SchemaDataModel>({ sections: [] });
    const schemaRecordId = ref<string | null>(null);
    const activeSectionIdx = ref(0);
    const activeSection = computed(() => schema.value.sections[activeSectionIdx.value] || { id: '', title: '', icon: '', items: [] });

    const isPreviewMode = ref(false);
    const showJsonPreview = ref(false);
    const previewKey = ref(0);
    
    const buildCleanSchema = () => {
        const previewSchema = JSON.parse(JSON.stringify(schema.value));
        previewSchema.type_key = localEntityType.value;
        previewSchema.entityType = localEntityType.value;
        previewSchema.name = localEntityType.value;
        if (previewSchema.sections) {
            previewSchema.sections.forEach((sec: Record<string, unknown>) => {
                const items = (sec.items as Array<Record<string, unknown>>) || [];
                const fields: Array<Record<string, unknown>> = [];
                const dynamicContainers: Array<Record<string, unknown>> = [];
                items.forEach(it => {
                    if (it.template || it.dataPath || it.type === 'dynamic' || it.type === 'timeline') {
                        dynamicContainers.push(it);
                    } else {
                        fields.push(it);
                    }
                });
                sec.fields = fields;
                sec.dynamicContainers = dynamicContainers;
            });
        }
        return previewSchema;
    };

    const jsonPreviewContent = computed(() => {
        return JSON.stringify(buildCleanSchema(), null, 2);
    });

    const openPreview = () => {
        sessionStorage.setItem('sandbox_preview_config', jsonPreviewContent.value);
        previewKey.value++;
        isPreviewMode.value = true;
    };

    const exportSchema = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(jsonPreviewContent.value);
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `${localEntityType.value || 'schema'}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    const loadSchema = async (_forceRefetch = false) => {
        try {
            const schemas = await api.getEntitySchemas(props.project);
            const foundSchema = schemas.find((s: EntitySchema) => s.type_key === props.entityType);
            const BUILTIN_SCHEMAS = ['character', 'location', 'organization', 'state', 'item', 'event', 'fraction', 'ui_editor'];
            const createDefaultSchema = (typeKey: string) => ({
                name: typeKey,
                entityType: typeKey,
                titleField: 'название',
                sections: [
                    {
                        id: 'page_main',
                        title: 'Главное',
                        icon: '📄',
                        items: [
                            { type: 'text', class: 'name', path: 'название', label: 'НАЗВАНИЕ', placeholder: '...', _isSystemName: true, required: true }
                        ]
                    }
                ]
            });

            const currentType = props.entityType || 'universal';
            if (foundSchema) {
                schemaRecordId.value = foundSchema.id || null;
            } else {
                schemaRecordId.value = null;
            }

            if (foundSchema && foundSchema.full_schema) {
                schema.value = JSON.parse(JSON.stringify(foundSchema.full_schema));
            } else if (props.entityType && BUILTIN_SCHEMAS.includes(props.entityType)) {
                try {
                    const res = await fetch(`/struct/editor/${props.entityType}.json`);
                    if (res.ok) {
                        schema.value = await res.json();
                    } else {
                        schema.value = createDefaultSchema(currentType);
                    }
                } catch {
                    schema.value = createDefaultSchema(currentType);
                }
            } else {
                schema.value = createDefaultSchema(currentType);
            }

            const displayName = foundSchema?.type_name || schema.value.name || foundSchema?.type_key || currentType;
            schema.value.name = displayName;
            localEntityType.value = displayName;

            // Заполняем items и восстанавливаем id/dataPath для dynamicContainers
            if (schema.value && schema.value.sections) {
                schema.value.sections.forEach((sec: SchemaDataSection) => {
                    if (sec.dynamicContainers) {
                        sec.dynamicContainers.forEach((dc: Record<string, unknown>, idx: number) => {
                            if (!dc.id) dc.id = dc.template ? `dyn_${String(dc.template)}` : `dyn_${idx}`;
                            if (!dc.dataPath) dc.dataPath = dc.id;
                        });
                    }
                    sec.items = [...(sec.fields || []), ...(sec.dynamicContainers || [])];
                });
            }

            if (!schema.value.sections || schema.value.sections.length === 0) {
                schema.value.sections = [
                    {
                        id: 'page_main',
                        title: 'Главное',
                        icon: '📄',
                        items: [
                            { type: 'text', class: 'name', label: 'ИМЯ СУЩНОСТИ', placeholder: 'Введите имя...', _isSystemName: true }
                        ]
                    }
                ];
            }

            // Гарантируем, что в первой секции первое поле является системным именем
            if (schema.value.sections && schema.value.sections.length > 0) {
                const mainSec = schema.value.sections[0];
                if (!mainSec.items) mainSec.items = [];
                if (mainSec.items.length === 0) {
                    mainSec.items.push({
                        type: 'text',
                        class: 'name',
                        path: 'name',
                        label: 'ИМЯ СУЩНОСТИ',
                        placeholder: 'Введите имя...',
                        _isSystemName: true,
                        required: true
                    });
                } else {
                    const nameIdx = mainSec.items.findIndex((it: Record<string, unknown>) =>
                        it.class === 'name' || it._isSystemName || it.isSystem || it.path === 'name' || it.path === schema.value.titleField
                    );
                    if (nameIdx > 0) {
                        const nameItem = mainSec.items.splice(nameIdx, 1)[0];
                        mainSec.items.unshift(nameItem);
                    }
                }
                const first = mainSec.items[0] as Record<string, unknown> | undefined;
                if (first) {
                    first._isSystemName = true;
                }
            }
            if (props.initialSection) {
                const idx = schema.value.sections.findIndex((s: SchemaDataSection) => s.id === props.initialSection);
                activeSectionIdx.value = idx !== -1 ? idx : 0;
            } else {
                activeSectionIdx.value = 0;
            }

            setTimeout(() => {
                if (scrollContainer.value && (props.initialScrollPos ?? 0) > 0) {
                    scrollContainer.value.scrollTop = props.initialScrollPos ?? 0;
                }
            }, 50);

        } catch (e) {
            console.error('Schema loading error:', e);
        }
    };

    const addNewPage = () => {
        schema.value.sections.push({
            id: `page_${Date.now()}`,
            title: `Новая страница`,
            icon: '📄',
            items: [],
            dynamicContainers: []
        });
        activeSectionIdx.value = schema.value.sections.length - 1;
    };

    const deleteSection = async (idx: number) => {
        if (idx === 0) return; // Нельзя удалять первую страницу
        const { appConfirm } = await import('@worldwiki/components');
        if (await appConfirm('Удалить страницу?')) {
            schema.value.sections.splice(idx, 1);
            if (activeSectionIdx.value >= schema.value.sections.length) {
                activeSectionIdx.value = Math.max(0, schema.value.sections.length - 1);
            }
        }
    };

    const removeItem = (idx: number) => {
        if (activeSectionIdx.value === 0 && idx === 0) return; // Защита
        activeSection.value.items.splice(idx, 1);
    };

    return {
        schema,
        schemaRecordId,
        activeSectionIdx,
        activeSection,
        isPreviewMode,
        showJsonPreview,
        previewKey,
        jsonPreviewContent,
        openPreview,
        exportSchema,
        loadSchema,
        addNewPage,
        deleteSection,
        removeItem
    };
}
