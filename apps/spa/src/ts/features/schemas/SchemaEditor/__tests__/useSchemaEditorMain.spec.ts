import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSchemaEditorMain } from '../useSchemaEditorMain';
import * as api from '../../../../services/api.client';

vi.mock('../../../../services/api.client', () => ({
  getEntitySchemas: vi.fn().mockResolvedValue([]),
  saveEntitySchema: vi.fn(),
  getSchemaHistory: vi.fn().mockResolvedValue([]),
}));

vi.mock('@worldwiki/components', () => ({
  appAlert: vi.fn(),
}));

describe('useSchemaEditorMain', () => {
  let props: any;
  let emit: any;

  beforeEach(() => {
    vi.clearAllMocks();
    props = {
      project: 'p1',
      entityType: 'character',
      schemaType: 'character',
    };
    emit = vi.fn();
  });

  it('initializes and saves schema', async () => {
    vi.mocked(api.saveEntitySchema).mockResolvedValueOnce(undefined as any);

    const main = useSchemaEditorMain(props, emit);

    main.schema.value = {
      sections: [
        {
          id: 'sec_1',
          items: [{ type: 'text', class: 'name', label: 'NAME' }],
        },
      ],
    };

    await main.saveSchema();

    expect(api.saveEntitySchema).toHaveBeenCalledWith('p1', expect.objectContaining({
      type_key: 'character',
      id: 'entity_schemas:character',
    }), 30);
  });

  it('handles keyboard shortcuts to toggle catalog', () => {
    const main = useSchemaEditorMain(props, emit);
    expect(main.showCatalog.value).toBe(true);

    const event = new KeyboardEvent('keydown', {
      ctrlKey: true,
      shiftKey: true,
      code: 'KeyB',
    });
    window.dispatchEvent(event);
  });
});
