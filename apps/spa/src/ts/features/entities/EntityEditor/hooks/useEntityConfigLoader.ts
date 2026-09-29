import { type Ref, type ShallowRef, nextTick, onUnmounted } from 'vue';
import * as api from '../../../../services/api.client';
import type { EntitySchema } from '../../../../types/generated/EntitySchema';
import type {
  EntityEditorProps,
  SchemaConfig,
  SchemaSection,
  SchemaField,
  DynamicContainer
} from '../EntityEditor.model';

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
  const loadReferenceData = async () => {
    const entityTypesToLoad = new Set<string>();

    if (ctx.props.entityType) {
      entityTypesToLoad.add(ctx.props.entityType);
    }

    if (ctx.config.value?.sections) {
      ctx.config.value.sections.forEach((sec: SchemaSection) => {
        if (sec.fields) {
          sec.fields.forEach((f: SchemaField) => {
            if (f.entityType) entityTypesToLoad.add(f.entityType);
          });
        }
        if (sec.dynamicContainers) {
          sec.dynamicContainers.forEach((dc: DynamicContainer) => {
            if (dc.foreign_type) entityTypesToLoad.add(dc.foreign_type);
            const tplConf = dc.template && ctx.config.value?.templates ? ctx.config.value.templates[dc.template] : undefined;
            if (tplConf?.foreign_type) entityTypesToLoad.add(tplConf.foreign_type);
            if (dc.fields) {
              dc.fields.forEach((f: SchemaField) => {
                if (f.entityType) entityTypesToLoad.add(f.entityType);
              });
            }
          });
        }
      });
    }

    if (ctx.config.value?.templates) {
      Object.keys(ctx.config.value.templates).forEach(tplKey => {
        const tpl = ctx.config.value?.templates?.[tplKey];
        if (tpl?.foreign_type) entityTypesToLoad.add(tpl.foreign_type);
        if (tpl?.fields) {
          tpl.fields.forEach((f: SchemaField) => {
            if (f.entityType) entityTypesToLoad.add(f.entityType);
          });
        }
        if (tpl?.dynamicContainers) {
          tpl.dynamicContainers.forEach((dc: DynamicContainer) => {
            if (dc.foreign_type) entityTypesToLoad.add(dc.foreign_type);
            if (dc.fields) {
              dc.fields.forEach((f: SchemaField) => {
                if (f.entityType) entityTypesToLoad.add(f.entityType);
              });
            }
          });
        }
      });
    }

    const newRefData: Record<string, Array<{ value: string; label: string }>> = { ...ctx.referenceData.value };
    for (const type of entityTypesToLoad) {
      try {
        const entities = await api.getEntities(ctx.props.project, type);
        const mapped = entities.map((e) => {
          const item = e as Record<string, unknown>;
          return {
            value: String(item.id || ''),
            label: String(item.name || item.title || item.label || 'Без названия')
          };
        });
        newRefData[`${type}_list`] = mapped;
        newRefData[type] = mapped;
      } catch (e) {
        console.error(`Error loading ref data for ${type}:`, e);
      }
    }
    ctx.referenceData.value = newRefData;
  };

  const patchConfig = (cfg: SchemaConfig) => {
    if (cfg?.sections) {
      cfg.sections.forEach((sec: SchemaSection & { items?: Array<Record<string, unknown>> }) => {
        if (sec.items && (!sec.fields || sec.fields.length === 0) && (!sec.dynamicContainers || sec.dynamicContainers.length === 0)) {
          const fields: Array<SchemaField> = [];
          const dynamicContainers: Array<DynamicContainer> = [];
          sec.items.forEach((it: Record<string, unknown>) => {
            if (it.template || it.dataPath || it.type === 'dynamic' || it.type === 'timeline') {
              dynamicContainers.push(it as unknown as DynamicContainer);
            } else {
              fields.push(it as unknown as SchemaField);
            }
          });
          sec.fields = fields;
          sec.dynamicContainers = dynamicContainers;
        }
        if (sec.dynamicContainers) {
          sec.dynamicContainers.forEach((dc: DynamicContainer, idx: number) => {
            if (!dc.id) dc.id = dc.template ? `dyn_${dc.template}` : `dyn_${idx}`;
            if (!dc.dataPath) dc.dataPath = dc.id;
          });
        }
      });
    }
    return cfg;
  };

  const loadConfigAndData = async () => {
    ctx.loading.value = true;
    ctx.isInitializing.value = true;
    try {
      const sandboxConfig = sessionStorage.getItem('sandbox_preview_config');
      if (ctx.props.entityId === 'preview' && sandboxConfig) {
        ctx.config.value = patchConfig(JSON.parse(sandboxConfig));
      } else {
        const schemas = await api.getEntitySchemas(ctx.props.project);
        const foundSchema = schemas.find((s: EntitySchema) => s.type_key === ctx.props.entityType);
        if (foundSchema && foundSchema.full_schema) {
          ctx.config.value = patchConfig(JSON.parse(JSON.stringify(foundSchema.full_schema)));
        } else {
          try {
            const staticTypes = ['character', 'location', 'organization', 'state', 'item', 'event', 'fraction', 'ui_editor'];
            if (staticTypes.includes(ctx.props.entityType)) {
              const res = await fetch(`/struct/editor/${ctx.props.entityType}.json`);
              if (res.ok) {
                ctx.config.value = patchConfig(await res.json());
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

      if (ctx.config.value && ctx.config.value.sections && ctx.config.value.sections.length > 0) {
        if (ctx.props.initialSection && ctx.config.value.sections.some((s: SchemaSection) => s.id === ctx.props.initialSection)) {
          ctx.activeSection.value = ctx.props.initialSection;
        } else {
          ctx.activeSection.value = ctx.config.value.sections[0].id;
        }
        ctx.emit('section-change', ctx.activeSection.value);
      }

      ctx.formData.value = JSON.parse(JSON.stringify(ctx.props.initialData || {}));
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
          if (ctx.scrollContainer.value) ctx.scrollContainer.value.scrollTop = ctx.props.initialScrollPos ?? 0;
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

  return {
    loadReferenceData,
    loadConfigAndData
  };
}
