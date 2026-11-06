import { describe, it, expect, vi } from 'vitest';
import { useVolumeBacklogSection } from '../VolumeBacklogSection/useVolumeBacklogSection';

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

  it('submits backlog item with empty ownerId fallback when volumeId is undefined', () => {
    const emit = vi.fn();
    const hook = useVolumeBacklogSection({ items: [] }, emit);

    hook.startAdding();
    hook.newText.value = 'Общая идея без тома';
    hook.submitAdd();

    expect(emit).toHaveBeenCalledWith('add-backlog', {
      ownerId: '',
      text: 'Общая идея без тома'
    });
    expect(hook.isAdding.value).toBe(false);
  });

  it('toggles move menu and emits move-to-chapter with target chapter', () => {
    const emit = vi.fn();
    const hook = useVolumeBacklogSection({
      items: [],
      chapters: [
        { chapterId: 'chapters:c1', title: 'Глава 1' },
        { chapterId: 'chapters:c2', title: 'Глава 2' }
      ]
    }, emit);

    expect(hook.activeMoveItemId.value).toBeNull();
    hook.toggleMoveMenu('todo:1');
    expect(hook.activeMoveItemId.value).toBe('todo:1');

    hook.moveToChapter('todo:1', 'chapters:c2');
    expect(emit).toHaveBeenCalledWith('move-to-chapter', {
      todoId: 'todo:1',
      targetChapterId: 'chapters:c2'
    });
    expect(hook.activeMoveItemId.value).toBeNull();
  });
});
