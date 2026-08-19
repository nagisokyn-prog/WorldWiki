import { describe, it, expect, vi } from 'vitest';
import { useSemanticParagraph } from '../useSemanticParagraph';

describe('useSemanticParagraph', () => {
  it('cycles tags and displays correct label', () => {
    const updateAttributes = vi.fn();
    const props = {
      node: { attrs: { semanticTag: 'desc' } },
      updateAttributes,
    };

    const sem = useSemanticParagraph(props);

    expect(sem.currentTag.value).toBe('desc');
    expect(sem.tagDisplay.value).toBe('!о');
    expect(sem.tagTitle.value).toBe('Описание');

    sem.cycleTag();
    expect(updateAttributes).toHaveBeenCalledWith({ semanticTag: 'dialog' });
  });
});
