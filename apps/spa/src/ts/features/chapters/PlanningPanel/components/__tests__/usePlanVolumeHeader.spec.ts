import { describe, it, expect, vi } from 'vitest';
import { usePlanVolumeHeader } from './usePlanVolumeHeader';
import type { PlanVolumeHeaderProps } from './PlanVolumeHeader.model';

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
});
