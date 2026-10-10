import { ref, computed, onMounted } from 'vue';
import * as api from '@/services/api.client';
import { entityApi } from '@/services/Entity/entity.api';
import { getCached, setCache } from '@/utils/requestCache';
import type { SchemaInfo } from '@/services/Entity/entity.types';

export interface ParticipantItem {
    id: string;
    type: string;
    name?: string;
    icon?: string;
    autoParsed?: boolean;
}

export interface ParticipantsPanelProps {
    project: string;
    participants?: (ParticipantItem | string)[] | null;
}

export function useParticipantsPanel(
    props: ParticipantsPanelProps,
    emit: (event: 'update:participants' | 'change', ...args: unknown[]) => void
) {
    const newType = ref('');
    const newId = ref('');
    const entities = ref<Record<string, unknown>[]>([]);
    const entityCache = ref<Record<string, Record<string, unknown>[]>>({});
    const schemaIcons = ref<Record<string, string>>({});
    const schemaNames = ref<Record<string, string>>({});
    const titleFields = ref<Record<string, string>>({});

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

    const loadAllEntities = async () => {
        try {
            const schemaCacheKey = `schemas:${props.project}`;
            let schemas = getCached<Record<string, SchemaInfo>>(schemaCacheKey);
            if (!schemas) {
                schemas = await entityApi.getSchemas(props.project).catch(() => ({}));
                if (schemas && Object.keys(schemas).length > 0) {
                    setCache(schemaCacheKey, schemas);
                }
            }

            titleFields.value = {};
            schemaIcons.value = {};
            schemaNames.value = {};
            const types = Object.keys(schemas || {});
            if (schemas) {
                for (const [key, schema] of Object.entries(schemas)) {
                    if (schema.icon) {
                        schemaIcons.value[key] = schema.icon;
                    }
                    if (schema.name) {
                        schemaNames.value[key] = schema.name;
                    }
                    if (schema.titleField) {
                        titleFields.value[key] = String(schema.titleField);
                    }
                }
            }

            if (!newType.value && types.length > 0) {
                newType.value = types[0];
            }

            if (types.length > 0) {
                const batch = await api.getEntitiesBatch(props.project, types);
                if (batch) {
                    entityCache.value = { ...entityCache.value, ...batch };
                }
            }
        } catch (e) {
            console.warn('[ParticipantsPanel] Failed to load all entities:', e);
        }
    };

    onMounted(() => {
        loadAllEntities();
        loadEntitiesForType();
    });

    const getIcon = (type: string) => {
        return schemaIcons.value[type] || '📄';
    };

    const getValueByPath = (obj: Record<string, unknown> | null | undefined, path: string): unknown => {
        if (!path || !obj) return undefined;
        return path.split('.').reduce((cur: unknown, k: string) => (cur != null && typeof cur === 'object' ? (cur as Record<string, unknown>)[k] : undefined), obj as unknown);
    };

    const searchByNameKey = (obj: unknown, seen = new WeakSet<object>(), depth = 0): string | null => {
        if (depth > 3 || !obj || typeof obj !== 'object') return null;
        if (seen.has(obj as object)) return null;
        seen.add(obj as object);
        const nameKeywords = ['name', 'title', 'fio', 'display', 'short', 'full', 'имя', 'название', 'фио', 'first_name', 'label'];
        const record = obj as Record<string, unknown>;
        for (const key of Object.keys(record)) {
            if (nameKeywords.some((keyword) => key.toLowerCase().includes(keyword))) {
                if (typeof record[key] === 'string' && (record[key] as string).trim()) return (record[key] as string).trim();
            }
        }
        for (const key of Object.keys(record)) {
            if (typeof record[key] === 'object' && record[key] !== null) {
                const nested = searchByNameKey(record[key], seen, depth + 1);
                if (nested) return nested;
            }
        }
        return null;
    };

    const getEntityNameFromRecord = (entity: Record<string, unknown>, type: string): string => {
        const path = titleFields.value[type];
        if (path) {
            const val = getValueByPath(entity, path);
            if (val) return String(val);
        }
        if (typeof entity.name === 'string' && entity.name.trim()) return entity.name.trim();
        if (typeof (entity as { title?: string }).title === 'string' && (entity as { title?: string }).title?.trim()) {
            return (entity as { title?: string }).title!.trim();
        }
        if (typeof (entity as { fio?: string }).fio === 'string' && (entity as { fio?: string }).fio?.trim()) {
            return (entity as { fio?: string }).fio!.trim();
        }
        const searchByName = searchByNameKey(entity);
        if (searchByName) return searchByName;
        return 'Без названия';
    };

    const normId = (val: string) => {
        if (!val) return '';
        try {
            val = decodeURIComponent(val);
        } catch (err) {
            console.warn('[useParticipantsPanel] URI decode error on ID:', val, err);
        }
        return val.trim();
    };

    const rawIdOf = (val: string) => {
        const decoded = normId(val);
        return decoded.includes(':') ? decoded.split(':').slice(1).join(':') : decoded;
    };

    const findEntityInfo = (id: string, explicitType?: string, fallbackName?: string): { name: string; type: string } => {
        const targetNormId = normId(id);
        const targetRawId = rawIdOf(id);

        const isMatch = (e: Record<string, unknown>) => {
            const eid = normId(String(e.id || ''));
            const eraw = rawIdOf(eid);
            return (targetNormId && eid === targetNormId) || (targetRawId && eraw === targetRawId);
        };

        let ent: Record<string, unknown> | undefined;
        let matchedType = explicitType || '';

        // 1. Поиск по конкретному типу (если указан)
        if (explicitType && entityCache.value[explicitType]) {
            ent = entityCache.value[explicitType].find(isMatch);
        }

        // 2. Поиск по всем закешированным динамическим типам схем
        if (!ent) {
            for (const t of Object.keys(entityCache.value)) {
                const found = (entityCache.value[t] || []).find(isMatch);
                if (found) {
                    ent = found;
                    matchedType = t;
                    break;
                }
            }
        }

        // 3. Fallback: поиск по совпадению имени если ID не найден в кеше
        if (!ent && fallbackName) {
            for (const t of Object.keys(entityCache.value)) {
                const found = (entityCache.value[t] || []).find((e) => {
                    return e.name === fallbackName || (e as { title?: string }).title === fallbackName;
                });
                if (found) {
                    ent = found;
                    matchedType = t;
                    break;
                }
            }
        }

        const resolvedName = ent
            ? getEntityNameFromRecord(ent, matchedType)
            : (fallbackName || (targetRawId || targetNormId ? `ID: ${targetRawId || targetNormId}` : 'Без названия'));

        const fallbackType = Object.keys(schemaIcons.value)[0] || 'entity';

        return {
            name: resolvedName,
            type: matchedType || fallbackType
        };
    };

    const resolveEntityName = (id: string, type: string, fallbackName?: string): string => {
        return findEntityInfo(id, type, fallbackName).name;
    };

    const getNormalizedParticipants = (): ParticipantItem[] => {
        if (!props.participants) return [];
        return props.participants.map((p) => {
            if (typeof p === 'string') {
                const hasTypePrefix = p.includes(':') && !p.startsWith('entities:');
                const parts = p.split(':');
                const explicitType = hasTypePrefix ? parts[0] : undefined;
                const id = hasTypePrefix ? parts.slice(1).join(':') : p;
                const info = findEntityInfo(id, explicitType);
                const itemType = explicitType || info.type;
                return { id, type: itemType, name: info.name, icon: schemaIcons.value[itemType] || '📄' };
            }
            const info = findEntityInfo(p.id, p.type, p.name);
            const resolvedType = p.type || info.type;
            return {
                ...p,
                type: resolvedType,
                name: info.name,
                icon: schemaIcons.value[resolvedType] || '📄'
            };
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
        removeParticipant,
        loadEntitiesForType
    };
}
