import { computed } from 'vue';
import type { Ref } from 'vue';
import type { ChapterHierarchy } from '@/stores/chapter.store';

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

export interface UseChapterTreeSectionsOptions {
    hierarchy: Ref<ChapterHierarchy>;
    entitySections: Ref<Array<{ type: string; title: string; emoji?: string; icon?: string }>>;
    entities: Ref<Record<string, Array<Record<string, unknown>>>>;
    getEntityName: (ent: Record<string, unknown>, type: string) => string;
    entityKey: (type: string, id: string) => string;
    planets?: Ref<Array<{ id: string | number; name: string; [key: string]: unknown }>>;
    calendars?: Ref<Array<{ id?: string; name?: string; planet_id?: unknown; is_master?: boolean; data?: Record<string, unknown>; [key: string]: unknown }>>;
}

export function compareIds(id1: unknown, id2: unknown): boolean {
    if (!id1 || !id2) return false;
    const s1 = typeof id1 === 'string' ? id1 : ((id1 as { id?: { String?: string } | string }).id || JSON.stringify(id1));
    const s2 = typeof id2 === 'string' ? id2 : ((id2 as { id?: { String?: string } | string }).id || JSON.stringify(id2));
    const parts1 = String(s1).split(':');
    const parts2 = String(s2).split(':');
    const clean1 = parts1[parts1.length - 1] || String(s1);
    const clean2 = parts2[parts2.length - 1] || String(s2);
    return clean1.replace(/"/g, '') === clean2.replace(/"/g, '');
}

export function useChapterTreeSections(options: UseChapterTreeSectionsOptions) {
    const getRootChapters = () => options.hierarchy.value.chapters.filter(c => !c.volume_id);

    const explorerSections = computed<ExplorerSection[]>(() => {
        const sections: ExplorerSection[] = [];

        // --- 1. CALENDARS & PLANETS SECTION (Pinned at top) ---
        if (options.planets && options.calendars) {
            const planetNodes: ExplorerNode[] = options.planets.value.map(planet => {
                const cleanPlanetId = String(planet.id).replace(/^(entity:)?planets?:/, '');
                const childCals = (options.calendars?.value || []).filter(c => {
                    const cPlanet = c.planet_id || (c.data as Record<string, unknown> | undefined)?.planet_id;
                    if (!cPlanet) return String(planet.id) === 'earth' || planet.name === 'Земля';
                    return compareIds(cPlanet, planet.id) || compareIds(cPlanet, planet.name);
                });

                return {
                    id: `entity:planet:${cleanPlanetId}`,
                    label: planet.name || 'Планета',
                    emoji: '🪐',
                    isGroup: true,
                    canAdd: true,
                    addLabel: 'Календарь',
                    data: { type: 'planet', original: planet },
                    children: childCals.map(cal => {
                        const cleanCalId = String(cal.id ?? '').replace(/^(entity:)?calendars?:/, '');
                        return {
                            id: `entity:calendar:${cleanCalId}`,
                            label: (cal.name || (cal.data as Record<string, unknown> | undefined)?.название || 'Календарь') + (cal.is_master ? ' (Master)' : ''),
                            emoji: '📜',
                            data: { type: 'calendar', original: cal, planet_id: planet.id }
                        };
                    })
                };
            });

            sections.push({
                id: 'calendars',
                title: 'КАЛЕНДАРИ МИРА',
                icon: 'fas fa-calendar-alt',
                canAdd: true,
                canAddInline: true,
                itemLabel: 'Планета',
                nodes: planetNodes
            });
        }

        // --- 2. MANUSCRIPT SECTION ---
        const msNodes: ExplorerNode[] = [];

        // Volumes
        for (const vol of options.hierarchy.value.volumes) {
            const chapters = options.hierarchy.value.chapters.filter(c => compareIds(c.volume_id, vol.id));
            const volNode: ExplorerNode = {
                id: String(vol.id),
                label: vol.title || 'Без названия',
                emoji: '📚',
                isGroup: true,
                canAdd: true,
                addLabel: 'Глава',
                data: { type: 'volume', original: vol as Record<string, unknown> },
                children: []
            };

            for (const ch of chapters) {
                volNode.children?.push({
                    id: String(ch.id),
                    label: ch.title || 'Без названия',
                    emoji: '📖',
                    data: { type: 'chapter', original: ch as Record<string, unknown> }
                });
            }
            msNodes.push(volNode);
        }

        // Root chapters
        for (const ch of getRootChapters()) {
            msNodes.push({
                id: String(ch.id),
                label: ch.title || 'Без названия',
                emoji: '📖',
                data: { type: 'chapter', original: ch as Record<string, unknown> }
            });
        }

        sections.push({
            id: 'manuscript',
            title: 'ПРОИЗВЕДЕНИЕ',
            canAdd: true,
            itemLabel: 'Том',
            nodes: msNodes
        });

        // --- 3. ENTITY SECTIONS ---
        for (const sect of options.entitySections.value) {
            const entNodes: ExplorerNode[] = [];
            const entList = options.entities.value[sect.type] || [];

            for (const ent of entList) {
                entNodes.push({
                    id: options.entityKey(sect.type, String(ent.id)),
                    label: options.getEntityName(ent, sect.type),
                    emoji: sect.emoji,
                    icon: sect.icon,
                    data: { isEntity: true, type: sect.type, original: ent, section: sect as unknown as Record<string, unknown> }
                });
            }

            sections.push({
                id: sect.type,
                title: sect.title,
                icon: sect.icon || sect.emoji,
                canAdd: true,
                canAddInline: true,
                canEdit: true,
                itemLabel: sect.title,
                nodes: entNodes
            });
        }

        return sections;
    });

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

    const isNodeType = (node: { data?: unknown }, type: string) => {
        return (node.data as { type?: string } | undefined)?.type === type;
    };

    const isEntityNode = (node: { data?: unknown }) => {
        return Boolean((node.data as { isEntity?: boolean } | undefined)?.isEntity);
    };

    return {
        explorerSections,
        getRootChapters,
        findNodeById,
        isNodeType,
        isEntityNode
    };
}
