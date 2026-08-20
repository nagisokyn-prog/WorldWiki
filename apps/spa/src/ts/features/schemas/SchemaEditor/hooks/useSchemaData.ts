import { ref, computed } from 'vue';
import type { Ref } from 'vue';
import * as api from '../../../../services/api.client';
import type { EntitySchema } from '../../../../types/generated/EntitySchema';

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
    const activeSectionIdx = ref(0);
    const activeSection = computed(() => schema.value.sections[activeSectionIdx.value] || { id: '', title: '', icon: '', items: [] });

    const isPreviewMode = ref(false);
    const showJsonPreview = ref(false);
    const previewKey = ref(0);
    
    const jsonPreviewContent = computed(() => {
        const previewSchema = JSON.parse(JSON.stringify(schema.value));
        previewSchema.type_key = localEntityType.value;
        previewSchema.entityType = localEntityType.value;
        previewSchema.name = localEntityType.value;
        return JSON.stringify(previewSchema, null, 2);
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
            const BUILTIN_SCHEMAS = ['character', 'organization', 'state', 'ui_editor'];
            const createDefaultSchema = (typeKey: string) => ({
                name: typeKey,
                entityType: typeKey,
                titleField: 'name',
                sections: [
                    {
                        id: 'page_main',
                        title: 'Главное',
                        icon: '📄',
                        items: [
                            { type: 'text', class: 'name', label: 'НАЗВАНИЕ', placeholder: '...', _isSystemName: true }
                        ]
                    }
                ]
            });

            const currentType = props.entityType || 'universal';
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
                            { type: 'text', class: 'name', label: 'НАЗВАНИЕ', placeholder: '...', _isSystemName: true }
                        ]
                    }
                ];
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
