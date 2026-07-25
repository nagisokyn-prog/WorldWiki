import { ref, onMounted, onUnmounted, computed, watch, shallowRef } from 'vue';
import { apiService } from '../../../services/api.service';
import uiEditorData from '../../../../../public/struct/editor/ui_editor.json';

export function useSchemaEditorMain(props: any, emit: any) {
    const localEntityType = ref(props.entityType);
    const catalogWidth = ref(250);

    const startResize = (e: MouseEvent) => {
        const startX = e.clientX;
        const startWidth = catalogWidth.value;
        const onMouseMove = (moveEvent: MouseEvent) => {
            catalogWidth.value = Math.max(200, Math.min(600, startWidth - (moveEvent.clientX - startX)));
        };
        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    const schema = ref<any>({ sections: [] });
    const scrollContainer = ref<HTMLElement | null>(null);

    const showHistory = ref(false);
    const schemaHistory = shallowRef<any[]>([]);
    const maxSaves = ref(30);
    const isHistoryPreviewMode = ref(false);
    const historyPreviewId = ref<string | null>(null);

    const handleScroll = (e: any) => {
        emit('scroll-change', e.target.scrollTop);
    };
    const activeSectionIdx = ref(0);
    const activeSection = computed(() => schema.value.sections[activeSectionIdx.value]);

    watch(activeSectionIdx, (newIdx) => {
        if (schema.value?.sections?.[newIdx]) {
            emit('section-change', schema.value.sections[newIdx].id);
        }
    });
    const draggedOverIdx = ref(-1);
    let draggedItemInfo: any = null;

    const isPreviewMode = ref(false);
    const showJsonPreview = ref(false);
    const previewKey = ref(0);

    const jsonPreviewContent = computed(() => {
        return JSON.stringify(schema.value, null, 2);
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
        downloadAnchorNode.setAttribute("download", `${props.entityType || 'schema'}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    const atomicBricks = [
        { val: 'text', icon: '📝', label: 'Текст' },
        { val: 'textarea', icon: '📄', label: 'Абзац' },
        { val: 'select', icon: '🔽', label: 'Список' },
        { val: 'multiselect', icon: '☑️', label: 'Мульти' },
        { val: 'calendar_date', icon: '📅', label: 'Дата' },
        { val: 'calendar_datetime', icon: '🕒', label: 'Дата и время' },
        { val: 'range', icon: '🎚️', label: 'Шкала' },
        { val: 'number', icon: '🔢', label: 'Число' },
        { val: 'tags', icon: '🏷️', label: 'Теги' },
        { val: 'photo', icon: '🖼️', label: 'Фото' }
    ];

    const showCatalog = ref(true);

    const HELPER_TEMPLATES = ['dynamicEndDateTemplate', 'dynamicDisbandDateTemplate', 'dynamicAbolitionDateTemplate', 'stateCollapseDateTemplate'];

    const timelineTemplates = computed(() => {
        const all = uiEditorData.templates || {} as any;
        const result: Record<string, any> = {};
        Object.entries(all).forEach(([key, tpl]: [string, any]) => {
            if (HELPER_TEMPLATES.includes(key)) return;
            if (tpl.type === 'timeline') result[key] = tpl;
        });
        return result;
    });

    const dynamicTemplates = computed(() => {
        const all = uiEditorData.templates || {} as any;
        const result: Record<string, any> = {};
        Object.entries(all).forEach(([key, tpl]: [string, any]) => {
            if (HELPER_TEMPLATES.includes(key)) return;
            if (tpl.type === 'dynamic') result[key] = tpl;
        });
        return result;
    });

    const handleGlobalKeydown = (e: KeyboardEvent) => {
        if (e.ctrlKey && e.shiftKey && e.code === 'KeyB') {
            e.preventDefault();
            showCatalog.value = !showCatalog.value;
        }
    };

    const loadSchema = async (forceRefetch = false) => {
        try {
            const schemas = await apiService.getSchemas(props.project);
            if (schemas[props.entityType] && schemas[props.entityType].full_schema) {
                schema.value = JSON.parse(JSON.stringify(schemas[props.entityType].full_schema));
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

    onMounted(() => {
        loadSchema();
        document.addEventListener('keydown', handleGlobalKeydown);
    });

    onUnmounted(() => {
        document.removeEventListener('keydown', handleGlobalKeydown);
    });

    const isAtomicField = (item: any) => {
        return atomicBricks.some(b => b.val === item.type) || item.type === 'tags' || item.type === 'range';
    };

    const saveSchema = async () => {
        try {
            const schemaCopy = JSON.parse(JSON.stringify(schema.value));
            schemaCopy.sections.forEach((sec: any) => {
                sec.fields = [];
                sec.dynamicContainers = [];
                if (sec.items) {
                    sec.items.forEach((item: any) => {
                        if (isAtomicField(item)) {
                            sec.fields.push(item);
                        } else {
                            sec.dynamicContainers.push(item);
                        }
                    });
                    delete sec.items;
                }
            });

            const dataToSave = {
                id: `entity_schemas:${localEntityType.value}`,
                type_key: localEntityType.value,
                type_name: schemaCopy.name || localEntityType.value,
                icon: schemaCopy.icon || '📄',
                color: schemaCopy.color || '#333333',
                fields_schema: [],
                full_schema: schemaCopy,
                is_custom: true
            };
            await apiService.saveSchema(props.project, dataToSave, maxSaves.value);
            document.dispatchEvent(new CustomEvent('ww:schema-updated', { detail: { entityType: localEntityType.value } }));

            if (isHistoryPreviewMode.value) {
                exitPreviewMode();
            }

            if (showHistory.value) {
                await loadHistory();
            }

            alert('Схема сохранена!');
        } catch (e) {
            console.error('Schema saving error:', e);
            alert('Ошибка сохранения');
        }
    };

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
        localEntityType,
        catalogWidth,
        schema,
        scrollContainer,
        showHistory,
        schemaHistory,
        maxSaves,
        isHistoryPreviewMode,
        historyPreviewId,
        activeSectionIdx,
        activeSection,
        draggedOverIdx,
        isPreviewMode,
        showJsonPreview,
        previewKey,
        jsonPreviewContent,
        atomicBricks,
        showCatalog,
        timelineTemplates,
        dynamicTemplates,
        startResize,
        handleScroll,
        openPreview,
        exportSchema,
        loadSchema,
        saveSchema,
        toggleHistoryPanel,
        loadHistory,
        togglePin,
        previewHistory,
        exitPreviewMode,
        addNewPage,
        deleteSection,
        removeItem,
        handleDragStartPalette,
        handleItemDragStart,
        handleDragOverCanvas,
        handleDropNew,
        handleItemDrop,
        handleDropIntoModule
    };
}
