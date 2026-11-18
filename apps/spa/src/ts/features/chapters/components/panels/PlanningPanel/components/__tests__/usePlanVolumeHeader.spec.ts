import { describe, it, expect, vi } from 'vitest';
import { defineComponent } from 'vue';
import { mount } from '@vue/test-utils';
import { usePlanVolumeHeader } from '../PlanVolumeHeader/usePlanVolumeHeader';
import type { PlanVolumeHeaderProps } from '../PlanVolumeHeader/PlanVolumeHeader.model';

describe('usePlanVolumeHeader', () => {
  it('computes progress percentage correctly', () => {
    const props: PlanVolumeHeaderProps = {
      title: 'Том 1',
      stats: { total: 10, done: 6, inProgress: 2, planned: 1, blocked: 1 },
      isCollapsed: false
    };
    const emit = vi.fn();
    const { progressPct, handleToggle } = usePlanVolumeHeader(props, emit);

    expect(progressPct.value).toBe(60);

    handleToggle();
    expect(emit).toHaveBeenCalledWith('toggle-collapse');
  });

  it('handles 0 total items without division by zero', () => {
    const props: PlanVolumeHeaderProps = {
      title: 'Том 1',
      stats: { total: 0, done: 0, inProgress: 0, planned: 0, blocked: 0 },
      isCollapsed: false
    };
    const emit = vi.fn();
    const { progressPct } = usePlanVolumeHeader(props, emit);

    expect(progressPct.value).toBe(0);
  });

  it('toggles help guide card visibility', () => {
    const props: PlanVolumeHeaderProps = {
      title: 'Том 1',
      stats: { total: 0, done: 0, inProgress: 0, planned: 0, blocked: 0 }
    };
    const emit = vi.fn();
    const { isHelpOpen, toggleHelp } = usePlanVolumeHeader(props, emit);

    expect(isHelpOpen.value).toBe(false);
    toggleHelp();
    expect(isHelpOpen.value).toBe(true);
    toggleHelp();
    expect(isHelpOpen.value).toBe(false);
  });

  it('toggles volume menu and selects volume', () => {
    const props: PlanVolumeHeaderProps = {
      title: 'Том 1',
      stats: { total: 0, done: 0, inProgress: 0, planned: 0, blocked: 0 },
      volumes: [{ id: 'vol_1', title: 'Том 1' }, { id: 'vol_2', title: 'Том 2' }]
    };
    const emit = vi.fn();
    const { isVolumeMenuOpen, toggleVolumeMenu, selectVolume } = usePlanVolumeHeader(props, emit);

    expect(isVolumeMenuOpen.value).toBe(false);
    toggleVolumeMenu();
    expect(isVolumeMenuOpen.value).toBe(true);

    selectVolume('vol_2');
    expect(emit).toHaveBeenCalledWith('select-volume', 'vol_2');
    expect(isVolumeMenuOpen.value).toBe(false);
  });

  it('closes volume menu on outside document click and keeps it open on inside click', () => {
    const props: PlanVolumeHeaderProps = {
      title: 'Том 1',
      stats: { total: 1, done: 1, inProgress: 0, planned: 0, blocked: 0 },
    };
    const emit = vi.fn();
    let api!: ReturnType<typeof usePlanVolumeHeader>;

    const Comp = defineComponent({
      setup() {
        api = usePlanVolumeHeader(props, emit);
        return {};
      },
      template: '<div class="volume-select-container"><button class="inside">in</button></div><div class="outside">out</div>',
    });

    const wrapper = mount(Comp, { attachTo: document.body });
    api.toggleVolumeMenu();
    expect(api.isVolumeMenuOpen.value).toBe(true);

    const inside = wrapper.find('.inside').element as HTMLElement;
    inside.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(api.isVolumeMenuOpen.value).toBe(true);

    const outside = wrapper.find('.outside').element as HTMLElement;
    outside.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(api.isVolumeMenuOpen.value).toBe(false);

    wrapper.unmount();
  });
});
