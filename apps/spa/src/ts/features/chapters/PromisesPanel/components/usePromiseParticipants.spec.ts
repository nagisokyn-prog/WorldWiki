import { describe, it, expect, vi } from 'vitest';
import { ref } from 'vue';
import { usePromiseParticipants } from './usePromiseParticipants';
import type { RichPlotPromise } from '../usePromisesPanel';

describe('usePromiseParticipants', () => {
  const baseItem: RichPlotPromise = {
    id: 'p1',
    project_id: 'test_proj',
    chapter_id: 'ch1',
    kind: 'scene',
    quote: 'Тест',
    paragraph_index: 1,
    block_id: 'b1',
    note: null,
    status: 'planted',
    progressions: [],
    resolution: null,
    resolved_in_volume: null,
    resolved_in_chapter: null,
    participant_ids: ['characters:rudy', 'Эрис'],
    location_id: null,
    timeline_event_id: null,
    arc_id: null,
    arc_phase: null
  };

  const projectCharacters = ref([
    { id: 'characters:rudy', name: 'Рудеус' },
    { id: 'characters:sylphy', name: 'Сильфи' }
  ]);

  it('resolves display names and deduplicates participants', () => {
    const emit = vi.fn();
    const { getParticipantDisplayName, currentParticipants } = usePromiseParticipants(
      { project: 'test_proj', item: baseItem },
      projectCharacters,
      emit
    );

    expect(getParticipantDisplayName('characters:rudy')).toBe('Рудеус');
    expect(currentParticipants.value).toEqual(['characters:rudy', 'Эрис']);
  });

  it('adds a new participant and emits update', () => {
    const emit = vi.fn();
    const { addParticipant } = usePromiseParticipants(
      { project: 'test_proj', item: baseItem },
      projectCharacters,
      emit
    );

    addParticipant('Сильфи');
    expect(emit).toHaveBeenCalledWith('update:item', expect.objectContaining({
      participant_ids: ['characters:rudy', 'Эрис', 'Сильфи']
    }));
    expect(emit).toHaveBeenCalledWith('change');
  });

  it('removes an existing participant', () => {
    const emit = vi.fn();
    const { removeParticipant } = usePromiseParticipants(
      { project: 'test_proj', item: baseItem },
      projectCharacters,
      emit
    );

    removeParticipant('Эрис');
    expect(emit).toHaveBeenCalledWith('update:item', expect.objectContaining({
      participant_ids: ['characters:rudy']
    }));
    expect(emit).toHaveBeenCalledWith('change');
  });

  it('filters available characters excluding already selected ones', () => {
    const emit = vi.fn();
    const { availableCharacters, participantInputQuery } = usePromiseParticipants(
      { project: 'test_proj', item: baseItem },
      projectCharacters,
      emit
    );

    expect(availableCharacters.value.map(c => c.name)).toEqual(['Сильфи']);

    participantInputQuery.value = 'сил';
    expect(availableCharacters.value.map(c => c.name)).toEqual(['Сильфи']);
  });
});
