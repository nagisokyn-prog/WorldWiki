import { ref, computed, onMounted } from 'vue';
import * as api from '../../../services/api.client';

export interface ParticipantItem {
    id: string;
    type: string;
    name?: string;
    autoParsed?: boolean;
}

export interface ParticipantsPanelProps {
    project: string;
    participants?: ParticipantItem[] | string[] | null;
}

export function useParticipantsPanel(
    props: ParticipantsPanelProps,
    emit: (event: 'update:participants' | 'change', ...args: unknown[]) => void
) {
    const newType = ref('character');
    const newId = ref('');
    const entities = ref<Record<string, unknown>[]>([]);
    const entityCache = ref<Record<string, Record<string, unknown>[]>>({});

    const loadEntitiesForType = async () => {
        newId.value = '';
        if (!entityCache.value[newType.value]) {
            try {
                const list = await api.getEntities(props.project, newType.value);
                entityCache.value[newType.value] = (list || []) as Record<string, unknown>[];
            } catch (e) {
                console.warn(`Failed to load ${newType.value}`, e);
                entityCache.value[newType.value] = [];
            }
        }
        entities.value = entityCache.value[newType.value] || [];
    };

    onMounted(() => {
        loadEntitiesForType();
    });

    const getIcon = (type: string) => {
        if (type === 'character') return '👤';
        if (type === 'organization') return '🛡️';
        if (type === 'location') return '🌍';
        return '📌';
    };

    const resolveEntityName = (id: string, type: string) => {
        const list = entityCache.value[type] || [];
        const ent = list.find((e) => String(e.id) === String(id));

        if (!ent) return `ID: ${String(id).substring(0, 8)}`;

        const nameKeywords = ['name', 'title', 'fio', 'display', 'short', 'full', 'имя', 'название', 'фио'];

        const searchByNameKey = (obj: unknown): string | null => {
            if (!obj || typeof obj !== 'object') return null;
            const record = obj as Record<string, unknown>;
            for (const key of Object.keys(record)) {
                if (nameKeywords.some(keyword => key.toLowerCase().includes(keyword))) {
                    if (typeof record[key] === 'string' && (record[key] as string).trim()) return (record[key] as string).trim();
                }
            }
            for (const key of Object.keys(record)) {
                if (typeof record[key] === 'object' && record[key] !== null) {
                    const nested = searchByNameKey(record[key]);
                    if (nested) return nested;
                }
            }
            return null;
        };

        const name = searchByNameKey(ent);
        return name || 'Без названия';
    };

    const getNormalizedParticipants = (): ParticipantItem[] => {
        if (!props.participants) return [];
        return props.participants.map((p) => {
            if (typeof p === 'string') {
                const parts = p.split(':');
                const type = parts.length > 1 ? parts[0] : 'character';
                const id = parts.length > 1 ? parts.slice(1).join(':') : p;
                return { id, type, name: resolveEntityName(id, type) };
            }
            return p;
        });
    };

    const normalizedParticipants = computed<ParticipantItem[]>(() => getNormalizedParticipants());

    const addParticipant = () => {
        if (!newId.value || !newType.value) return;
        const currentList = getNormalizedParticipants();
        const existing = currentList.find((p) => p.id === newId.value && p.type === newType.value);
        if (!existing) {
            const newParts = [...currentList];
            newParts.push({
                id: newId.value,
                type: newType.value,
                name: resolveEntityName(newId.value, newType.value),
                autoParsed: false
            });
            emit('update:participants', newParts);
            emit('change');
        }
        newId.value = '';
    };

    const removeParticipant = (idx: number) => {
        const currentList = getNormalizedParticipants();
        const newParts = [...currentList];
        newParts.splice(idx, 1);
        emit('update:participants', newParts);
        emit('change');
    };

    return {
        newType,
        newId,
        entities,
        normalizedParticipants,
        getIcon,
        resolveEntityName,
        addParticipant,
        removeParticipant
    };
}
