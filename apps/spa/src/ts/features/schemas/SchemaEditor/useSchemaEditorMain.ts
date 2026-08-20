import { ref, onMounted, onUnmounted, watch } from 'vue';
import * as api from '../../../services/api.client';;
import { useSchemaData } from './hooks/useSchemaData';
import { useSchemaHistory } from './hooks/useSchemaHistory';
import { useSchemaDnD } from './hooks/useSchemaDnD';
import { useSchemaTemplates } from './hooks/useSchemaTemplates';

import type { EntitySchema } from '../../../types/generated/EntitySchema';

export interface SchemaEditorMainProps {
    project: string;
    schemaType?: string;
    entityType?: string;
    schemaData?: unknown;
    savedState?: unknown;
    [key: string]: unknown;
}

export function useSchemaEditorMain(props: SchemaEditorMainProps, emit: (event: string, ...args: unknown[]) => void) {
    const localEntityType = ref(props.schemaType || props.entityType || '');
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

    const handleScroll = (e: Event) => {
        emit('scroll-change', (e.target as HTMLElement).scrollTop);
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
            schemaCopy.name = localEntityType.value;
            schemaCopy.entityType = localEntityType.value;
            schemaCopy.sections.forEach((sec: { fields?: unknown[]; dynamicContainers?: unknown[]; items?: unknown[] }) => {
                sec.fields = [];
                sec.dynamicContainers = [];
                if (sec.items) {
                    sec.items.forEach((item: unknown) => {
                        if (templatesHook.isAtomicField(item as { type?: string } | null | undefined)) {
                            sec.fields?.push(item);
                        } else {
                            sec.dynamicContainers?.push(item);
                        }
                    });
                    delete sec.items;
                }
            });

            const dataToSave: EntitySchema = {
                id: `entity_schemas:${localEntityType.value}`,
                project_id: props.project ? `projects:${props.project}` : null,
                type_key: localEntityType.value,
                type_name: schemaCopy.name || localEntityType.value,
                icon: schemaCopy.icon || '📄',
                color: schemaCopy.color || '#333333',
                fields_schema: [],
                full_schema: schemaCopy,
                created_at: null
            };
            
            await api.saveEntitySchema(props.project, dataToSave, historyHook.maxSaves.value);
            document.dispatchEvent(new CustomEvent('ww:schema-updated', { detail: { entityType: localEntityType.value } }));

            if (historyHook.isHistoryPreviewMode.value) {
                historyHook.exitPreviewMode();
            }

            if (historyHook.showHistory.value) {
                await historyHook.loadHistory();
            }

            const { appAlert } = await import('@worldwiki/components');
            appAlert('Схема сохранена!');
        } catch (e) {
            console.error('Schema saving error:', e);
            const { appAlert } = await import('@worldwiki/components');
            appAlert('Ошибка сохранения');
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
