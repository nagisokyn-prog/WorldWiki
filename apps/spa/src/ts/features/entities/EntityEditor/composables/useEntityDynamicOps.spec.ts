import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, shallowRef } from 'vue';
import { setActivePinia, createPinia } from 'pinia';
import { useEntityDynamicOps } from './useEntityDynamicOps';
import { useChapterStore } from '@/stores/chapter.store';
import type { SchemaConfig } from '../EntityEditor.model';

describe('useEntityDynamicOps', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  const makeOps = () => {
    const formData = ref<Record<string, unknown>>({ events: [] });
    const foreignUpdates = ref<Record<string, unknown>>({});
    const config = shallowRef<SchemaConfig | null>({
      templates: {
        tpl_stage: {
          fields: [
            { class: 'title', default: 'Этап' },
            { class: 'начальная_глава' },
            { class: 'конечная_глава' },
          ],
        },
      },
    } as unknown as SchemaConfig);
    const setProp = vi.fn((targetOrPath: unknown, pathOrVal: unknown, val?: unknown) => {
      if (typeof targetOrPath === 'string') {
        formData.value[targetOrPath] = pathOrVal;
      } else if (typeof pathOrVal === 'string') {
        (targetOrPath as Record<string, unknown>)[pathOrVal] = val;
      }
    });
    const markModified = vi.fn();
    const getDynamicList = vi.fn((path: string) => (formData.value[path] as Array<Record<string, unknown>>) || []);

    const ops = useEntityDynamicOps({
      formData,
      foreignUpdates,
      config,
      getDynamicList,
      setProp,
      markModified,
    });

    return { ops, formData, foreignUpdates, setProp, markModified };
  };

  it('handles foreign and dynamic updates', () => {
    const { ops, foreignUpdates, setProp, markModified } = makeOps();

    ops.onDynamicUpdate({ localPath: 'a.b', value: 1 });
    expect(setProp).toHaveBeenCalledWith('a.b', 1);

    ops.onDynamicUpdate({ foreignPath: 'rel.name', value: 'New' });
    expect((foreignUpdates.value.rel as Record<string, unknown>).name).toBe('New');
    expect(markModified).toHaveBeenCalledTimes(1);

    ops.handleForeignUpdate({ entityType: 'character', entityId: 'c1', name: 'Hero' });
    expect(foreignUpdates.value['character:c1']).toBeDefined();
    expect(markModified).toHaveBeenCalledTimes(2);
  });

  it('adds dynamic items with chapter relay and initial hierarchy fallback', () => {
    const chapterStore = useChapterStore();
    chapterStore.hierarchy = {
      volumes: [],
      chapters: [{ id: 'chapters:1', volume_id: 'volumes:1', title: 'Ch1' } as never],
    };

    const { ops, formData } = makeOps();

    // Missing path guard
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    ops.addDynamicItem('', 'tpl_stage');
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();

    // First item initializes from chapterStore.hierarchy
    ops.addDynamicItem('events', 'tpl_stage');
    const events = formData.value.events as Array<Record<string, unknown>>;
    expect(events).toHaveLength(1);
    expect((events[0]['конечная_глава'] as Record<string, unknown>).chapter_id).toBe('chapters:1');

    // Second item relays конечная_глава -> начальная_глава
    ops.addDynamicItem('events', 'tpl_stage');
    const events2 = formData.value.events as Array<Record<string, unknown>>;
    expect(events2).toHaveLength(2);
    expect((events2[0]['конечная_глава'] as Record<string, unknown>).is_auto_extend).toBe(false);
    expect((events2[1]['начальная_глава'] as Record<string, unknown>).chapter_id).toBe('chapters:1');
  });

  it('toggles collapse state and removes dynamic items', () => {
    const { ops, formData, markModified } = makeOps();
    formData.value.events = [{ title: '1' }, { title: '2' }];

    expect(ops.isItemCollapsed('events', 0)).toBe(false);
    ops.toggleItemCollapse('events', 0);
    expect(ops.isItemCollapsed('events', 0)).toBe(true);
    expect(ops.areAllCollapsed('events', 2)).toBe(false);

    ops.toggleAllCollapse('events', 2);
    expect(ops.areAllCollapsed('events', 2)).toBe(true);
    ops.toggleAllCollapse('events', 2);
    expect(ops.areAllCollapsed('events', 2)).toBe(false);

    ops.removeDynamicItem('events', 0);
    expect(formData.value.events).toHaveLength(1);
    expect(markModified).toHaveBeenCalled();

    ops.removeDynamicItem('events', 'invalid');
    expect(formData.value.events).toEqual([]);
  });
});
