import { describe, it, expect, vi } from 'vitest';
import { h } from 'vue';
import { mount } from '@vue/test-utils';
import TimelinePanel from './timeline-panel';

const mockUseTimelinePanel = vi.fn(() => ({ mockState: true }));

vi.mock('@/features/timeline/components/inspectors/TimelinePanel/useTimelinePanel', () => ({
  useTimelinePanel: (...args: unknown[]) => mockUseTimelinePanel(...args)
}));

describe('timeline-panel', () => {
  it('delegates setup to useTimelinePanel with props and emit', () => {
    const wrapper = mount(
      {
        ...TimelinePanel,
        render: () => h('div')
      },
      {
        props: {
          project: 'proj-1',
          events: []
        }
      }
    );

    expect(mockUseTimelinePanel).toHaveBeenCalledTimes(1);
    expect(mockUseTimelinePanel.mock.calls[0][0]).toMatchObject({
      project: 'proj-1',
      events: []
    });
    expect(typeof mockUseTimelinePanel.mock.calls[0][1]).toBe('function');

    wrapper.unmount();
  });
});

