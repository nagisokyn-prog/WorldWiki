import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref } from 'vue';
import { useSchemaData } from '../useSchemaData';
import * as api from '../../../../../services/api.client';
import { appConfirm } from '@worldwiki/components';

vi.mock('../../../../../services/api.client', () => ({
  getEntitySchemas: vi.fn(),
}));

vi.mock('@worldwiki/components', () => ({
  appConfirm: vi.fn(),
}));

describe('useSchemaData', () => {
  let props: any;
  let emit: any;
  let localEntityType: any;
  let scrollContainer: any;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    props = { project: 'p1', entityType: 'character' };
    emit = vi.fn();
    localEntityType = ref('character');
    scrollContainer = ref({ scrollTop: 0 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('loads schema from getEntitySchemas, fixes dynamicContainers IDs, and handles initial scroll', async () => {
    vi.mocked(api.getEntitySchemas).mockResolvedValueOnce([
      {
        type_key: 'character',
        full_schema: {
          sections: [
            {
              id: 'sec_1',
              title: 'Main',
              fields: [{ type: 'text', class: 'name' }],
              dynamicContainers: [
                { template: 'timeline' }, // missing id and dataPath
                { id: 'dc2', dataPath: 'dc2' },
              ],
            },
          ],
        },
      },
    ] as any);

    props.initialSection = 'sec_1';
    props.initialScrollPos = 150;

    const data = useSchemaData(props, emit, localEntityType, scrollContainer);
    await data.loadSchema();

    expect(data.schema.value.sections.length).toBe(1);
    expect(data.schema.value.sections[0].dynamicContainers[0].id).toBe('dyn_timeline');
    expect(data.schema.value.sections[0].dynamicContainers[0].dataPath).toBe('dyn_timeline');

    vi.advanceTimersByTime(100);
    expect(scrollContainer.value.scrollTop).toBe(150);
  });

  it('loads schema fallback from fetch and default fallback when fetch fails', async () => {
    // When getEntitySchemas returns empty and fetch succeeds
    vi.mocked(api.getEntitySchemas).mockResolvedValueOnce([] as any);
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        sections: [{ id: 'fetch_sec', title: 'Fetched' }],
      }),
    } as any);

    const data = useSchemaData(props, emit, localEntityType, scrollContainer);
    await data.loadSchema();
    expect(data.schema.value.sections[0].id).toBe('fetch_sec');

    // When fetch fails with network error
    vi.mocked(api.getEntitySchemas).mockResolvedValueOnce([] as any);
    global.fetch = vi.fn().mockRejectedValueOnce(new Error('Fetch failed'));

    await data.loadSchema();
    expect(data.schema.value.sections[0].id).toBe('page_main');
  });

  it('handles addNewPage, deleteSection confirmations, and protections', async () => {
    const data = useSchemaData(props, emit, localEntityType, scrollContainer);
    data.schema.value = {
      sections: [
        { id: 'page_main', title: 'Page 1', items: [{ class: 'name' }] },
        { id: 'page_2', title: 'Page 2', items: [{ class: 'bio' }] },
      ],
    };

    // Add new page
    data.addNewPage();
    expect(data.schema.value.sections.length).toBe(3);
    expect(data.activeSectionIdx.value).toBe(2);

    // Cannot delete page 0
    await data.deleteSection(0);
    expect(data.schema.value.sections.length).toBe(3);

    // Cancel deletion
    vi.mocked(appConfirm).mockResolvedValueOnce(false);
    await data.deleteSection(2);
    expect(data.schema.value.sections.length).toBe(3);

    // Confirm deletion
    vi.mocked(appConfirm).mockResolvedValueOnce(true);
    await data.deleteSection(2);
    expect(data.schema.value.sections.length).toBe(2);
    expect(data.activeSectionIdx.value).toBe(1);
  });

  it('removes item with protected system name field guard on index 0', () => {
    const data = useSchemaData(props, emit, localEntityType, scrollContainer);
    data.schema.value = {
      sections: [
        { id: 'page_main', items: [{ class: 'name' }, { class: 'custom' }] },
      ],
    };
    data.activeSectionIdx.value = 0;

    // Protected index 0 in page 0
    data.removeItem(0);
    expect(data.activeSection.value.items.length).toBe(2);

    // Allowed index 1
    data.removeItem(1);
    expect(data.activeSection.value.items.length).toBe(1);
  });
});
