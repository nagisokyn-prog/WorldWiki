import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { useSchemaHistory } from '../useSchemaHistory';
import * as api from '@/services/api.client';

vi.mock('../../../../../services/api.client', () => ({
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

    // With undefined entityType and null API return (covers line 48 fallbacks)
    vi.mocked(api.getSchemaHistory).mockResolvedValueOnce(null as any);
    const noTypeHistory = useSchemaHistory({ project: 'p1' }, schema, loadSchema);
    await noTypeHistory.loadHistory();
    expect(api.getSchemaHistory).toHaveBeenCalledWith('p1', '');
    expect(noTypeHistory.schemaHistory.value).toEqual([]);
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

  it('handles error catch blocks and preview without full_schema or sections', async () => {
    // 1. catch in loadHistory
    vi.mocked(api.getSchemaHistory).mockRejectedValueOnce(new Error('History fetch error'));
    const history = useSchemaHistory(props, schema, loadSchema);
    await history.loadHistory();

    // 2. toggleHistoryPanel when closing (showHistory -> false)
    history.showHistory.value = true;
    await history.toggleHistoryPanel();
    expect(history.showHistory.value).toBe(false);

    // 3. catch in togglePin
    vi.mocked(api.toggleSchemaHistoryPin).mockRejectedValueOnce(new Error('Pin toggle error'));
    await history.togglePin({ id: 'h_err', is_pinned: false });

    // 4. previewHistory without full_schema or sections
    history.previewHistory({ id: 'h_empty', snapshot: {} });
    history.previewHistory({ id: 'h_no_sec', snapshot: { full_schema: {} } });

    // 5. loadHistory when API returns null
    vi.mocked(api.getSchemaHistory).mockResolvedValueOnce(null as any);
    await history.loadHistory();
    expect(history.schemaHistory.value).toEqual([]);

    // 6. previewHistory with section without fields and without dynamicContainers
    history.previewHistory({
      id: 'h_empty_sec',
      snapshot: {
        full_schema: {
          sections: [{ id: 'sec_without_fields_and_dc' }],
        },
      },
    });
    expect(schema.value.sections[0].items).toEqual([]);
  });
});

