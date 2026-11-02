import { describe, it, expect, vi } from 'vitest';
import { useVolumeBacklogSection } from '../useVolumeBacklogSection';

describe('useVolumeBacklogSection', () => {
  it('toggles expansion and submits new backlog item', () => {
    const emit = vi.fn();
    const hook = useVolumeBacklogSection({ items: [], volumeId: 'volumes:vol_1' }, emit);

    expect(hook.isExpanded.value).toBe(true);
    hook.toggleExpanded();
    expect(hook.isExpanded.value).toBe(false);

    hook.startAdding();
    expect(hook.isAdding.value).toBe(true);

    hook.newText.value = 'Задумка для финала';
    hook.submitAdd();

    expect(emit).toHaveBeenCalledWith('add-backlog', {
      ownerId: 'volumes:vol_1',
      text: 'Задумка для финала'
    });
    expect(hook.isAdding.value).toBe(false);
  });
});
