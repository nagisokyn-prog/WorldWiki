import { describe, it, expect, beforeEach, vi } from 'vitest';
import { usePromiseCardMeta } from './usePromiseCardMeta';
import type { RichPlotPromise } from '../usePromisesPanel';

vi.mock('@/services/api.client', () => ({
  getEntities: vi.fn().mockResolvedValue([]),
  getGlobalTimeline: vi.fn().mockResolvedValue({ events: [] })
}));

describe('usePromiseCardMeta', () => {
  const baseItem: RichPlotPromise = {
    id: 'p1',
    project_id: 'test_proj',
    chapter_id: 'ch1',
    kind: 'scene',
    quote: 'Рудеус обнажил меч',
    paragraph_index: 2,
    block_id: 'para-2',
    note: null,
    status: 'planted',
    progressions: [],
    resolution: null,
    resolved_in_volume: null,
    resolved_in_chapter: null,
    participant_ids: ['Герой'],
    location_id: 'Тронный зал',
    timeline_event_id: 'ev_1'
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes location draft from item', () => {
    const emit = vi.fn();
    const { locationDraft } = usePromiseCardMeta({ project: 'test_proj', item: baseItem }, emit);
    expect(locationDraft.value).toBe('Тронный зал');
  });

  it('saves updated location and emits change', () => {
    const emit = vi.fn();
    const meta = usePromiseCardMeta({ project: 'test_proj', item: baseItem }, emit);
    meta.locationDraft.value = 'Трактир на окраине';
    meta.saveLocation();

    expect(emit).toHaveBeenCalledWith('update:item', expect.objectContaining({
      location_id: 'Трактир на окраине'
    }));
    expect(emit).toHaveBeenCalledWith('change');
  });

  it('adds and removes participants', () => {
    const emit = vi.fn();
    const meta = usePromiseCardMeta({ project: 'test_proj', item: baseItem }, emit);
    
    meta.addParticipant('Эрис');
    expect(emit).toHaveBeenCalledWith('update:item', expect.objectContaining({
      participant_ids: ['Герой', 'Эрис']
    }));

    meta.removeParticipant('Герой');
    expect(emit).toHaveBeenCalledWith('update:item', expect.objectContaining({
      participant_ids: []
    }));
  });

  it('updates kind and timeline event', () => {
    const emit = vi.fn();
    const meta = usePromiseCardMeta({ project: 'test_proj', item: baseItem }, emit);

    meta.updateKind('conflict');
    expect(emit).toHaveBeenCalledWith('update:item', expect.objectContaining({
      kind: 'conflict'
    }));

    meta.updateTimelineEvent('ev_99');
    expect(emit).toHaveBeenCalledWith('update:item', expect.objectContaining({
      timeline_event_id: 'ev_99'
    }));
  });
});
