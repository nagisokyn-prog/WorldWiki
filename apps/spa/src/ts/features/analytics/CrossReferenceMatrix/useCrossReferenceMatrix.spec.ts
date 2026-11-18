import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, defineComponent } from 'vue';
import { setActivePinia, createPinia } from 'pinia';
import { mount, flushPromises } from '@vue/test-utils';
import { useCrossReferenceMatrix } from './useCrossReferenceMatrix';
import { useAnalyticsStore } from '@/stores/analytics.store';
import { useChapterStore } from '@/stores/chapter.store';

describe('useCrossReferenceMatrix', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('computes volumeOptions, availableEntityTypes, filteredRows, volumeGroups, and loads data on mount/watch', async () => {
    const analyticsStore = useAnalyticsStore();
    const chapterStore = useChapterStore();
    analyticsStore.loadMatrix = vi.fn(async () => undefined) as any;
    chapterStore.loadChapters = vi.fn(async () => undefined) as any;

    chapterStore.hierarchy = {
      volumes: [{ id: 'volumes:v1', title: 'Том 1', sort_order: 1 }, { id: '', title: '' }],
      chapters: [
        { id: 'chapters:c1', volume_id: 'volumes:v1', sort_order: 1, title: 'Г1' },
        { id: 'chapters:c2', volume_id: 'volumes:v2', sort_order: 2, title: 'Г2' },
      ],
    } as any;

    analyticsStore.matrixData = {
      chapters: [
        { id: 'chapters:c1', volume_id: 'volumes:v1', sort_order: 1, title: 'Г1', word_count: 500 },
        { id: 'chapters:c2', volume_id: 'volumes:v2', sort_order: 2, title: 'Г2', word_count: 800 },
        { id: 'chapters:c3', sort_order: 0, title: 'Вне тома', word_count: 100 },
      ],
      entities: [
        {
          entity_id: 'e1',
          entity_name: 'Алиса',
          entity_type: 'character',
          is_deceased: false,
          appearances: [{ chapter_id: 'chapters:c1', has_scene: true, count: 1 }],
        },
        {
          entity_id: 'e2',
          entity_name: 'Призрак',
          entity_type: 'character',
          is_deceased: true,
          appearances: [],
        },
      ],
    } as any;

    const projRef = ref('');
    let matrix!: ReturnType<typeof useCrossReferenceMatrix>;
    const Comp = defineComponent({
      setup() {
        matrix = useCrossReferenceMatrix(projRef);
        return {};
      },
      template: '<div></div>',
    });

    const wrapper = mount(Comp);
    await flushPromises();

    expect(matrix.volumeOptions.value.length).toBeGreaterThanOrEqual(3);
    expect(matrix.availableEntityTypes.value).toEqual(['character']);
    expect(matrix.volumeGroups.value.length).toBeGreaterThanOrEqual(2);

    matrix.filters.value.selectedVolumeId = 'v1';
    expect(matrix.chapterColumns.value.length).toBe(1);

    matrix.filters.value.selectedVolumeId = 'all';
    matrix.filters.value.showDeceasedOnly = true;
    expect(matrix.rows.value).toHaveLength(1);

    projRef.value = 'proj_updated';
    await flushPromises();
    expect(analyticsStore.loadMatrix).toHaveBeenCalledWith('proj_updated', false);

    wrapper.unmount();
  });
});
