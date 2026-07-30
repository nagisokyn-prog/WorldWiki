import { ref, computed } from 'vue';
import * as api from '../../../../services/api.client';;

export function useSchemaData(props: any, emit: any, localEntityType: any, scrollContainer: any) {
    const schema = ref<any>({ sections: [] });
    const activeSectionIdx = ref(0);
    const activeSection = computed(() => schema.value.sections[activeSectionIdx.value]);

    const isPreviewMode = ref(false);
    const showJsonPreview = ref(false);
    const previewKey = ref(0);
    
    const jsonPreviewContent = computed(() => {
        const previewSchema = JSON.parse(JSON.stringify(schema.value));
        previewSchema.type_key = localEntityType.value;
        previewSchema.entityType = localEntityType.value;
        previewSchema.name = previewSchema.name || localEntityType.value;
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

    const loadSchema = async (forceRefetch = false) => {
        try {
            const schemas = await api.getEntitySchemas(props.project);
            const foundSchema = schemas.find((s: any) => s.type_key === props.entityType);
            if (foundSchema && foundSchema.full_schema) {
                schema.value = JSON.parse(JSON.stringify(foundSchema.full_schema));
            } else {
                try {
                    const res = await fetch(`/struct/editor/${props.entityType}.json`);
                    if (res.ok) {
                        schema.value = await res.json();
                    } else {
                        throw new Error('Not found');
                    }
                } catch (err) {
                    schema.value = {
                        name: props.entityType,
                        entityType: props.entityType,
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
                    };
                }
            }

            if (schema.value.sections) {
                schema.value.sections.forEach((sec: any) => {
                    if (!sec.items) {
                        sec.items = [];
                        if (sec.fields) {
                            sec.items.push(...sec.fields);
                            delete sec.fields;
                        }
                        if (sec.dynamicContainers) {
                            sec.items.push(...sec.dynamicContainers);
                            delete sec.dynamicContainers;
                        }
                    }
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
                const idx = schema.value.sections.findIndex((s: any) => s.id === props.initialSection);
                activeSectionIdx.value = idx !== -1 ? idx : 0;
            } else {
                activeSectionIdx.value = 0;
            }

            setTimeout(() => {
                if (scrollContainer.value && props.initialScrollPos > 0) {
                    scrollContainer.value.scrollTop = props.initialScrollPos;
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

    const deleteSection = (idx: number) => {
        if (idx === 0) return; // Нельзя удалять первую страницу
        if (confirm('Удалить страницу?')) {
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
