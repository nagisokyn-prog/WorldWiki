import { describe, it, expect, vi } from 'vitest';
import { usePromiseMilestoneCard } from './usePromiseMilestoneCard';
import type { PromiseMilestone, RichPlotPromise } from '../../../../usePromisesPanel';

describe('usePromiseMilestoneCard', () => {
  const milestone: PromiseMilestone = {
    milestone_id: 'ms_1',
    stage: 'resolution',
    quote: 'Выстрел прозвучал в полночь',
    note: null,
    block_id: 'blk_ch2_para-7',
    block_ids: ['para-7', 'para-8'],
    chapter_id: 'chapters:ch2',
    order_index: 7,
    location_id: 'locations:castle',
    participant_ids: ['entities:hero'],
    arcs: [{ arc_id: 'story_arcs:a1', arc_phase: 'resolution' }],
    m_abs: 2880,
    time_nature: 'present',
    is_flashback: false,
  };

  const parentItem: RichPlotPromise = {
    id: 'plot_promises:p1',
    project_id: 'proj1',
    chapter_id: 'chapters:ch1',
    kind: 'gun',
    title: 'Ружьё на стене',
    quote: 'Ружьё висело на стене',
    paragraph_index: 1,
    block_id: 'para-1',
    note: null,
    status: 'resolved',
    milestones: [milestone],
    progressions: [],
    resolution: milestone,
    resolved_in_volume: null,
    resolved_in_chapter: null,
    participant_ids: [],
    location_id: null,
    timeline_event_id: null,
    arc_id: null,
    arc_phase: null,
  };

  it('computes collapsed badges and updates milestone metadata on parent item', () => {
    const emit = vi.fn();
    const card = usePromiseMilestoneCard(
      {
        project: 'proj1',
        parentItem,
        milestone,
        stage: 'resolution',
        getChapterTitle: () => 'Глава 2',
        isCurrentChapterPromise: () => false,
      },
      emit
    );

    expect(card.isCollapsed.value).toBe(true);
    card.toggleCollapsed();
    expect(card.isCollapsed.value).toBe(false);
    expect(card.collapsedBlockBadge.value).toBe('para-7..para-8');
    expect(card.participantCount.value).toBe(1);
    expect(card.arcCount.value).toBe(1);

    card.handleMetaUpdate({
      ...card.milestoneAsPromise.value,
      location_id: 'locations:forest',
      m_abs: 4320,
      participant_ids: ['entities:hero', 'entities:villain'],
    });

    expect(emit).toHaveBeenCalledWith(
      'update:item',
      expect.objectContaining({
        resolution: expect.objectContaining({
          location_id: 'locations:forest',
          m_abs: 4320,
          participant_ids: ['entities:hero', 'entities:villain'],
        }),
      })
    );
  });
});
