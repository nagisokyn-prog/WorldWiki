import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useTagsManagerModal } from '../useTagsManagerModal';
import * as api from '../../../services/api.client';
import { appConfirm } from '@worldwiki/components';

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

  it('opens, closes and loads tags with error catch', async () => {
    const mockTags = [{ id: 'tag_1', name: 'Magic', color: '#ff0000' }];
    vi.mocked(api.getTags).mockResolvedValueOnce(mockTags as any);

    const modal = useTagsManagerModal(props);

    modal.open();
    expect(modal.isOpen.value).toBe(true);
    expect(modal.loading.value).toBe(true);

    await Promise.resolve();
    expect(modal.tags.value).toEqual(mockTags);
    expect(modal.loading.value).toBe(false);

    // Error on load
    vi.mocked(api.getTags).mockRejectedValueOnce(new Error('Load error'));
    await modal.loadTags();
    expect(modal.loading.value).toBe(false);

    modal.close();
    expect(modal.isOpen.value).toBe(false);
  });

  it('adds a new tag and handles error', async () => {
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

    // Error on addTag
    modal.newTagName.value = 'Fantasy';
    vi.mocked(api.saveTag).mockRejectedValueOnce(new Error('Save error'));
    await modal.addTag();
  });

  it('does nothing if new tag name is empty', async () => {
    const modal = useTagsManagerModal(props);
    modal.newTagName.value = '   ';

    await modal.addTag();
    expect(api.saveTag).not.toHaveBeenCalled();
  });

  it('updates an existing tag with and without existing project_id and handles error', async () => {
    vi.mocked(api.saveTag).mockResolvedValueOnce(undefined as any);

    const modal = useTagsManagerModal(props);
    const tag = { id: 'tag_1', name: 'Updated' };

    await modal.updateTag(tag);
    expect(api.saveTag).toHaveBeenCalledWith('my-project', {
      id: 'tag_1',
      name: 'Updated',
      project_id: 'my-project',
    });

    // With existing project_id
    await modal.updateTag({ id: 'tag_2', project_id: 'other_proj' });

    // Error on updateTag
    vi.mocked(api.saveTag).mockRejectedValueOnce(new Error('Update error'));
    await modal.updateTag(tag);
  });

  it('deletes tag on confirm and handles cancel and error', async () => {
    const modal = useTagsManagerModal(props);

    // Cancel deletion
    vi.mocked(appConfirm).mockResolvedValueOnce(false);
    await modal.deleteTag('tag_1');
    expect(api.deleteEntity).not.toHaveBeenCalled();

    // Confirm deletion
    vi.mocked(appConfirm).mockResolvedValueOnce(true);
    vi.mocked(api.deleteEntity).mockResolvedValueOnce(undefined as any);
    vi.mocked(api.getTags).mockResolvedValueOnce([]);

    await modal.deleteTag('tag_1');
    expect(api.deleteEntity).toHaveBeenCalledWith('tag_1');
    expect(api.getTags).toHaveBeenCalled();

    // Error on deletion
    vi.mocked(appConfirm).mockResolvedValueOnce(true);
    vi.mocked(api.deleteEntity).mockRejectedValueOnce(new Error('Delete error'));
    await modal.deleteTag('tag_1');
  });
});
