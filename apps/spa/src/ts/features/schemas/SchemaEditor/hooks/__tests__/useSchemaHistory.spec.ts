import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { useSchemaHistory } from '../useSchemaHistory';
import * as api from '../../../../../../services/api.client';

vi.mock('../../../../../../services/api.client', () => ({
  getSchemaHistory: vi.fn(),
  toggleSchemaHistoryPin: vi.fn(),
}));

describe('useSchemaHistory', () => {
  let props: any;
  let schema: any;
  let loadSchema: any;

  beforeEach(() => {
    vi.clearAllMocks();
    props = { project: 'p1', entityType: 'character' };
    schema = ref({ sections: [] });
    loadSchema = vi.fn();
  });

  it('loads history and formats date', async () => {
    vi.mocked(api.getSchemaHistory).mockResolvedValueOnce([
      { id: 'h1', saved_at: '2024-01-01T10:00:00Z', is_pinned: false },
    ] as any);

    const history = useSchemaHistory(props, schema, loadSchema);
    await history.loadHistory();

    expect(history.schemaHistory.value.length).toBe(1);
    expect(history.schemaHistory.value[0].formattedDate).toBeDefined();
  });

  it('toggles history panel and pin', async () => {
    vi.mocked(api.getSchemaHistory).mockResolvedValueOnce([]);
    vi.mocked(api.toggleSchemaHistoryPin).mockResolvedValueOnce(undefined as any);

    const history = useSchemaHistory(props, schema, loadSchema);
    await history.toggleHistoryPanel();

    expect(history.showHistory.value).toBe(true);

    const item = { id: 'h1', is_pinned: false };
    await history.togglePin(item);

    expect(api.toggleSchemaHistoryPin).toHaveBeenCalledWith('h1', true);
    expect(item.is_pinned).toBe(true);
  });

  it('previews and exits history mode', () => {
    const history = useSchemaHistory(props, schema, loadSchema);
    const snap = {
      id: 'h1',
      snapshot: {
        full_schema: {
          sections: [
            {
              fields: [{ class: 'title' }],
              dynamicContainers: [{ id: 'dc1' }],
            },
          ],
        },
      },
    };

    history.previewHistory(snap);
    expect(history.isHistoryPreviewMode.value).toBe(true);
    expect(schema.value.sections[0].items.length).toBe(2);

    history.exitPreviewMode();
    expect(history.isHistoryPreviewMode.value).toBe(false);
    expect(loadSchema).toHaveBeenCalledWith(false);
  });
});
