import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { usePromiseCardArcTags } from './usePromiseCardArcTags';
import { useStoryArcsStore } from '@/stores/story_arcs.store';

describe('usePromiseCardArcTags', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('initializes bound arcs from legacy props when arcs array is missing', () => {
    const props = {
      legacyArcId: 'arc:1',
      legacyArcPhase: 'escalation',
      availableArcs: [
        { id: 'arc:1', title: 'Арка Мести', arc_type: 'character', status: 'in_progress', project_id: 'p1' }
      ]
    };
    const { boundArcs } = usePromiseCardArcTags(props);
    expect(boundArcs.value).toHaveLength(1);
    expect(boundArcs.value[0].arcId).toBe('arc:1');
    expect(boundArcs.value[0].title).toBe('Арка Мести');
    expect(boundArcs.value[0].phase).toBe('escalation');
  });

  it('attaches new arc and emits update:arcs', () => {
    const emit = vi.fn();
    const props = {
      arcs: [{ arc_id: 'arc:1', arc_phase: 'setup' }],
      availableArcs: [
        { id: 'arc:1', title: 'Арка 1', arc_type: 'character', status: 'in_progress', project_id: 'p1' },
        { id: 'arc:2', title: 'Арка 2', arc_type: 'event', status: 'in_progress', project_id: 'p1' }
      ]
    };

    const { attachArc } = usePromiseCardArcTags(props, emit as any);
    attachArc('arc:2', 'climax');

    expect(emit).toHaveBeenCalledWith('update:arcs', [
      { arc_id: 'arc:1', arc_phase: 'setup' },
      { arc_id: 'arc:2', arc_phase: 'climax' }
    ]);
    expect(emit).toHaveBeenCalledWith('change');
  });

  it('detaches arc correctly', () => {
    const emit = vi.fn();
    const props = {
      arcs: [
        { arc_id: 'arc:1', arc_phase: 'setup' },
        { arc_id: 'arc:2', arc_phase: 'resolution' }
      ]
    };

    const { detachArc } = usePromiseCardArcTags(props, emit as any);
    detachArc('arc:1');

    expect(emit).toHaveBeenCalledWith('update:arcs', [
      { arc_id: 'arc:2', arc_phase: 'resolution' }
    ]);
    expect(emit).toHaveBeenCalledWith('change');
  });

  it('updates arc phase for specific arc', () => {
    const emit = vi.fn();
    const props = {
      arcs: [
        { arc_id: 'arc:1', arc_phase: 'setup' },
        { arc_id: 'arc:2', arc_phase: 'setup' }
      ]
    };

    const { updateArcPhase } = usePromiseCardArcTags(props, emit as any);
    updateArcPhase('arc:2', 'resolution');

    expect(emit).toHaveBeenCalledWith('update:arcs', [
      { arc_id: 'arc:1', arc_phase: 'setup' },
      { arc_id: 'arc:2', arc_phase: 'resolution' }
    ]);
  });
});
