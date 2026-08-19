import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { useSchemaData } from '../useSchemaData';
import * as api from '../../../../../../services/api.client';

vi.mock('../../../../../../services/api.client', () => ({
  getEntitySchemas: vi.fn(),
}));

describe('useSchemaData', () => {
  let props: any;
  let emit: any;
  let localEntityType: any;
  let scrollContainer: any;

  beforeEach(() => {
    vi.clearAllMocks();
    props = { project: 'p1', entityType: 'character' };
    emit = vi.fn();
    localEntityType = ref('character');
    scrollContainer = ref(null);
  });

  it('loads schema from getEntitySchemas and parses items', async () => {
    vi.mocked(api.getEntitySchemas).mockResolvedValueOnce([
      {
        type_key: 'character',
        full_schema: {
          sections: [
            {
              id: 'sec_1',
              title: 'Main',
              fields: [{ type: 'text', class: 'name' }],
              dynamicContainers: [{ id: 'dc1', template: 'timeline' }],
            },
          ],
        },
      },
    ] as any);

    const data = useSchemaData(props, emit, localEntityType, scrollContainer);
    await data.loadSchema();

    expect(data.schema.value.sections.length).toBe(1);
    expect(data.schema.value.sections[0].items.length).toBe(2);
    expect(data.activeSection.value.id).toBe('sec_1');
  });

  it('provides jsonPreviewContent and opens preview', () => {
    const data = useSchemaData(props, emit, localEntityType, scrollContainer);
    data.schema.value = {
      sections: [{ id: 's1', title: 'S1' }],
    };

    expect(data.jsonPreviewContent.value).toContain('"entityType": "character"');

    data.openPreview();
    expect(data.isPreviewMode.value).toBe(true);
  });

  it('exports schema JSON', () => {
    const data = useSchemaData(props, emit, localEntityType, scrollContainer);
    data.schema.value = { sections: [] };

    const appendSpy = vi.spyOn(document.body, 'appendChild');
    data.exportSchema();

    expect(appendSpy).toHaveBeenCalled();
    appendSpy.mockRestore();
  });
});
