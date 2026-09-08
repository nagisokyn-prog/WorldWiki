import { ref, computed } from 'vue';
import * as api from '@/services/api.client';
import { useShellStore } from '@/stores/shell';

export interface SchemaFieldDef {
    class?: string;
    id?: string;
    label?: string;
    type?: string;
    placeholder?: string;
    options?: Array<{ value: string; label: string }>;
    min?: number;
    max?: number;
    entityType?: string;
    rows?: number;
    hint?: string;
    hidden?: boolean;
    [key: string]: unknown;
}

export interface SubContainerDef {
    id?: string;
    title?: string;
    template?: string;
    fields?: SchemaFieldDef[];
    emptyMessage?: string;
}

export interface ModuleExample {
    id: string;
    entityName: string;
    entityIcon: string;
    sectionTitle: string;
    containerTitle: string;
    isBidirectional: boolean;
    templateType: string;
    fields: SchemaFieldDef[];
    dynamicContainers?: SubContainerDef[];
}

export interface ModuleUsageInfo {
    templateKey: string;
    examples: ModuleExample[];
}

interface RawTemplateDef {
    type?: string;
    isBidirectional?: boolean;
    headerTitle?: string;
    fields?: SchemaFieldDef[];
    dynamicContainers?: SubContainerDef[];
    bidirectionalLinkClass?: string;
    [key: string]: unknown;
}

interface RawSchema {
    name?: string;
    iconEmoji?: string;
    icon?: string;
    entityType?: string;
    sections?: Array<{
        id?: string;
        title?: string;
        icon?: string;
        fields?: SchemaFieldDef[];
        dynamicContainers?: Array<{
            id?: string;
            type?: string;
            title?: string;
            template?: string;
            fields?: SchemaFieldDef[];
            fieldOverrides?: Record<string, SchemaFieldDef>;
            isBidirectional?: boolean;
            dynamicContainers?: SubContainerDef[];
            [key: string]: unknown;
        }>;
    }>;
    templates?: Record<string, RawTemplateDef>;
}

const loadedProjectSchemas = ref<RawSchema[]>([]);
const isLoaded = ref(false);

