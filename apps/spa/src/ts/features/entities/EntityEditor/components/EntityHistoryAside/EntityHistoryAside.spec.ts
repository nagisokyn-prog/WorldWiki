import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import EntityHistoryAside from './EntityHistoryAside.vue';

describe('EntityHistoryAside', () => {
  it('renders revisions and emits events', async () => {
    const revisions = [
      { id: 'rev-1', formattedDate: '10:00 01.01', is_pinned: false, created_at: '', content: {} },
      { id: 'rev-2', formattedDate: '09:00 01.01', is_pinned: true, created_at: '', content: {} },
    ];
    const getDiffSummary = vi.fn().mockReturnValue('Изменено поле');

    const wrapper = mount(EntityHistoryAside, {
      props: {
        maxSaves: 10,
        isLoading: false,
        revisions,
        previewingRevId: 'rev-1',
        getDiffSummary,
      },
    });

    expect(wrapper.text()).toContain('История изменений');
    expect(wrapper.text()).toContain('10:00 01.01');
    expect(wrapper.find('.preview-badge-warning').exists()).toBe(true);

    const items = wrapper.findAll('.catalog-item');
    await items[0].trigger('click');
    expect(wrapper.emitted('preview')).toBeDefined();

    const pinBtn = wrapper.find('button[title="Закрепить от удаления"]');
    await pinBtn.trigger('click');
    expect(wrapper.emitted('togglePin')).toBeDefined();
  });
});
