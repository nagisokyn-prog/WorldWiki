import { nextTick } from 'vue';
import type { Ref } from 'vue';
import * as api from '@/services/api.client';
import { appAlert, appConfirm } from '@worldwiki/components';
import type { ChapterHierarchy } from '@/stores/chapter.store';
import { useCalendarStore, getDefaultPlanet } from '@/stores/calendar.store';
import { CalendarMath } from '@/services/Calendars/useCalendarEngine';
import type { CalendarData, PlanetEntity } from '@/services/Calendars/calendar.types';
import type { ExplorerNode, ExplorerNodeData } from './useChapterTreeSections';

export interface UseChapterTreeOpsOptions {
    project: string;
    hierarchy: Ref<ChapterHierarchy>;
    entities: Ref<Record<string, Array<Record<string, unknown>>>>;
    entityKey: (type: string, id: string) => string;
    findNodeById: (id: string) => ExplorerNode | null;
    compareIds: (id1: unknown, id2: unknown) => boolean;
    load: () => Promise<void>;
    emit: (event: string, ...args: unknown[]) => void;
    explorerTreeRef: Ref<{ startRename: (node: { id: string }) => void; expandNode: (id: string) => void; startCreate: (sectionId: string) => void } | null>;
}

export function useChapterTreeOps(options: UseChapterTreeOpsOptions) {
    const startRename = (node: { id: string }, closeCtx: () => void) => {
        closeCtx();
        options.explorerTreeRef.value?.startRename(node);
    };

    const handleDeleteSection = async (sectionId: string) => {
        const confirmed = await appConfirm(
            'Вы уверены, что хотите полностью удалить этот тип сущностей (и все связанные данные)? Это действие необратимо!',
            'Удаление схемы'
        );

        if (confirmed) {
            try {
                await api.deleteEntitySchema(options.project, sectionId);
                setTimeout(() => {
                    window.location.reload();
                }, 500);
            } catch (e) {
                console.error('Failed to delete schema:', e);
                appAlert('Ошибка при удалении схемы. Проверьте консоль.');
            }
        }
    };

    const handleCreate = async ({ sectionId, parentId, name }: { sectionId: string; parentId?: string; name?: string }) => {
        if (sectionId === 'manuscript') {
            if (!parentId) {
                const tempId = '__new_volume__';
                options.hierarchy.value.volumes.push({
                    id: tempId,
                    project_id: options.project,
                    title: 'Новый том',
                    sort_order: 999,
                    description: null,
                    created_at: null
                });
                await nextTick();
                const node = options.findNodeById(tempId);
                if (node) options.explorerTreeRef.value?.startRename(node);
            } else {
                options.emit('create-chapter-in', { volumeId: parentId });
            }
        } else if (sectionId === 'calendars') {
            const calendarStore = useCalendarStore();
            if (!parentId) {
                // Создание новой планеты
                const newId = `planet_${Date.now()}`;
                const newName = name?.trim() || 'Новая планета';
                const newPlanet = {
                    ...getDefaultPlanet(options.project),
                    id: newId,
                    name: newName,
                };
                calendarStore.savePlanet(options.project, newPlanet);
                await options.load();
                document.dispatchEvent(new CustomEvent('ww:hierarchy-changed'));
                options.emit('open-planet-viewer', newPlanet);
                options.emit('open-entity', { ...newPlanet, entityType: 'planet', id: newId, name: newName, title: newName });
                await nextTick();
                const pNode = options.findNodeById(`entity:planet:${newId}`) || options.findNodeById(newId);
                if (pNode && options.explorerTreeRef.value) {
                    options.explorerTreeRef.value.startRename(pNode);
                }
            } else {
                // Создание календаря на планете без системных prompt-окон
                const planetId = parentId.replace(/^(entity:)?planets?:/, '');
                const calName = name?.trim() || 'Новый календарь';
                const defaultCalData = CalendarMath.getDefaultCalendar();
                defaultCalData.planet_id = planetId;
                defaultCalData.название = calName;
                defaultCalData.is_master = false;
                const saved = await calendarStore.saveCalendar(options.project, {
                    ...defaultCalData,
                    planet_id: planetId,
                    name: calName,
                    is_master: false,
                    is_default: false,
                } as unknown as CalendarData);
                if (!saved) {
                    await appAlert('Не удалось сохранить календарь на планете', 'Ошибка сохранения');
                    return;
                }
                await options.load();
                if (options.explorerTreeRef.value) {
                    options.explorerTreeRef.value.expandNode(`entity:planet:${planetId}`);
                }
                document.dispatchEvent(new CustomEvent('ww:hierarchy-changed'));
                const cals = await calendarStore.getCalendars(options.project);
                const created = cals.find(c => c.name === calName) || cals[cals.length - 1];
                if (created) {
                    const cleanCalId = String(created.id ?? '').replace(/^(entity:)?calendars?:/, '');
                    options.emit('open-entity', { ...created, entityType: 'calendar', id: cleanCalId, name: created.name, title: created.name });
                    await nextTick();
                    const node = options.findNodeById(`entity:calendar:${cleanCalId}`) || options.findNodeById(cleanCalId);
                    if (node && options.explorerTreeRef.value) {
                        options.explorerTreeRef.value.startRename(node);
                    }
                }
            }
        } else if (name) {
            options.emit('add-entity', sectionId, name);
        }
    };

    const handleCreateInline = async ({ sectionId, parentId }: { sectionId: string; parentId?: string }) => {
        if (sectionId === 'manuscript') {
            if (parentId) {
                options.emit('create-chapter-in', { volumeId: parentId });
            } else {
                options.emit('create-chapter-in', { volumeId: null });
            }
        } else if (sectionId === 'calendars') {
            if (parentId) {
                await handleCreate({ sectionId: 'calendars', parentId });
            } else {
                options.explorerTreeRef.value?.startCreate(sectionId);
            }
        } else {
            options.explorerTreeRef.value?.startCreate(sectionId);
        }
    };

    const handleRename = async (node: { id: string; data?: unknown }, newName: string) => {
        if (!newName.trim()) return;
        const data = node.data as ExplorerNodeData | undefined;
        try {
            if (String(node.id).startsWith('__new_volume__')) {
                await api.createVolume(options.project, newName);
                await options.load();
            } else if (data?.type === 'volume' && data.original) {
                const volId = String(data.original.id);
                const vol = options.hierarchy.value.volumes.find((v) => String(v.id) === volId);
                if (vol) vol.title = newName;
                await api.updateVolume(options.project, volId, newName);
                await options.load();
            } else if (data?.type === 'chapter' && data.original) {
                const chId = String(data.original.id);
                const ch = options.hierarchy.value.chapters.find((c) => String(c.id) === chId);
                if (ch) ch.title = newName;
                options.hierarchy.value = {
                    ...options.hierarchy.value,
                    chapters: [...options.hierarchy.value.chapters]
                };
                document.dispatchEvent(new CustomEvent('ww:chapter-renamed', { detail: { id: data.original.id, title: newName } }));
                options.emit('rename-chapter', data.original, newName);
            } else if (data?.type === 'planet' && data.original) {
                const calendarStore = useCalendarStore();
                const planet = data.original as unknown as PlanetEntity;
                planet.name = newName;
                calendarStore.savePlanet(options.project, planet);
                document.dispatchEvent(new CustomEvent('ww:planet-renamed', { detail: { id: String(planet.id), name: newName } }));
                await options.load();
            } else if (data?.type === 'calendar' && data.original) {
                const calendarStore = useCalendarStore();
                const cal = data.original as { id?: string; name?: string; data?: Record<string, unknown>; [key: string]: unknown };
                cal.name = newName;
                if (cal.data) {
                    cal.data.название = newName;
                    cal.data.name = newName;
                }
                await calendarStore.saveCalendar(options.project, { ...(cal.data || {}), id: cal.id, name: newName } as unknown as CalendarData);
                document.dispatchEvent(new CustomEvent('ww:calendar-renamed', { detail: { id: cal.id, name: newName } }));
                await options.load();
            } else if (data?.isEntity && data.original) {
                const entityType = data.type || '';
                const originalId = data.original.id;
                const idToUpdate = String(originalId).split(':').pop()!;

                if (options.entities.value[entityType]) {
                    const ent = options.entities.value[entityType].find(
                        (en) => String(en.id) === String(originalId) || String(en.id) === String(idToUpdate)
                    );
                    if (ent) {
                        const titleField = Object.keys(ent).find((k) => k.toLowerCase() === 'name') || Object.keys(ent)[0];
                        if (titleField) ent[titleField] = newName;
                    }
                }

                options.emit('rename-entity', entityType, idToUpdate, newName);
            }
        } catch (e) {
            console.error('Rename error:', e);
            await options.load();
        }
    };

    const handleCancelRename = async (node: { id: string }) => {
        if (String(node.id).startsWith('__new_volume__')) {
            await options.load();
        }
    };

    const handleDelete = async (ids: string[]) => {
        for (const id of ids) {
            const node = options.findNodeById(id);
            if (!node || !node.data) continue;

            const data = node.data as ExplorerNodeData;
            const type = data.type;
            const original = (data.original || {}) as { id?: unknown };

            if (type === 'volume') {
                const chapters = options.hierarchy.value.chapters.filter((c) =>
                    options.compareIds((c as { volumeId?: string }).volumeId || c.volume_id, original.id)
                );
                options.emit('delete-volume', original, chapters, ids.length > 1);
            } else if (type === 'chapter') {
                options.emit('delete-chapter', original, ids.length > 1);
            } else if (type === 'planet') {
                const calendarStore = useCalendarStore();
                const plId = String(original.id || id).replace(/^planet:/, '');
                const plName = (original as { name?: string }).name || id;
                const confirmed = await appConfirm(
                    `Удалить планету "${plName}"?`,
                    'Удаление планеты'
                );
                if (confirmed) {
                    calendarStore.deletePlanet(options.project, plId);
                    document.dispatchEvent(new CustomEvent('ww:planet-deleted', { detail: { id: plId } }));
                }
            } else if (type === 'calendar') {
                const calendarStore = useCalendarStore();
                const calId = String(original.id || id).replace(/^calendar:/, '');
                const calName = (original as { name?: string }).name || id;
                const confirmed = await appConfirm(
                    `Удалить календарь "${calName}"?`,
                    'Удаление календаря'
                );
                if (confirmed) {
                    await calendarStore.deleteCalendar(calId);
                    document.dispatchEvent(new CustomEvent('ww:calendar-deleted', { detail: { id: calId } }));
                }
            } else if (data.isEntity && type) {
                options.emit('delete-entity', options.entityKey(type, String(original.id)), type, ids.length > 1);
            }
        }
        await options.load();
    };

    return {
        startRename,
        handleDeleteSection,
        handleCreate,
        handleCreateInline,
        handleRename,
        handleCancelRename,
        handleDelete
    };
}
