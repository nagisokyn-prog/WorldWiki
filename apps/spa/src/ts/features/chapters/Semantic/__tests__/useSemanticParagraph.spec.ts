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

  it('handles undefined and unknown semanticTag fallbacks', () => {
    // 1. undefined semanticTag
    const propsUndefined = {
      node: { attrs: {} },
      updateAttributes: vi.fn(),
    };
    const sem1 = useSemanticParagraph(propsUndefined);
    expect(sem1.currentTag.value).toBe('desc');

    // 2. unknown semanticTag fallback
    const propsUnknown = {
      node: { attrs: { semanticTag: 'custom_unknown' } },
      updateAttributes: vi.fn(),
    };
    const sem2 = useSemanticParagraph(propsUnknown);
    expect(sem2.tagDisplay.value).toBe('!о');
    expect(sem2.tagTitle.value).toBe('Описание');
  });
});

