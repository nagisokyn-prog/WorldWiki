import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useTagsManagerModal } from './useTagsManagerModal';
import * as api from '@/services/api.client';
import { appConfirm } from '@worldwiki/components';

vi.mock('../../../services/api.client', () => ({
  getEntities: vi.fn(),
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
    vi.mocked(api.getEntities).mockResolvedValueOnce([
      { id: 'e1', tags: ['Magic'] },
    ] as any);

    const modal = useTagsManagerModal(props);

    modal.open();
    expect(modal.isOpen.value).toBe(true);
    expect(modal.loading.value).toBe(true);

    await Promise.resolve();
    expect(modal.tags.value).toEqual([
      { id: 'Magic', project_id: 'my-project', name: 'Magic', color: '#8b5cf6' },
    ]);
    expect(modal.loading.value).toBe(false);

    // Error on load
    vi.mocked(api.getEntities).mockRejectedValueOnce(new Error('Load error'));
    modal.open();
    await Promise.resolve();
    expect(modal.loading.value).toBe(false);

    modal.close();
    expect(modal.isOpen.value).toBe(false);
  });

  it('adds a new tag and handles empty name', async () => {
    const modal = useTagsManagerModal(props);
    modal.newTagName.value = 'Fantasy';
    modal.newTagColor.value = '#00ff00';

    await modal.addTag();
    expect(modal.tags.value.some((t) => t.name === 'Fantasy')).toBe(true);
    expect(modal.newTagName.value).toBe('');

    // empty name
    modal.newTagName.value = '   ';
    await modal.addTag();
    expect(modal.tags.value.length).toBe(1);
  });

  it('updates an existing tag', async () => {
    const modal = useTagsManagerModal(props);
    modal.tags.value = [{ id: 'tag_1', name: 'Old', color: '#111', project_id: 'my-project' }];
    const tag = { id: 'tag_1', name: 'Updated', color: '#999', project_id: 'my-project' };

    await modal.updateTag(tag);
    expect(modal.tags.value[0].name).toBe('Updated');
  });

  it('deletes tag on confirm and handles cancel', async () => {
    const modal = useTagsManagerModal(props);
    modal.tags.value = [{ id: 'tag_1', name: 'Tag 1', color: '#111', project_id: 'my-project' }];

    // Cancel deletion
    vi.mocked(appConfirm).mockResolvedValueOnce(false);
    await modal.deleteTag('tag_1');
    expect(modal.tags.value.length).toBe(1);

    // Confirm deletion
    vi.mocked(appConfirm).mockResolvedValueOnce(true);
    await modal.deleteTag('tag_1');
    expect(modal.tags.value.length).toBe(0);
  });
});
