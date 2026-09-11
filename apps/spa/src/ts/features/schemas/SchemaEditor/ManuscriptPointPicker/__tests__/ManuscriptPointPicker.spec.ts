import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { nextTick } from 'vue';

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {})
}));

import { useChapterStore } from '../../../../../stores/chapter.store';
import { useManuscriptPointPicker } from '../useManuscriptPointPicker';

describe('useManuscriptPointPicker', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  const setupMockHierarchy = () => {
    const chapterStore = useChapterStore();
    chapterStore.hierarchy = {
      volumes: [
        { id: 'volumes:v1', title: 'Том 1' },
        { id: 'volumes:v2', title: 'Том 2 (Пустой)' }
      ],
      chapters: [
        { id: 'chapters:c1', title: 'Глава 1', volume_id: 'volumes:v1' },
        { id: 'chapters:c2', title: 'Глава 2', volume_id: 'volumes:v1' },
        { id: 'chapters:c3', title: 'Глава 3 (Последняя)', volume_id: 'volumes:v1' }
      ]
    };
    return chapterStore;
  };

  it('initializes with default empty values when modelValue is null', () => {
    setupMockHierarchy();
    const emit = vi.fn();
    const picker = useManuscriptPointPicker({ modelValue: null }, emit);

    expect(picker.internalPoint.value).toEqual({
      volume_id: null,
      chapter_id: null,
      is_auto_extend: false
    });
  });

  it('parses legacy string chapter ID and resolves parent volume', () => {
    setupMockHierarchy();
    const emit = vi.fn();
    const picker = useManuscriptPointPicker({ modelValue: 'chapters:c2' }, emit);

    expect(picker.internalPoint.value.chapter_id).toBe('chapters:c2');
    expect(picker.internalPoint.value.volume_id).toBe('volumes:v1');
    expect(picker.internalPoint.value.is_auto_extend).toBe(false);
  });

  it('filters chapter options based on selected volume', () => {
    setupMockHierarchy();
    const emit = vi.fn();
    const picker = useManuscriptPointPicker({ modelValue: { volume_id: 'volumes:v1' } }, emit);

    const chapterValues = picker.chapterOptions.value.map(o => o.value);
    expect(chapterValues).toContain('c1');
    expect(chapterValues).toContain('c2');
    expect(chapterValues).toContain('c3');
  });

  it('cascades reset when volume changes and current chapter is invalid', () => {
    setupMockHierarchy();
    const emit = vi.fn();
    const picker = useManuscriptPointPicker({
      modelValue: { volume_id: 'volumes:v1', chapter_id: 'chapters:c1' }
    }, emit);

    // Меняем том на v2 (в котором нет главы c1)
    picker.onVolumeChange('v2');

    expect(picker.internalPoint.value.volume_id).toBe('volumes:v2');
    expect(picker.internalPoint.value.chapter_id).toBeNull();
    expect(emit).toHaveBeenCalledWith('update:modelValue', expect.objectContaining({
      volume_id: 'volumes:v2',
      chapter_id: null
    }));
  });

  it('toggles auto-extend and sets point to the latest valid chapter', () => {
    setupMockHierarchy();
    const emit = vi.fn();
    const picker = useManuscriptPointPicker({
      modelValue: { volume_id: 'volumes:v1', chapter_id: 'chapters:c1', is_auto_extend: false }
    }, emit);

    picker.toggleAutoExtend();

    expect(picker.internalPoint.value.is_auto_extend).toBe(true);
    // Последняя глава в фикстуре — c3 (в v1). v2 пустой и должен игнорироваться!
    expect(picker.internalPoint.value.chapter_id).toBe('chapters:c3');
    expect(picker.internalPoint.value.volume_id).toBe('volumes:v1');
  });

  it('does not extend if disabled prop is true', () => {
    setupMockHierarchy();
    const emit = vi.fn();
    const picker = useManuscriptPointPicker({
      modelValue: null,
      disabled: true
    }, emit);

    picker.toggleAutoExtend();
    expect(picker.internalPoint.value.is_auto_extend).toBe(false);
  });

  it('updates point immediately when ww:timeline-auto-extended custom event fires', () => {
    setupMockHierarchy();
    const emit = vi.fn();
    const picker = useManuscriptPointPicker({
      modelValue: { volume_id: 'volumes:v1', chapter_id: 'chapters:c1', is_auto_extend: true }
    }, emit);

    document.dispatchEvent(new CustomEvent('ww:timeline-auto-extended', {
      detail: { chapter_id: 'chapters:c99', volume_id: 'volumes:v5' }
    }));

    expect(picker.internalPoint.value.chapter_id).toBe('chapters:c99');
    expect(picker.internalPoint.value.volume_id).toBe('volumes:v5');
    expect(emit).toHaveBeenCalledWith('update:modelValue', expect.objectContaining({
      chapter_id: 'chapters:c99',
      volume_id: 'volumes:v5'
    }));
  });

  it('rolls back point when chapter is deleted and hierarchy changes', async () => {
    const store = setupMockHierarchy();
    const emit = vi.fn();
    const picker = useManuscriptPointPicker({
      modelValue: { volume_id: 'volumes:v1', chapter_id: 'chapters:c3', is_auto_extend: false }
    }, emit);

    store.hierarchy.chapters = store.hierarchy.chapters.filter(c => c.id !== 'chapters:c3');
    await nextTick();

    expect(picker.internalPoint.value.chapter_id).toBe('chapters:c2');
  });
});

