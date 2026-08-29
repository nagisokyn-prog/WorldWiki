import { ref, computed, watch, onMounted, onUnmounted, nextTick, triggerRef } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import * as api from '@/services/api.client';
import { useEntityTree } from '@/services/Entity/entity.tree';
import { useChapterStore } from '@/stores/chapter.store';
import type { ChapterTreeProps } from './ChapterTree.model';

export interface ExplorerNodeData {
    type?: string;
    isEntity?: boolean;
    original?: Record<string, unknown>;
    section?: Record<string, unknown>;
    [key: string]: unknown;
}

export interface ExplorerNode {
    id: string;
    label: string;
    emoji?: string;
    icon?: string;
    isGroup?: boolean;
    canAdd?: boolean;
    addLabel?: string;
    data?: unknown;
    children?: ExplorerNode[];
}

export interface ExplorerSection {
    id: string;
    title: string;
    icon?: string;
    canAdd?: boolean;
    canAddInline?: boolean;
    canEdit?: boolean;
    itemLabel?: string;
    nodes: ExplorerNode[];
}

export function useChapterTree(
    props: ChapterTreeProps,
    emit: (event: string, ...args: unknown[]) => void
) {
    const router = useRouter();
    const store = useChapterStore();
    const { hierarchy } = storeToRefs(store);

    // Entity tree handles fetching characters, locations, etc.
    const {
        entities, entitySections, loadEntities, getEntityName, entityKey
    } = useEntityTree(props.project, emit);

    // ID Helper
    const compareIds = (id1: unknown, id2: unknown) => {
        if (!id1 || !id2) return false;
        const s1 = typeof id1 === 'string' ? id1 : ((id1 as { id?: { String?: string } | string }).id || JSON.stringify(id1));
        const s2 = typeof id2 === 'string' ? id2 : ((id2 as { id?: { String?: string } | string }).id || JSON.stringify(id2));
        const parts1 = String(s1).split(':');
        const parts2 = String(s2).split(':');
        const clean1 = parts1[parts1.length - 1] || String(s1);
        const clean2 = parts2[parts2.length - 1] || String(s2);
        return clean1.replace(/"/g, '') === clean2.replace(/"/g, '');
    };

    const getArcsForVolume = (volumeId: unknown) => hierarchy.value.arcs.filter(a => compareIds(a.volume_id, volumeId));
    const getRootArcs = () => hierarchy.value.arcs.filter(a => !a.volume_id);
    const getChaptersForArc = (arcId: unknown) => hierarchy.value.chapters.filter(c => compareIds(c.arc_id, arcId));
    const getRootChapters = () => hierarchy.value.chapters.filter(c => !c.arc_id && !c.volume_id);

    const activeId = computed(() => {
        // if entity is open, use activeEditorId
        if (props.activeEditorId) return props.activeEditorId;
        // if chapter is open, use activeNode id
        if (props.activeNode && (props.activeNode as { node?: { id?: string } }).node) {
            return String((props.activeNode as { node: { id: string } }).node.id);
        }
        return undefined;
    });

    const explorerSections = computed<ExplorerSection[]>(() => {
        const sections: ExplorerSection[] = [];

        // --- 1. MANUSCRIPT SECTION ---
        const msNodes: ExplorerNode[] = [];

        // Volumes
        for (const vol of hierarchy.value.volumes) {
            const arcs = getArcsForVolume(vol.id);
            const volNode: ExplorerNode = {
                id: String(vol.id),
                label: vol.title || 'Без названия',
                emoji: '📚',
                isGroup: true,
                canAdd: true,
                addLabel: 'Арка',
                data: { type: 'volume', original: vol as unknown as Record<string, unknown> },
                children: []
            };

            for (const arc of arcs) {
                const chapters = getChaptersForArc(arc.id);
                const arcNode: ExplorerNode = {
                    id: String(arc.id),
                    label: arc.title || 'Без названия',
                    emoji: '🌀',
                    isGroup: true,
                    canAdd: true,
                    addLabel: 'Глава',
                    data: { type: 'arc', original: arc as unknown as Record<string, unknown> },
                    children: []
                };

                for (const ch of chapters) {
                    arcNode.children?.push({
                        id: String(ch.id),
                        label: ch.title || 'Без названия',
                        emoji: '📖',
                        data: { type: 'chapter', original: ch as unknown as Record<string, unknown> }
                    });
                }
                volNode.children?.push(arcNode);
            }
            msNodes.push(volNode);
        }

        // Root arcs
        for (const arc of getRootArcs()) {
            const chapters = getChaptersForArc(arc.id);
            const arcNode: ExplorerNode = {
                id: String(arc.id),
                label: arc.title || 'Без названия',
                emoji: '🌀',
                isGroup: true,
                canAdd: true,
                addLabel: 'Глава',
                data: { type: 'arc', original: arc as unknown as Record<string, unknown> },
                children: []
            };

            for (const ch of chapters) {
                arcNode.children?.push({
                    id: String(ch.id),
                    label: ch.title || 'Без названия',
                    emoji: '📖',
                    data: { type: 'chapter', original: ch as unknown as Record<string, unknown> }
                });
            }
            msNodes.push(arcNode);
        }

        // Root chapters
        for (const ch of getRootChapters()) {
            msNodes.push({
                id: String(ch.id),
                label: ch.title || 'Без названия',
                emoji: '📖',
                data: { type: 'chapter', original: ch as unknown as Record<string, unknown> }
            });
        }

        sections.push({
            id: 'manuscript',
            title: 'ПРОИЗВЕДЕНИЕ',
            canAdd: true,
            itemLabel: 'Том',
            nodes: msNodes
        });

        // --- 2. ENTITY SECTIONS ---
        for (const sect of entitySections.value) {
            const entNodes: ExplorerNode[] = [];
            const entList = entities.value[sect.type] || [];

            for (const ent of entList) {
                entNodes.push({
                    id: entityKey(sect.type, String(ent.id)),
                    label: getEntityName(ent, sect.type),
                    emoji: sect.emoji,
                    icon: (sect as { icon?: string }).icon,
                    data: { isEntity: true, type: sect.type, original: ent as Record<string, unknown>, section: sect as unknown as Record<string, unknown> }
                });
            }

            sections.push({
                id: sect.type,
                title: sect.title,
                icon: (sect as { icon?: string }).icon || sect.emoji,
                canAdd: true,
                canAddInline: true,
                canEdit: true,
                itemLabel: sect.title,
                nodes: entNodes
            });
        }

        return sections;
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
                const titleField = Object.keys(ent).find(k => k.toLowerCase() === 'name') || Object.keys(ent)[0];
                if (titleField) ent[titleField] = name;
                triggerRef(entities);
            }
        }
    };

    onMounted(() => {
        document.addEventListener('ww:hierarchy-changed', hierarchyChangedHandler);
        document.addEventListener('ww:entity-renamed', entityRenamedHandler as EventListener);
    });
    onUnmounted(() => {
        document.removeEventListener('ww:hierarchy-changed', hierarchyChangedHandler);
        document.removeEventListener('ww:entity-renamed', entityRenamedHandler as EventListener);
    });

    // ─── Actions ────────────────────────────────────────────────────────────────
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

    const explorerTreeRef = ref<{ startRename: (node: { id: string }) => void; expandNode: (id: string) => void; startCreate: (sectionId: string) => void } | null>(null);

    const startRename = (node: { id: string }, closeCtx: () => void) => {
        closeCtx();
        explorerTreeRef.value?.startRename(node);
    };

    const handleDeleteSection = async (sectionId: string) => {
        const { appConfirm } = await import('@worldwiki/components');
        const confirmed = await appConfirm('Вы уверены, что хотите полностью удалить этот тип сущностей (и все связанные данные)? Это действие необратимо!');
        
        if (confirmed) {
            try {
                await api.deleteEntitySchema(props.project, sectionId);
                setTimeout(() => {
                    window.location.reload();
                }, 500);
            } catch (e) {
                console.error('Failed to delete schema:', e);
                const { appAlert } = await import('@worldwiki/components');
                appAlert('Ошибка при удалении схемы. Проверьте консоль.');
            }
        }
    };

    const handleCreate = async ({ sectionId, parentId, name }: { sectionId: string, parentId?: string, name?: string }) => {
        if (sectionId === 'manuscript') {
            if (!parentId) {
                const tempId = '__new_volume__';
                hierarchy.value.volumes.push({ id: tempId, project_id: props.project, title: 'Новый том', sort_order: 999, description: null, created_at: null });
                await nextTick();
                const node = findNodeById(tempId);
                if (node) explorerTreeRef.value?.startRename(node);
            } else {
                const tempId = '__new_arc__' + Date.now();
                hierarchy.value.arcs.push({ id: tempId, project_id: props.project, volume_id: parentId, title: 'Новая арка', sort_order: 999, description: null, created_at: null });
                explorerTreeRef.value?.expandNode(String(parentId));
                await nextTick();
                const node = findNodeById(tempId);
                if (node) explorerTreeRef.value?.startRename(node);
            }
        } else if (name) {
            emit('add-entity', sectionId, name);
        }
    };

    const handleCreateInline = async ({ sectionId, parentId }: { sectionId: string, parentId?: string }) => {
        if (sectionId === 'manuscript') {
            if (parentId) {
                const arc = hierarchy.value.arcs.find(a => String(a.id) === String(parentId));
                if (arc) {
                    emit('create-chapter-in', { arcId: arc.id, volumeId: arc.volume_id || (arc as unknown as { volumeId?: string }).volumeId });
                } else {
                    const vol = hierarchy.value.volumes.find(v => String(v.id) === String(parentId));
                    if (vol) {
                        handleCreate({ sectionId: 'manuscript', parentId });
                    } else {
                        emit('create-chapter-in', { arcId: null, volumeId: parentId });
                    }
                }
            } else {
                emit('create-chapter-in', { arcId: null, volumeId: null });
            }
        } else {
            explorerTreeRef.value?.startCreate(sectionId);
        }
    };

    const handleRename = async (node: { id: string; data?: unknown }, newName: string) => {
        if (!newName.trim()) return;
        const data = node.data as ExplorerNodeData | undefined;
        try {
            if (String(node.id).startsWith('__new_volume__')) {
                await api.createVolume(props.project, newName);
                await load();
            } else if (String(node.id).startsWith('__new_arc__')) {
                const volId = data?.original ? ((data.original.volumeId as string | undefined) || (data.original.volume_id as string | undefined) || null) : null;
                await api.createArc(props.project, newName, volId);
                await load();
            } else if (data?.type === 'volume' && data.original) {
                const volId = String(data.original.id);
                const vol = hierarchy.value.volumes.find((v) => String(v.id) === volId);
                if (vol) vol.title = newName;
                await api.updateVolume(props.project, volId, newName);
                await load();
            } else if (data?.type === 'arc' && data.original) {
                const arcId = String(data.original.id);
                const arc = hierarchy.value.arcs.find((a) => String(a.id) === arcId);
                if (arc) arc.title = newName;
                await api.updateArc(props.project, arcId, newName, null);
                await load();
            } else if (data?.type === 'chapter' && data.original) {
                const chId = String(data.original.id);
                const ch = hierarchy.value.chapters.find((c) => String(c.id) === chId);
                if (ch) ch.title = newName;
                document.dispatchEvent(new CustomEvent('ww:chapter-renamed', { detail: { id: data.original.id, title: newName } }));
                emit('rename-chapter', data.original, newName);
            } else if (data?.isEntity && data.original) {
                const entityType = data.type || '';
                const originalId = data.original.id;
                const idToUpdate = String(originalId).split(':').pop()!;

                if (entities.value[entityType]) {
                    const ent = entities.value[entityType].find((en) => String(en.id) === String(originalId) || String(en.id) === String(idToUpdate));
                    if (ent) {
                        const titleField = Object.keys(ent).find(k => k.toLowerCase() === 'name') || Object.keys(ent)[0];
                        if (titleField) ent[titleField] = newName;
                    }
                }

                emit('rename-entity', entityType, idToUpdate, newName);
            }
        } catch (e) {
            console.error('Rename error:', e);
            await load(); // Reload to restore previous state
        }
    };

    const handleCancelRename = async (node: { id: string }) => {
        if (String(node.id).startsWith('__new_volume__') || String(node.id).startsWith('__new_arc__')) {
            await load(); // Just reload from server to wipe out temp object
        }
    };

    const handleDelete = async (ids: string[]) => {
        for (const id of ids) {
            const node = findNodeById(id);
            if (!node || !node.data) continue;

            const data = node.data as ExplorerNodeData;
            const type = data.type;
            const original = data.original || {};

            if (type === 'volume') {
                const arcs = getArcsForVolume(original.id).map((a) => a.id);
                let chapters = hierarchy.value.chapters.filter((c) => compareIds((c as unknown as { volumeId?: string }).volumeId || c.volume_id, original.id));
                for (const arcId of arcs) chapters = chapters.concat(getChaptersForArc(arcId));
                emit('delete-volume', original, chapters, arcs, ids.length > 1);
            } else if (type === 'arc') {
                emit('delete-arc', original, getChaptersForArc(original.id), ids.length > 1);
            } else if (type === 'chapter') {
                emit('delete-chapter', original, ids.length > 1);
            } else if (data.isEntity && type) {
                emit('delete-entity', entityKey(type, String(original.id)), type, ids.length > 1);
            }
        }
        await load();
    };

    const findNodeById = (id: string): ExplorerNode | null => {
        for (const sect of explorerSections.value) {
            for (const node of sect.nodes) {
                if (node.id === id) return node;
                if (node.children) {
                    for (const child of node.children) {
                        if (child.id === id) return child;
                        if (child.children) {
                            for (const gchild of child.children) {
                                if (gchild.id === id) return gchild;
                            }
                        }
                    }
                }
            }
        }
        return null;
    };

    return {
        explorerSections,
        activeId,
        explorerTreeRef,
        goBack,
        handleSelect,
        handleOpen,
        startRename,
        handleCreate,
        handleCreateInline,
        handleRename,
        handleCancelRename,
        handleDelete,
        handleDeleteSection,
        load
    };
}
