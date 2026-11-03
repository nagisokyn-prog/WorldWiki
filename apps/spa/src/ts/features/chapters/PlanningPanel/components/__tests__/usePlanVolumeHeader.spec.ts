import { describe, it, expect, vi } from 'vitest';
import { usePlanVolumeHeader } from '../usePlanVolumeHeader';
import type { PlanVolumeHeaderProps } from '../PlanVolumeHeader.model';

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
});
