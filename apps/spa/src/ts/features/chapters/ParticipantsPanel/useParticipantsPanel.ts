import { ref, onMounted } from 'vue';
import * as api from '../../../services/api.client';;

export function useParticipantsPanel(props: any, emit: any) {
    const newType = ref('character');
    const newId = ref('');
    const entities = ref<any[]>([]);
    const entityCache = ref<Record<string, any[]>>({});

    const loadEntitiesForType = async () => {
        newId.value = '';
        if (!entityCache.value[newType.value]) {
            try {
                const list = await api.getEntities(props.project, newType.value);
                entityCache.value[newType.value] = list;
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
        const ent = list.find((e: any) => String(e.id) === String(id));

        if (!ent) return `ID: ${String(id).substring(0, 8)}`;

        const nameKeywords = ['name', 'title', 'fio', 'display', 'short', 'full', 'имя', 'название', 'фио'];

        const searchByNameKey = (obj: any): string | null => {
            if (!obj || typeof obj !== 'object') return null;
            for (const key of Object.keys(obj)) {
                if (nameKeywords.some(keyword => key.toLowerCase().includes(keyword))) {
                    if (typeof obj[key] === 'string' && obj[key].trim()) return obj[key].trim();
                }
            }
            for (const key of Object.keys(obj)) {
                if (typeof obj[key] === 'object' && obj[key] !== null) {
                    const nested = searchByNameKey(obj[key]);
                    if (nested) return nested;
                }
            }
            return null;
        };

        const name = searchByNameKey(ent);
        return name || 'Без названия';
    };

    const addParticipant = () => {
        if (!newId.value || !newType.value) return;
        const existing = props.participants.find((p: any) => p.id === newId.value && p.type === newType.value);
        if (!existing) {
            const newParts = [...props.participants];
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
        const newParts = [...props.participants];
        newParts.splice(idx, 1);
        emit('update:participants', newParts);
        emit('change');
    };

    return {
        newType,
        newId,
        entities,
        getIcon,
        resolveEntityName,
        addParticipant,
        removeParticipant
    };
}
