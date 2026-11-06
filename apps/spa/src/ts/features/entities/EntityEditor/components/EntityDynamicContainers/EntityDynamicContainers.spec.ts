import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import EntityDynamicContainers from './EntityDynamicContainers.vue';

describe('EntityDynamicContainers', () => {
  it('renders containers and handles actions', async () => {
    const containers = [
      { id: 'c1', title: 'Events', dataPath: 'events', template: 'tpl1' },
    ];
    const getDynamicList = vi.fn(() => [{ name: 'Item 1' }]);

    const wrapper = mount(EntityDynamicContainers, {
      props: {
        containers,
        project: 'p1',
        entityId: 'e1',
        entityType: 'character',
        isContainerHidden: vi.fn(() => false),
        isFieldChanged: vi.fn(() => false),
        canHideContainer: vi.fn(() => true),
        getDynamicList,
        areAllCollapsed: vi.fn(() => false),
        getResolvedTemplate: vi.fn(() => null),
        getItemSummary: vi.fn(() => ''),
        getProp: vi.fn(),
        setProp: vi.fn(),
        getOptionsFor: vi.fn(() => []),
        isChapterField: vi.fn(() => false),
        isItemCollapsed: vi.fn(() => false),
      },
    });

    expect(wrapper.text()).toContain('Events');

    const addBtn = wrapper.find('.btn-outline');
    await addBtn.trigger('click');
    expect(wrapper.emitted('addDynamicItem')).toEqual([['events', 'tpl1']]);

    const hideBtn = wrapper.find('.container-hide-btn');
    await hideBtn.trigger('click');
    expect(wrapper.emitted('hideContainer')).toEqual([['events']]);
  });
});

