import { type Ref, type ShallowRef, nextTick, onUnmounted } from 'vue';
import * as api from '../../../../services/api.client';
import type { EntitySchema } from '../../../../types/generated/EntitySchema';
import type {
  EntityEditorProps,
  SchemaConfig,
  SchemaSection,
  SchemaField,
  DynamicContainer,
} from '../EntityEditor.model';
import { patchEntityConfig, fetchSpecialRefData } from './entityConfigLoader.utils';

export interface UseEntityConfigLoaderContext {
  props: EntityEditorProps;
  config: ShallowRef<SchemaConfig | null>;
  loading: Ref<boolean>;
  isInitializing: Ref<boolean>;
  activeSection: Ref<string>;
  formData: Ref<Record<string, unknown>>;
  foreignUpdates: Ref<Record<string, unknown>>;
  lastEmittedData: Ref<string | null>;
  referenceData: Ref<Record<string, Array<{ value: string; label: string }>>>;
  scrollContainer: Ref<HTMLElement | null>;
  emit: (event: string, ...args: unknown[]) => void;
}

export function useEntityConfigLoader(ctx: UseEntityConfigLoaderContext) {
  let scrollElement: HTMLElement | null = null;

  const onScroll = (e: Event) => {
    ctx.emit('scroll-change', (e.target as HTMLElement).scrollTop);
  };

  const cleanupScroll = () => {
    if (scrollElement) {
      scrollElement.removeEventListener('scroll', onScroll);
      scrollElement = null;
    }
  };

  onUnmounted(() => {
    cleanupScroll();
  });

  const loadReferenceData = async () => {
    const entityTypesToLoad = new Set<string>();

    if (ctx.props.entityType) entityTypesToLoad.add(ctx.props.entityType);

    const collectDcTypes = (dc: DynamicContainer) => {
      if (dc.foreign_type) entityTypesToLoad.add(dc.foreign_type);
      const tplConf =
        dc.template && ctx.config.value?.templates
          ? ctx.config.value.templates[dc.template]
          : undefined;
      if (tplConf?.foreign_type) entityTypesToLoad.add(tplConf.foreign_type);
      dc.fields?.forEach((f: SchemaField) => {
        if (f.entityType) entityTypesToLoad.add(f.entityType);
      });
      if (dc.fieldOverrides) {
        Object.values(dc.fieldOverrides).forEach((ovRaw) => {
          const ov = ovRaw as Record<string, unknown>;
          if (ov?.['entityType']) entityTypesToLoad.add(String(ov['entityType']));
        });
      }
    };

    ctx.config.value?.sections?.forEach((sec: SchemaSection) => {
      sec.fields?.forEach((f: SchemaField) => {
        if (f.entityType) entityTypesToLoad.add(f.entityType);
      });
      sec.dynamicContainers?.forEach(collectDcTypes);
    });

    if (ctx.config.value?.templates) {
      Object.keys(ctx.config.value.templates).forEach((tplKey) => {
        const tpl = ctx.config.value?.templates?.[tplKey];
        if (tpl?.foreign_type) entityTypesToLoad.add(tpl.foreign_type);
        tpl?.fields?.forEach((f: SchemaField) => {
          if (f.entityType) entityTypesToLoad.add(f.entityType);
        });
        tpl?.dynamicContainers?.forEach(collectDcTypes);
      });
    }

    const fetched = await fetchSpecialRefData(ctx.props.project, entityTypesToLoad);
    ctx.referenceData.value = { ...ctx.referenceData.value, ...fetched };
  };

  const loadConfigAndData = async () => {
    ctx.loading.value = true;
    ctx.isInitializing.value = true;
    try {
      const sandboxConfig = sessionStorage.getItem('sandbox_preview_config');
      if (ctx.props.entityId === 'preview' && sandboxConfig) {
        ctx.config.value = patchEntityConfig(JSON.parse(sandboxConfig), ctx.props.entityType);
      } else {
        const schemas = await api.getEntitySchemas(ctx.props.project);
        const foundSchema = schemas.find((s: EntitySchema) => s.type_key === ctx.props.entityType);
        if (foundSchema && foundSchema.full_schema) {
          ctx.config.value = patchEntityConfig(
            JSON.parse(JSON.stringify(foundSchema.full_schema)),
            ctx.props.entityType
          );
        } else {
          try {
            const staticTypes = [
              'character',
              'location',
              'organization',
              'state',
              'item',
              'event',
              'fraction',
              'ui_editor',
            ];
            if (staticTypes.includes(ctx.props.entityType)) {
              const res = await fetch(`/struct/editor/${ctx.props.entityType}.json`);
              if (res.ok) {
                ctx.config.value = patchEntityConfig(await res.json(), ctx.props.entityType);
              }
            }
          } catch (e) {
            console.warn('Failed to load static schema', e);
          }
        }
      }

      if (!ctx.config.value) {
        ctx.config.value = { templates: {}, sections: [] };
      }

      try {
        const uiRes = await fetch('/struct/editor/ui_editor.json');
        if (uiRes.ok) {
          const uiData = await uiRes.json();
          if (!ctx.config.value.templates) {
            ctx.config.value.templates = {};
          }
          if (uiData && uiData.templates) {
            Object.assign(ctx.config.value.templates, uiData.templates);
          }
        }
      } catch (e) {
        console.warn('[EntityEditor] Failed to load ui_editor.json templates', e);
      }

      if (ctx.config.value?.sections?.length) {
        if (
          ctx.props.initialSection &&
          ctx.config.value.sections.some((s: SchemaSection) => s.id === ctx.props.initialSection)
        ) {
          ctx.activeSection.value = ctx.props.initialSection;
        } else {
          ctx.activeSection.value = ctx.config.value.sections[0].id;
        }
        ctx.emit('section-change', ctx.activeSection.value);
      }

      const rawInitial = ctx.props.initialData
        ? JSON.parse(JSON.stringify(ctx.props.initialData))
        : {};
      const rawTags =
        rawInitial['теги'] ??
        rawInitial.tags ??
        (rawInitial.attributes && (rawInitial.attributes['теги'] ?? rawInitial.attributes.tags)) ??
        [];
      const cleanInitialTags = Array.isArray(rawTags)
        ? rawTags.map((t: unknown) => String(t).trim().replace(/^#/, '')).filter(Boolean)
        : typeof rawTags === 'string'
          ? rawTags
              .split(',')
              .map((t: string) => t.trim().replace(/^#/, ''))
              .filter(Boolean)
          : [];
      rawInitial['теги'] = cleanInitialTags;
      rawInitial.tags = cleanInitialTags;

      const firstSection = ctx.config.value?.sections?.[0];
      const firstField = firstSection?.fields?.[0];
      const firstFieldPath =
        firstField?.path || firstField?.id || firstField?.class || ctx.config.value?.titleField;
      if (firstFieldPath) {
        const entityName =
          rawInitial.name ||
          (ctx.props.initialData && (ctx.props.initialData as Record<string, unknown>).name);
        if (entityName && !rawInitial[firstFieldPath]) {
          rawInitial[firstFieldPath] = entityName;
        }
      }
      ctx.formData.value = rawInitial;
      ctx.foreignUpdates.value = {};
      ctx.lastEmittedData.value = JSON.stringify({ ...ctx.formData.value, __foreignUpdates: {} });

      await loadReferenceData();
    } catch (e) {
      console.error('[EntityEditor] Error loading:', e);
    } finally {
      await nextTick();
      ctx.loading.value = false;
      ctx.isInitializing.value = false;

      if ((ctx.props.initialScrollPos ?? 0) > 0) {
        setTimeout(() => {
          if (ctx.scrollContainer.value)
            ctx.scrollContainer.value.scrollTop = ctx.props.initialScrollPos ?? 0;
        }, 100);
      }

      nextTick(() => {
        cleanupScroll();
        if (ctx.scrollContainer.value) {
          scrollElement = ctx.scrollContainer.value;
          scrollElement.addEventListener('scroll', onScroll);
        }
      });
    }
  };

  return {
    loadReferenceData,
    loadConfigAndData,
  };
}
