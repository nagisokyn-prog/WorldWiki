import { type Ref, type ShallowRef } from 'vue';
import { useChapterStore } from '../../../../stores/chapter.store';
import type { SchemaConfig, SchemaField } from '../EntityEditor.model';

export interface UseEntityDynamicOpsContext {
  formData: Ref<Record<string, unknown>>;
  foreignUpdates: Ref<Record<string, unknown>>;
  config: ShallowRef<SchemaConfig | null>;
  getDynamicList: (path: string) => Array<Record<string, unknown>>;
  setProp: (targetOrPath: unknown, pathOrVal: unknown, val?: unknown) => void;
  markModified: () => void;
}

export function useEntityDynamicOps(ctx: UseEntityDynamicOpsContext) {
  const handleForeignUpdate = (e: {
    foreignPath?: string;
    value?: unknown;
    entityType?: string;
    entityId?: string;
    [key: string]: unknown;
  }) => {
    if (e.foreignPath) {
      const parts = e.foreignPath.split('.');
      let current: Record<string, unknown> = ctx.foreignUpdates.value;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) current[parts[i]] = {};
        current = current[parts[i]] as Record<string, unknown>;
      }
      current[parts[parts.length - 1]] = e.value;
      ctx.markModified();
    } else if (e.entityType && e.entityId) {
      const updateKey = `${e.entityType}:${e.entityId}`;
      ctx.foreignUpdates.value = {
        ...ctx.foreignUpdates.value,
        [updateKey]: e
      };
      ctx.markModified();
    }
  };

  const onDynamicUpdate = (e: {
    localPath?: string;
    foreignPath?: string;
    value?: unknown;
    entityType?: string;
    entityId?: string;
    [key: string]: unknown;
  }) => {
    if (e.localPath) {
      ctx.setProp(e.localPath, e.value);
    } else if (e.foreignPath) {
      handleForeignUpdate(e);
    }
  };

  const addDynamicItem = (
    path: string,
    templateNameOrObj: string | { fields?: SchemaField[]; [key: string]: unknown }
  ) => {
    if (!path) {
      console.warn('addDynamicItem: path is undefined, container lacks dataPath and id in schema');
      return;
    }
    const arr = ctx.getDynamicList(path);
    const tpl = typeof templateNameOrObj === 'string'
      ? ctx.config.value?.templates?.[templateNameOrObj]
      : templateNameOrObj;
    if (!tpl) return;
    const newItem: Record<string, unknown> = {};
    if (tpl.fields) {
      tpl.fields.forEach((f: SchemaField & { default?: unknown }) => {
        if (f.class) {
          newItem[f.class] = f.default !== undefined ? f.default : '';
        }
      });
    }

    // Эстафета этапов для timeline-модулей (начальная_глава / конечная_глава)
    const lastItem = arr.length > 0 ? arr[arr.length - 1] : null;
    if (lastItem && lastItem['конечная_глава']) {
      const prevEnd = typeof lastItem['конечная_глава'] === 'object' && lastItem['конечная_глава'] !== null
        ? JSON.parse(JSON.stringify(lastItem['конечная_глава']))
        : { chapter_id: String(lastItem['конечная_глава']) };

      newItem['начальная_глава'] = { ...prevEnd, is_auto_extend: false };
      const hadAutoExtend = Boolean(prevEnd.is_auto_extend);
      newItem['конечная_глава'] = { ...prevEnd, is_auto_extend: hadAutoExtend };

      if (typeof lastItem['конечная_глава'] === 'object' && lastItem['конечная_глава'] !== null) {
        (lastItem['конечная_глава'] as Record<string, unknown>).is_auto_extend = false;
      }
    } else if (newItem['начальная_глава'] !== undefined || newItem['конечная_глава'] !== undefined) {
      try {
        const chapterStore = useChapterStore();
        const hier = chapterStore.hierarchy;
        if (hier?.chapters && hier.chapters.length > 0) {
          const lastCh = hier.chapters[hier.chapters.length - 1];
          const initialPoint = {
            chapter_id: lastCh.id,
            volume_id: lastCh.volume_id || null,
            is_auto_extend: true
          };
          if (newItem['начальная_глава'] !== undefined) newItem['начальная_глава'] = { ...initialPoint, is_auto_extend: false };
          if (newItem['конечная_глава'] !== undefined) newItem['конечная_глава'] = { ...initialPoint, is_auto_extend: true };
        }
      } catch (err) {
        console.warn('[useEntityDynamicOps] Failed to read chapter hierarchy from pinia store:', err);
      }
    }

    ctx.setProp(ctx.formData.value, path, [...arr, newItem]);
    ctx.markModified();
  };

  const removeDynamicItem = (path: string, idx: number | string) => {
    if (!path) return;
    const currentList = ctx.getDynamicList(path);
    const nextArr = [...currentList];
    const numIdx = typeof idx === 'number' ? idx : parseInt(String(idx), 10);

    if (!isNaN(numIdx) && numIdx >= 0 && numIdx < nextArr.length) {
      nextArr.splice(numIdx, 1);
      ctx.setProp(ctx.formData.value, path, nextArr);
      ctx.markModified();
    } else if (nextArr.length <= 1) {
      ctx.setProp(ctx.formData.value, path, []);
      ctx.markModified();
    }
  };

  return {
    handleForeignUpdate,
    onDynamicUpdate,
    addDynamicItem,
    removeDynamicItem
  };
}
