import { ref, onMounted, onUnmounted, watch } from 'vue';
import * as api from '../../../services/api.client';;
import { useSchemaData } from './hooks/useSchemaData';
import { useSchemaHistory } from './hooks/useSchemaHistory';
import { useSchemaDnD } from './hooks/useSchemaDnD';
import { useSchemaTemplates } from './hooks/useSchemaTemplates';

export function useSchemaEditorMain(props: any, emit: any) {
    const localEntityType = ref(props.schemaType || props.entityType);
    const catalogWidth = ref(250);
    const scrollContainer = ref<HTMLElement | null>(null);
    const showCatalog = ref(true);

    const dataHook = useSchemaData(props, emit, localEntityType, scrollContainer);
    const historyHook = useSchemaHistory(props, dataHook.schema, dataHook.loadSchema);
    const dndHook = useSchemaDnD(dataHook.activeSection, dataHook.activeSectionIdx);
    const templatesHook = useSchemaTemplates();

    watch([dataHook.schema, localEntityType], () => {
        emit('modified');
    }, { deep: true });

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

    const handleScroll = (e: any) => {
        emit('scroll-change', e.target.scrollTop);
    };

    const handleGlobalKeydown = (e: KeyboardEvent) => {
        if (e.ctrlKey && e.shiftKey && e.code === 'KeyB') {
            e.preventDefault();
            showCatalog.value = !showCatalog.value;
        }
    };

    const saveSchema = async () => {
        try {
            const schemaCopy = JSON.parse(JSON.stringify(dataHook.schema.value));
            schemaCopy.sections.forEach((sec: any) => {
                sec.fields = [];
                sec.dynamicContainers = [];
                if (sec.items) {
                    sec.items.forEach((item: any) => {
                        if (templatesHook.isAtomicField(item)) {
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
            
            await api.saveEntitySchema(props.project, dataToSave as any, historyHook.maxSaves.value);
            document.dispatchEvent(new CustomEvent('ww:schema-updated', { detail: { entityType: localEntityType.value } }));

            if (historyHook.isHistoryPreviewMode.value) {
                historyHook.exitPreviewMode();
            }

            if (historyHook.showHistory.value) {
                await historyHook.loadHistory();
            }

            alert('Схема сохранена!');
        } catch (e) {
            console.error('Schema saving error:', e);
            alert('Ошибка сохранения');
        }
    };

    const handleGlobalSchemaSave = (e: Event) => {
        const customEvent = e as CustomEvent;
        if (customEvent.detail?.entityType === props.schemaType || customEvent.detail?.entityType === props.entityType) {
            saveSchema();
        }
    };

    onMounted(() => {
        dataHook.loadSchema();
        document.addEventListener('keydown', handleGlobalKeydown);
        document.addEventListener('ww:trigger-schema-save', handleGlobalSchemaSave);
    });

    onUnmounted(() => {
        document.removeEventListener('keydown', handleGlobalKeydown);
        document.removeEventListener('ww:trigger-schema-save', handleGlobalSchemaSave);
    });

    return {
        localEntityType,
        catalogWidth,
        scrollContainer,
        showCatalog,
        startResize,
        handleScroll,
        saveSchema,
        ...dataHook,
        ...historyHook,
        ...dndHook,
        ...templatesHook
    };
}
