import { ref, computed, watch, onMounted, onUnmounted, triggerRef } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useEntityTree } from '@/services/Entity/entity.tree';
import { useChapterStore } from '@/stores/chapter.store';
import type { ChapterTreeProps } from './ChapterTree.model';
import { useCalendarResize } from './composables/useCalendarResize';
import {
    useChapterTreeSections,
    compareIds,
    type ExplorerNode,
    type ExplorerNodeData,
    type ExplorerSection
} from './composables/useChapterTreeSections';
import { useChapterTreeOps } from './composables/useChapterTreeOps';

export type { ExplorerNode, ExplorerNodeData, ExplorerSection };

export function useChapterTree(
    props: ChapterTreeProps,
    emit: (event: string, ...args: unknown[]) => void
) {
    const router = useRouter();
    const store = useChapterStore();
    const { hierarchy } = storeToRefs(store);

    const {
        entities, entitySections, loadEntities, getEntityName, entityKey
    } = useEntityTree(props.project, emit);

    const { calendarHeight, startResizeCalendar } = useCalendarResize();

    const sectionsHelper = useChapterTreeSections({
        hierarchy,
        entitySections,
        entities,
        getEntityName,
        entityKey
    });

    const activeId = computed(() => {
        if (props.activeEditorId) return props.activeEditorId;
        if (props.activeNode && (props.activeNode as { node?: { id?: string } }).node) {
            return String((props.activeNode as { node: { id: string } }).node.id);
        }
        return undefined;
    });

    const load = async () => {
        try {
            await store.loadChapters(props.project);
            await loadEntities();
        } catch (e) {
            console.error('ChapterTree load error:', e);
        }
    };

    watch(() => props.project, load, { immediate: true });

    const hierarchyChangedHandler = () => load();

    const entityRenamedHandler = (e: Event) => {
        const { id, type, name } = (e as CustomEvent<{ id: string; type: string; name: string }>).detail;
        if (entities.value[type]) {
            const ent = entities.value[type].find((en) => String(en.id) === String(id) || String(en.id).endsWith(`:${id}`));
            if (ent) {
                const titleField = Object.keys(ent).find((k) => k.toLowerCase() === 'name') || Object.keys(ent)[0];
                if (titleField) ent[titleField] = name;
                triggerRef(entities);
            }
        }
    };

    const schemaUpdatedHandler = () => {
        loadEntities();
    };

    const entitySavedHandler = () => {
        void load();
    };

    onMounted(() => {
        document.addEventListener('ww:hierarchy-changed', hierarchyChangedHandler);
        document.addEventListener('ww:entity-renamed', entityRenamedHandler as EventListener);
        document.addEventListener('ww:entity-saved', entitySavedHandler);
        window.addEventListener('ww:schema-updated', schemaUpdatedHandler as EventListener);
    });

    onUnmounted(() => {
        document.removeEventListener('ww:hierarchy-changed', hierarchyChangedHandler);
        document.removeEventListener('ww:entity-renamed', entityRenamedHandler as EventListener);
        document.removeEventListener('ww:entity-saved', entitySavedHandler);
        window.removeEventListener('ww:schema-updated', schemaUpdatedHandler as EventListener);
    });

    const goBack = () => {
        router.push('/launcher');
    };

    const handleSelect = (nodes: Array<{ id: string; data?: unknown }>, event: MouseEvent) => {
        if (!nodes.length) return;
        const node = nodes[0];
        const data = node.data as ExplorerNodeData | undefined;

        if (data?.isEntity) {
            emit('open-entity', { ...data.original, entityType: data.type });
            return;
        }

        if (data) {
            emit('select-node', { type: data.type, node: data.original });
            if (data.type === 'chapter') {
                if (!event?.ctrlKey && !event?.shiftKey) {
                    emit('select-chapter', data.original);
                }
            }
        }
    };

    const handleOpen = (node: { id: string; data?: unknown }) => {
        const data = node.data as ExplorerNodeData | undefined;
        if (data?.isEntity) {
            emit('open-entity', { ...data.original, entityType: data.type });
        } else if (data?.type === 'chapter') {
            emit('select-chapter', data.original);
        }
    };

    const explorerTreeRef = ref<{
        startRename: (node: { id: string }) => void;
        expandNode: (id: string) => void;
        startCreate: (sectionId: string) => void;
    } | null>(null);

    const ops = useChapterTreeOps({
        project: props.project,
        hierarchy,
        entities,
        entityKey,
        findNodeById: sectionsHelper.findNodeById,
        compareIds,
        load,
        emit,
        explorerTreeRef
    });

    return {
        calendarHeight,
        startResizeCalendar,
        isNodeType: sectionsHelper.isNodeType,
        isEntityNode: sectionsHelper.isEntityNode,
        explorerSections: sectionsHelper.explorerSections,
        activeId,
        explorerTreeRef,
        goBack,
        handleSelect,
        handleOpen,
        startRename: ops.startRename,
        handleCreate: ops.handleCreate,
        handleCreateInline: ops.handleCreateInline,
        handleRename: ops.handleRename,
        handleCancelRename: ops.handleCancelRename,
        handleDelete: ops.handleDelete,
        handleDeleteSection: ops.handleDeleteSection,
        load
    };
}
