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

  it('covers useEntitySectionFields getters, inputs, multiselect, and ongoing toggles', async () => {
    const { useEntitySectionFields } = await import('./useEntitySectionFields');
    const state: Record<string, unknown> = {
      name: 'Arthur',
      tags: ['hero'],
      dateObj: { ongoing: true },
      dateAbs: { m_abs: 10 },
    };
    const photoInputs: Record<string, HTMLInputElement> = {};
    const emit = vi.fn();

    const hooks = useEntitySectionFields(
      {
        fields: [],
        project: 'p1',
        photoInputs,
        isFieldHidden: vi.fn(() => false),
        canHideField: vi.fn(() => true),
        isFieldChanged: vi.fn(() => false),
        getProp: vi.fn((k: string) => state[k]),
        setProp: vi.fn((k: string, v: unknown) => {
          state[k] = v;
        }),
        getPhotoUrl: vi.fn(() => ''),
        triggerPhotoUpload: vi.fn(),
        handlePhotoFile: vi.fn(),
        handlePhotoDrop: vi.fn(),
        removePhoto: vi.fn(),
        isChapterField: vi.fn(() => false),
        getOptionsFor: vi.fn(() => []),
      } as never,
      emit
    );

    const fName = { path: 'name' } as never;
    const fTags = { id: 'tags' } as never;
    expect(hooks.getFieldValue(fName)).toBe('Arthur');
    expect(hooks.getManuscriptPointValue(fName)).toBe('Arthur');
    expect(hooks.getDatePickerValue({ path: 'dateObj' } as never)).toEqual({ ongoing: true });
    expect(hooks.getTagsValue(fTags)).toEqual(['hero']);
    expect(hooks.isMultiselectChecked(fTags, 'hero')).toBe(true);

    hooks.setPhotoInput('avatar', { tagName: 'INPUT' });
    expect(photoInputs.avatar).toBeDefined();

    hooks.handleTextareaInput('bio', { target: { value: 'Bio' } } as unknown as Event);
    hooks.handleTextInput('name', { target: { value: 'Merlin' } } as unknown as Event);
    hooks.handleMultiselectEvent('tags', 'mage', { target: { checked: true } } as unknown as Event);
    hooks.handleMultiselectEvent('tags', 'hero', { target: { checked: false } } as unknown as Event);
    hooks.handleFieldUpdate('custom', 123);
    expect(state.tags).toEqual(['mage']);
    expect(state.custom).toBe(123);

    expect(hooks.isFieldOngoing({ path: 'missing' } as never)).toBe(true);
    expect(hooks.isFieldOngoing({ path: 'dateObj' } as never)).toBe(true);
    expect(hooks.isFieldOngoing({ path: 'dateAbs' } as never)).toBe(false);
    expect(hooks.isFieldOngoing(fName)).toBe(false);

    hooks.toggleFieldOngoing({ path: 'dateObj' } as never, { target: { checked: true } } as unknown as Event);
    expect(state.dateObj).toBeNull();
    hooks.toggleFieldOngoing({ path: 'dateObj' } as never, { target: { checked: false } } as unknown as Event);
    expect(state.dateObj).toEqual({ ongoing: false });
  });
});

