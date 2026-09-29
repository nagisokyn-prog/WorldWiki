import { ref, computed } from 'vue';
import * as api from '../../../services/api.client';
import type {
  SchemaFieldDef,
  SubContainerDef,
  ModuleExample,
  ModuleUsageInfo,
  RawTemplateDef,
  RawSchema
} from './schemaReference.types';
import {
  isMatchTemplate,
  resolveContainerFields,
  resolveSubContainers
} from './schemaReferenceMatcher';

export type {
  SchemaFieldDef,
  SubContainerDef,
  ModuleExample,
  ModuleUsageInfo
};

const loadedProjectSchemas = ref<RawSchema[]>([]);
const isLoaded = ref(false);

export function useModuleReferenceData(projectName?: string) {
  const rawStaticSchemas = import.meta.glob<Record<string, { default?: RawSchema } | RawSchema>>(
    '../../../struct/editor/*.json',
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

  const loadDbSchemas = async (project?: string) => {
    try {
      const targetProject = project || projectName;
      if (targetProject) {
        const dbSchemas = await api.getEntitySchemas(targetProject);
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
      return [...loadedProjectSchemas.value, ...staticList];
    }
    return staticList;
  });

  const globalTemplates = computed<Record<string, RawTemplateDef>>(() => {
    const map: Record<string, RawTemplateDef> = {};
    for (const schema of allSchemas.value) {
      if (schema.templates) {
        Object.assign(map, schema.templates);
      }
    }
    return map;
  });

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

                const resolvedFields = resolveContainerFields(dc, schemaTemplates, globalTemplates.value, canonicalKey);
                const rawSubs = dc.dynamicContainers || tplDef.dynamicContainers;
                const resolvedSubs = resolveSubContainers(rawSubs, schemaTemplates, globalTemplates.value);

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
