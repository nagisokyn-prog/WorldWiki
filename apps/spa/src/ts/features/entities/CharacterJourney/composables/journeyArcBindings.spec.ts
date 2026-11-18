import { describe, it, expect } from 'vitest';
import { resolveArcBindings } from './journeyArcBindings';
import type { StoryArc } from '@/types/generated/StoryArc';

describe('resolveArcBindings', () => {
  const storyArcs: StoryArc[] = [
    { id: 'story_arcs:a1', title: 'Арка 1', color: '#ff0000', arc_type: 'plot', status: 'active', project_id: 'p1', description: null },
  ];

  it('resolves string entries, object entries, skips empty/falsy entries, and joins titles', () => {
    const res = resolveArcBindings(
      [null, '', 'story_arcs:a1', { arc_id: '' }, { arc_id: 'story_arcs:a1', arc_phase: 'climax' }, { arc_id: 'story_arcs:unknown' }],
      null,
      null,
      null,
      null,
      storyArcs
    );

    expect(res.boundArcs).toHaveLength(3);
    expect(res.allArcIds).toEqual(['story_arcs:a1', 'story_arcs:unknown']);
    expect(res.primaryArc?.arcTitle).toBe('Арка 1');
    expect(res.combinedArcTitle).toBe('Арка 1 & Арка 1 & Сюжетная арка');
  });

  it('falls back to fallbackArcId and fallbackArcTitle when rawArcs is empty', () => {
    const withFallbackId = resolveArcBindings([], 'story_arcs:a2', 'Фолбэк', '#123', 'resolution', storyArcs);
    expect(withFallbackId.boundArcs[0]).toMatchObject({
      arcId: 'story_arcs:a2',
      arcTitle: 'Фолбэк',
      arcColor: '#123',
      phase: 'resolution',
    });

    const withoutAnyArc = resolveArcBindings(null, null, 'Только имя', null, null, storyArcs);
    expect(withoutAnyArc.boundArcs).toEqual([]);
    expect(withoutAnyArc.combinedArcTitle).toBe('Только имя');
  });
});
