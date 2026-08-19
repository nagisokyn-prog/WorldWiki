import { describe, it, expect, vi, beforeEach } from 'vitest';
import { tagApi } from '../tag.api';
import { invoke, processIds } from '@worldwiki/components';

vi.mock('@worldwiki/components', () => ({
  invoke: vi.fn(),
  processIds: vi.fn((x) => x),
}));

describe('tagApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getTags calls invoke get_tags and processes ids', async () => {
    const mockTags = [{ id: 'tag1', name: 'Magic', color: '#ff0000' }];
    vi.mocked(invoke).mockResolvedValueOnce(mockTags);

    const res = await tagApi.getTags('my-project');

    expect(invoke).toHaveBeenCalledWith('get_tags', { project: 'my-project' });
    expect(processIds).toHaveBeenCalled();
    expect(res).toEqual(mockTags);
  });

  it('saveTag prepares project_id and calls save_tag', async () => {
    vi.mocked(invoke).mockResolvedValueOnce({ success: true });

    const tagData = { name: 'Technology', color: '#00ff00' };
    const res = await tagApi.saveTag('my-project', tagData);

    expect(invoke).toHaveBeenCalledWith('save_tag', {
      data: {
        name: 'Technology',
        color: '#00ff00',
        project_id: 'projects:my-project',
      },
    });
    expect(res).toEqual({ success: true });
  });

  it('deleteTag calls delete_tag', async () => {
    vi.mocked(invoke).mockResolvedValueOnce({ success: true });

    const res = await tagApi.deleteTag('my-project', 'tag_123');

    expect(invoke).toHaveBeenCalledWith('delete_tag', { id: 'tag_123' });
    expect(res).toEqual({ success: true });
  });
});
