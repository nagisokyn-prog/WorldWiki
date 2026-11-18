import { describe, it, expect, vi, beforeEach } from 'vitest';
import { defineComponent, ref } from 'vue';
import { mount } from '@vue/test-utils';
import { useShellResize } from '../../../../src/ts/composables/shell/useShellResize';

describe('useShellResize', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    document.body.className = '';
  });

  function setupResize(sidebarPos = 'row') {
    const panelHeight = ref(200);
    const sidebarWidth = ref(240);
    const settings = ref({ layout: { sidebarPos } } as any);
    const groups = ref([
      { id: 'g1', flexBasis: 50 },
      { id: 'g2', flexBasis: 50 },
    ]);
    const saveState = vi.fn();
    let api!: ReturnType<typeof useShellResize>;

    const Comp = defineComponent({
      setup() {
        api = useShellResize({
          prefix: 'test',
          panelHeight,
          sidebarWidth,
          settings,
          eg: { groups } as any,
          saveState,
        });
        return {};
      },
      template: '<div class="editor-groups-container"><div class="handle"></div></div>',
    });

    const wrapper = mount(Comp, { attachTo: document.body });
    return { wrapper, api, panelHeight, sidebarWidth, groups, saveState };
  }

  it('resizes panel height on mousemove/mouseup and cleans up overlapping resize', () => {
    const { wrapper, api, panelHeight } = setupResize();

    api.startResize(new MouseEvent('mousedown', { clientY: 300 }));
    document.dispatchEvent(new MouseEvent('mousemove', { clientY: 250 }));
    expect(panelHeight.value).toBe(250);
    expect(localStorage.getItem('test:panel-height')).toBe('250');

    // Start again while activeCleanup is set
    api.startResize(new MouseEvent('mousedown', { clientY: 200 }));
    document.dispatchEvent(new MouseEvent('mouseup'));
    expect(document.body.classList.contains('resizing')).toBe(false);

    wrapper.unmount();
  });

  it('resizes sidebar width in normal and row-reverse modes', () => {
    const { wrapper, api, sidebarWidth } = setupResize('row');
    api.startSidebarResize(new MouseEvent('mousedown', { clientX: 100 }));
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 150 }));
    expect(sidebarWidth.value).toBe(290);
    document.dispatchEvent(new MouseEvent('mouseup'));
    wrapper.unmount();

    const rev = setupResize('row-reverse');
    rev.api.startSidebarResize(new MouseEvent('mousedown', { clientX: 200 }));
    // Trigger overlapping cleanup
    rev.api.startSidebarResize(new MouseEvent('mousedown', { clientX: 200 }));
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 150 }));
    expect(rev.sidebarWidth.value).toBe(290);
    document.dispatchEvent(new MouseEvent('mouseup'));
    rev.wrapper.unmount();
  });

  it('handles group resize, boundary guards, and cleanup on unmount', () => {
    const { wrapper, api, groups, saveState } = setupResize();

    // Missing container
    const orphan = document.createElement('div');
    api.startGroupResize({ currentTarget: orphan, clientX: 0 } as unknown as MouseEvent, 0);

    const container = wrapper.find('.editor-groups-container').element as HTMLElement;
    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
      width: 1000,
      height: 500,
      top: 0,
      left: 0,
      right: 1000,
      bottom: 500,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    const handle = wrapper.find('.handle').element as HTMLElement;

    // Invalid group index
    api.startGroupResize({ currentTarget: handle, clientX: 100 } as unknown as MouseEvent, 5);

    // Valid resize
    api.startGroupResize({ currentTarget: handle, clientX: 100 } as unknown as MouseEvent, 0);
    // Clamped move (-40% -> 15 / 85)
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: -400 }));
    expect(groups.value[0].flexBasis).toBe(15);
    expect(groups.value[1].flexBasis).toBe(85);

    // Valid move (+10%)
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 200 }));
    expect(groups.value[0].flexBasis).toBe(60);
    expect(groups.value[1].flexBasis).toBe(40);

    document.dispatchEvent(new MouseEvent('mouseup'));
    expect(saveState).toHaveBeenCalledTimes(1);

    // Start resize and unmount while active to trigger onUnmounted cleanup
    api.startGroupResize({ currentTarget: handle, clientX: 100 } as unknown as MouseEvent, 0);
    api.startGroupResize({ currentTarget: handle, clientX: 100 } as unknown as MouseEvent, 0);
    wrapper.unmount();
    expect(document.body.style.cursor).toBe('');
  });
});
