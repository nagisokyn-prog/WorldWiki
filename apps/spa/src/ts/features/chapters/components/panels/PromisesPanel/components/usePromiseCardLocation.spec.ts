import { describe, it, expect, vi } from 'vitest';
import { ref } from 'vue';
import { usePromiseCardLocation } from './usePromiseCardLocation';
import type { ProjectEntityOption } from './PromiseCardMeta/PromiseCardMeta.model';
import type { RichPlotPromise } from '../usePromisesPanel';

describe('usePromiseCardLocation', () => {
  const baseItem: RichPlotPromise = {
    id: 'p1',
    project_id: 'proj_1',
    chapter_id: 'ch_1',
    kind: 'scene',
    quote: 'Тест',
    paragraph_index: 1,
    status: 'planted',
    progressions: [],
    resolution: null,
    resolved_in_volume: null,
    resolved_in_chapter: null,
    participant_ids: [],
    location_id: 'Тронный Зал',
    timeline_event_id: null
  };

  const projectLocations = ref<ProjectEntityOption[]>([
    { id: 'entities:loc_1', name: 'Тронный Зал' },
    { id: 'entities:loc_2', name: 'Библиотека' }
  ]);

  it('initializes location draft from item', () => {
    const emit = vi.fn();
    const loc = usePromiseCardLocation({ project: 'proj_1', item: baseItem }, projectLocations, emit);
    expect(loc.locationDraft.value).toBe('Тронный Зал');
    expect(loc.isEntityLocation.value).toBe(true);
  });

  it('selects known entity location', () => {
    const emit = vi.fn();
    const loc = usePromiseCardLocation({ project: 'proj_1', item: baseItem }, projectLocations, emit);

    loc.selectLocation('Библиотека');
    expect(emit).toHaveBeenCalledWith('update:item', expect.objectContaining({
      location_id: 'Библиотека'
    }));
    expect(emit).toHaveBeenCalledWith('change');
    expect(loc.locationDraft.value).toBe('Библиотека');
  });

  it('clears location', () => {
    const emit = vi.fn();
    const loc = usePromiseCardLocation({ project: 'proj_1', item: baseItem }, projectLocations, emit);

    loc.clearLocation();
    expect(emit).toHaveBeenCalledWith('update:item', expect.objectContaining({
      location_id: null
    }));
    expect(loc.locationDraft.value).toBe('');
  });

  it('saves location only if changed', () => {
    const emit = vi.fn();
    const loc = usePromiseCardLocation({ project: 'proj_1', item: baseItem }, projectLocations, emit);

    // Unchanged
    loc.saveLocation();
    expect(emit).not.toHaveBeenCalled();

    // Changed
    loc.locationDraft.value = 'Новая Локация';
    loc.saveLocation();
    expect(emit).toHaveBeenCalledWith('update:item', expect.objectContaining({
      location_id: 'Новая Локация'
    }));
  });
});

