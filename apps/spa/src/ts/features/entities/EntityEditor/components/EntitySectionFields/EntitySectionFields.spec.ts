import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import EntitySectionFields from './EntitySectionFields.vue';

describe('EntitySectionFields', () => {
  it('renders fields and handles input', async () => {
    const fields = [
      { id: 'f_name', label: 'Имя', type: 'text', path: 'name' },
      { id: 'f_bio', label: 'Биография', type: 'textarea', path: 'bio' },
    ];
    const setProp = vi.fn();
    const getProp = vi.fn((p) => (p === 'name' ? 'Arthur' : ''));

    const wrapper = mount(EntitySectionFields, {
      props: {
        fields,
        project: 'p1',
        photoInputs: {},
        isFieldHidden: vi.fn(() => false),
        canHideField: vi.fn(() => true),
        isFieldChanged: vi.fn(() => false),
        getProp,
        setProp,
        getPhotoUrl: vi.fn(() => ''),
        triggerPhotoUpload: vi.fn(),
        handlePhotoFile: vi.fn(),
        handlePhotoDrop: vi.fn(),
        removePhoto: vi.fn(),
        isChapterField: vi.fn(() => false),
        getOptionsFor: vi.fn(() => []),
      },
    });

    expect(wrapper.text()).toContain('Имя');
    expect(wrapper.text()).toContain('Биография');

    const input = wrapper.find('input[type="text"]');
    await input.setValue('Merlin');
    expect(setProp).toHaveBeenCalledWith('name', 'Merlin');
    expect(wrapper.emitted('modified')).toBeDefined();

    const hideBtn = wrapper.find('.field-hide-btn');
    await hideBtn.trigger('click');
    expect(wrapper.emitted('hideField')).toEqual([['name']]);
  });
});