export function useModuleReferenceData() {
    const rawStaticSchemas = import.meta.glob<Record<string, { default?: RawSchema } | RawSchema>>(
        '../../../../../public/struct/editor/*.json',
        { eager: true }
    );

    const getStaticSchemas = (): RawSchema[] => {
        const list: RawSchema[] = [];
        for (const path in rawStaticSchemas) {
            const mod = rawStaticSchemas[path];
            const schema = (mod as { default?: RawSchema }).default || (mod as RawSchema);
            if (schema && typeof schema === 'object') {
                list.push(schema);
            }
        }
        return list;
    };

    const loadDbSchemas = async () => {
        try {
            const shell = useShellStore();
            const project = shell.projectName;
            if (project) {
                const dbSchemas = await api.getEntitySchemas(project);
                if (Array.isArray(dbSchemas) && dbSchemas.length > 0) {
                    const list: RawSchema[] = [];
                    for (const s of dbSchemas) {
                        if (s.full_schema) {
                            list.push(s.full_schema as RawSchema);
                        }
                    }
                    if (list.length > 0) {
                        loadedProjectSchemas.value = list;
                        isLoaded.value = true;
                        return;
                    }
                }
            }
        } catch (e) {
            console.warn('[useModuleReferenceData] Failed to fetch schemas from DB, using fallback static schemas:', e);
        }

        loadedProjectSchemas.value = getStaticSchemas();
        isLoaded.value = true;
    };

    if (!isLoaded.value) {
        loadDbSchemas();
    }

    const allSchemas = computed<RawSchema[]>(() => {
        const staticList = getStaticSchemas();
        if (loadedProjectSchemas.value.length > 0) {
            // Merge to ensure base definitions like ui_editor are always present
            return [...loadedProjectSchemas.value, ...staticList];
        }
        return staticList;
    });

    // Реестр всех глобальных шаблонов
    const globalTemplates = computed<Record<string, RawTemplateDef>>(() => {
        const map: Record<string, RawTemplateDef> = {};

        // Из всех схем (включая ui_editor)
        for (const schema of allSchemas.value) {
            if (schema.templates) {
                Object.assign(map, schema.templates);
            }
        }
        return map;
    });


    const isMatchTemplate = (
        canonicalKey: string,
        container: { template?: string; type?: string; isBidirectional?: boolean; id?: string; title?: string },
        templateDef?: RawTemplateDef
    ): boolean => {
        const isBidi = Boolean(container.isBidirectional || templateDef?.isBidirectional || templateDef?.bidirectionalLinkClass);
        const cType = String(container.type || templateDef?.type || 'dynamic').toLowerCase();
        const tplName = String(container.template || container.id || '').toLowerCase();
        const titleName = String(container.title || '').toLowerCase();

        if (canonicalKey === 'Двунаправленная связь') {
            return isBidi || tplName.includes('relationship') || tplName.includes('связь') || titleName.includes('связ') || titleName.includes('отношен');
        }
        if (canonicalKey === 'Базовая хронология') {
            return !isBidi && (cType === 'timeline' || tplName.includes('timeline') || tplName.includes('хронолог') || titleName.includes('хронолог') || titleName.includes('истори') || titleName.includes('событи'));
        }
        if (canonicalKey === 'Одиночный параметр') {
            return !isBidi && (canonicalKey === container.template || tplName.includes('параметр') || tplName.includes('parameter') || titleName.includes('параметр'));
        }
        if (canonicalKey === 'Динамический элемент') {
            return !isBidi && cType !== 'timeline' && !tplName.includes('timeline') && !titleName.includes('хронолог');
        }
        return false;
    };

    const resolveContainerFields = (
        dc: { fields?: SchemaFieldDef[]; template?: string; fieldOverrides?: Record<string, SchemaFieldDef> },
        schemaTemplates: Record<string, RawTemplateDef>,
        fallbackTemplateKey: string
    ): SchemaFieldDef[] => {
        // 1. Ищем определение шаблона
        let tplDef: RawTemplateDef | undefined;
        if (dc.template) {
            tplDef = schemaTemplates[dc.template] || globalTemplates.value[dc.template];
        }
        if (!tplDef) {
            tplDef = globalTemplates.value[fallbackTemplateKey];
        }

        const baseFields: SchemaFieldDef[] = dc.fields || tplDef?.fields || [];
        const overrides: Record<string, SchemaFieldDef> = dc.fieldOverrides || {};

        const result: SchemaFieldDef[] = [];
        const handledClasses = new Set<string>();

        // Применяем оверрайды к базовым полям
        for (const f of baseFields) {
            const fKey = f.class || f.id || '';
            const ov = overrides[fKey] || {};
            handledClasses.add(fKey);

            const isProtected = ['начальная_глава', 'конечная_глава'].includes(fKey.replace(/__b$/, ''));
            if (ov.hidden && !isProtected) continue;

            result.push({
                ...f,
                ...ov,
                label: ov.label || f.label || fKey,
                placeholder: ov.placeholder !== undefined ? ov.placeholder : (f.placeholder || ''),
                type: isProtected ? (f.type || 'select') : (ov.type || f.type || 'text'),
                options: isProtected ? (f.options || []) : (ov.options || f.options || [])
            });
        }

        // Если в fieldOverrides есть поля, которых не было в baseFields
        for (const fKey in overrides) {
            if (!handledClasses.has(fKey)) {
                const ov = overrides[fKey];
                if (ov && !ov.hidden) {
                    result.push({
                        class: fKey,
                        id: fKey,
                        label: ov.label || fKey,
                        placeholder: ov.placeholder || '',
                        type: ov.type || 'text',
                        options: ov.options || []
                    });
                }
            }
        }

        return result;
    };

    const resolveSubContainers = (
        subContainers: SubContainerDef[] | undefined,
        schemaTemplates: Record<string, RawTemplateDef>
    ): SubContainerDef[] => {
        if (!Array.isArray(subContainers)) return [];
        return subContainers.map(sc => {
            let sTplDef: RawTemplateDef | undefined;
            if (sc.template) {
                sTplDef = schemaTemplates[sc.template] || globalTemplates.value[sc.template];
            }
            const sFields = sc.fields || sTplDef?.fields || [];
            return {
                ...sc,
                fields: sFields
            };
        });
    };

    const getModuleUsageInfo = (canonicalKey: string): ModuleUsageInfo => {
        const examples: ModuleExample[] = [];
        const seenKeys = new Set<string>();

        for (const schema of allSchemas.value) {
            const eName = schema.name || schema.entityType || 'Сущность';
            const eIcon = schema.iconEmoji || '📄';
            const schemaTemplates = schema.templates || {};

            if (Array.isArray(schema.sections)) {
                for (const sec of schema.sections) {
                    if (Array.isArray(sec.dynamicContainers)) {
                        for (const dc of sec.dynamicContainers) {
                            const tplDef = (dc.template ? (schemaTemplates[dc.template] || globalTemplates.value[dc.template]) : undefined) || {};
                            if (isMatchTemplate(canonicalKey, dc, tplDef)) {
                                const title = dc.title || String(tplDef.headerTitle || canonicalKey);
                                const dedupeKey = `${eName}_${title}`;
                                if (seenKeys.has(dedupeKey)) continue;
                                seenKeys.add(dedupeKey);

                                const resolvedFields = resolveContainerFields(dc, schemaTemplates, canonicalKey);
                                const rawSubs = dc.dynamicContainers || tplDef.dynamicContainers;
                                const resolvedSubs = resolveSubContainers(rawSubs, schemaTemplates);

                                examples.push({
                                    id: `${eName}_${sec.title || sec.id}_${dc.title || dc.id || title}`,
                                    entityName: eName,
                                    entityIcon: eIcon,
                                    sectionTitle: sec.title || sec.id || 'Страница',
                                    containerTitle: title,
                                    isBidirectional: Boolean(dc.isBidirectional || tplDef.isBidirectional || tplDef.bidirectionalLinkClass),
                                    templateType: String(dc.type || tplDef.type || 'dynamic'),
                                    fields: resolvedFields,
                                    dynamicContainers: resolvedSubs
                                });
                            }
                        }
                    }
                }
            }
        }

        // Fallback default if not found
        if (examples.length === 0) {
            const tplDef = globalTemplates.value[canonicalKey] || {};
            const baseFields: SchemaFieldDef[] = tplDef.fields || [
                { class: 'название', label: 'Название', type: 'text', placeholder: 'Введите название...' },
                { class: 'описание', label: 'Описание', type: 'textarea', placeholder: 'Введите описание...' }
            ];
            examples.push({
                id: 'fallback_default',
                entityName: 'Базовый шаблон',
                entityIcon: '🧩',
                sectionTitle: 'Основной раздел',
                containerTitle: canonicalKey,
                isBidirectional: canonicalKey === 'Двунаправленная связь',
                templateType: canonicalKey === 'Базовая хронология' ? 'timeline' : 'dynamic',
                fields: baseFields,
                dynamicContainers: tplDef.dynamicContainers
            });
        }

        return {
            templateKey: canonicalKey,
            examples
        };
    };

    return {
        getModuleUsageInfo,
        loadDbSchemas
    };
}
