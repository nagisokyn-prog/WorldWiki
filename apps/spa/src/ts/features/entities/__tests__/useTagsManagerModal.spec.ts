import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useTagsManagerModal } from '../useTagsManagerModal';
import * as api from '../../../services/api.client';

vi.mock('../../../services/api.client', () => ({
  getTags: vi.fn(),
  saveTag: vi.fn(),
  deleteEntity: vi.fn(),
}));

vi.mock('@worldwiki/components', () => ({
  appConfirm: vi.fn(() => Promise.resolve(true)),
}));

describe('useTagsManagerModal', () => {
  let props: any;

  beforeEach(() => {
    vi.clearAllMocks();
    props = { project: 'my-project' };
  });

  it('opens, closes and loads tags', async () => {
    const mockTags = [{ id: 'tag_1', name: 'Magic', color: '#ff0000' }];
    vi.mocked(api.getTags).mockResolvedValueOnce(mockTags as any);

    const modal = useTagsManagerModal(props);

    modal.open();
    expect(modal.isOpen.value).toBe(true);
    expect(modal.loading.value).toBe(true);

    await Promise.resolve();
    expect(modal.tags.value).toEqual(mockTags);
    expect(modal.loading.value).toBe(false);

    modal.close();
    expect(modal.isOpen.value).toBe(false);
  });

  it('adds a new tag', async () => {
    vi.mocked(api.saveTag).mockResolvedValueOnce(undefined as any);
    vi.mocked(api.getTags).mockResolvedValueOnce([]);

    const modal = useTagsManagerModal(props);
    modal.newTagName.value = 'Fantasy';
    modal.newTagColor.value = '#00ff00';

    await modal.addTag();

    expect(api.saveTag).toHaveBeenCalledWith('my-project', {
      project_id: 'projects:my-project',
      name: 'Fantasy',
      color: '#00ff00',
      id: null,
    });
    expect(modal.newTagName.value).toBe('');
  });

  it('does nothing if new tag name is empty', async () => {
    const modal = useTagsManagerModal(props);
    modal.newTagName.value = '   ';

    await modal.addTag();

    expect(api.saveTag).not.toHaveBeenCalled();
  });

  it('updates an existing tag', async () => {
    vi.mocked(api.saveTag).mockResolvedValueOnce(undefined as any);

    const modal = useTagsManagerModal(props);
    const tag = { id: 'tag_1', name: 'Updated' };

    await modal.updateTag(tag);

    expect(api.saveTag).toHaveBeenCalledWith('my-project', {
      id: 'tag_1',
      name: 'Updated',
      project_id: 'my-project',
    });
  });

  it('deletes tag on confirm', async () => {
    vi.mocked(api.deleteEntity).mockResolvedValueOnce(undefined as any);
    vi.mocked(api.getTags).mockResolvedValueOnce([]);

    const modal = useTagsManagerModal(props);
    await modal.deleteTag('tag_1');

    expect(api.deleteEntity).toHaveBeenCalledWith('tag_1');
    expect(api.getTags).toHaveBeenCalled();
  });
});
