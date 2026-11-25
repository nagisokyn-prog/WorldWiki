import { describe, it, expect, vi } from 'vitest';
import { useTimelineEventNode } from './useTimelineEventNode';
import type { FormattedInspectorEvent } from '../../TimelineInspector.model';

describe('useTimelineEventNode', () => {
  const baseEvent: FormattedInspectorEvent = {
    id: 'plot_promises:p1',
    title: 'Сцена',
    m_abs: 1440,
    reveals: [],
    participants: [],
    formattedDate: '1 Янв 1',
    dayKey: '0_1_0_1',
    dayLabel: '1 Янв 1',
    timeLabel: '00:00',
    cleanParticipants: [],
    isScene: true,
    kindMeta: { label: 'Сцена', icon: '🎬', badgeClass: 'badge-scene' },
  };

  it('formats location label, checks pinged state, and forwards emits', () => {
    const emit = vi.fn();
    const {
      cleanLocationLabel,
      isPinged,
      onHoverEvent,
      onNavigateScene,
      onScrollChapter,
      onScrollEvent,
    } = useTimelineEventNode(
      {
        ev: baseEvent,
        pingedEventId: 'p1',
        isHighlighted: () => false,
        isDimmed: () => false,
      },
      emit
    );

    expect(cleanLocationLabel('locations:city_1', 'Столица')).toBe('Столица');
    expect(cleanLocationLabel('locations:city_1')).toBe('city_1');
    expect(isPinged(baseEvent)).toBe(true);

    onHoverEvent('plot_promises:p1');
    onNavigateScene(baseEvent);
    onScrollChapter('ch1');
    onScrollEvent('parent_1');

    expect(emit).toHaveBeenCalledWith('hover-event', 'plot_promises:p1');
    expect(emit).toHaveBeenCalledWith('navigate-scene', baseEvent);
    expect(emit).toHaveBeenCalledWith('scroll-chapter', 'ch1');
    expect(emit).toHaveBeenCalledWith('scroll-event', 'parent_1');
  });
});
