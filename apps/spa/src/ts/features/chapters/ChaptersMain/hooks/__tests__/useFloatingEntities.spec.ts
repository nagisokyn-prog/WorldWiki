import { describe, it, expect } from 'vitest';
import { useFloatingEntities } from '../useFloatingEntities';

describe('useFloatingEntities', () => {
  it('opens and closes floating editors', () => {
    const floating = useFloatingEntities('proj_1');

    expect(floating.floatingEditors.value.length).toBe(0);

    floating.handleOpenEntity({ type: 'character', id: 'char_1' });
    expect(floating.floatingEditors.value.length).toBe(1);
    expect(floating.floatingEditors.value[0].entityId).toBe('char_1');

    const id = floating.floatingEditors.value[0].id;
    floating.closeFloatingEditor(id);
    expect(floating.floatingEditors.value.length).toBe(0);
  });
});
