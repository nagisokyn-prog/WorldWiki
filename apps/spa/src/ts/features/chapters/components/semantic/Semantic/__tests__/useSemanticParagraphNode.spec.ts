import { describe, it, expect, vi } from 'vitest';
import { useSemanticParagraphNode } from '../useSemanticParagraphNode';

describe('useSemanticParagraphNode', () => {
  it('handles all tag types (desc, dialog, thought, unknown, empty) for label, tooltip, and tagClass', () => {
    // desc
    const descNode = useSemanticParagraphNode({ node: { attrs: { semanticTag: 'desc' } } });
    expect(descNode.tagLabel.value).toBe('!о');
    expect(descNode.tagTooltip.value).toContain('Описание');
    expect(descNode.tagClass.value).toBe('tag-desc');

    // dialog
    const dialogNode = useSemanticParagraphNode({ node: { attrs: { semanticTag: 'dialog' } } });
    expect(dialogNode.tagLabel.value).toBe('!д');
    expect(dialogNode.tagTooltip.value).toContain('Диалог');
    expect(dialogNode.tagClass.value).toBe('tag-dialog');

    // thought
    const thoughtNode = useSemanticParagraphNode({ node: { attrs: { semanticTag: 'thought' } } });
    expect(thoughtNode.tagLabel.value).toBe('!м');
    expect(thoughtNode.tagTooltip.value).toContain('Мысль');
    expect(thoughtNode.tagClass.value).toBe('tag-thought');

    // unknown / empty
    const unknownNode = useSemanticParagraphNode({ node: { attrs: { semanticTag: 'custom' } } });
    expect(unknownNode.tagLabel.value).toBe('!о');
    expect(unknownNode.tagTooltip.value).toBe('Тег');
    expect(unknownNode.tagClass.value).toBe('tag-custom');

    const emptyNode = useSemanticParagraphNode({});
    expect(emptyNode.tagLabel.value).toBe('!о');
    expect(emptyNode.tagTooltip.value).toContain('Описание');
    expect(emptyNode.tagClass.value).toBe('tag-desc');

    const noAttrsNode = useSemanticParagraphNode({ node: {} });
    expect(noAttrsNode.tagLabel.value).toBe('!о');
    expect(noAttrsNode.tagTooltip.value).toContain('Описание');
    expect(noAttrsNode.tagClass.value).toBe('tag-desc');
  });

  it('cycles tags through desc -> dialog -> thought -> desc and handles missing updateAttributes', () => {
    const updateAttributes = vi.fn();
    const props = {
      node: { attrs: { semanticTag: 'thought' } },
      updateAttributes,
    };

    const node = useSemanticParagraphNode(props);
    node.cycleTag();
    expect(updateAttributes).toHaveBeenCalledWith({ semanticTag: 'desc' });

    // Missing updateAttributes guard
    const noopNode = useSemanticParagraphNode({});
    noopNode.cycleTag();

    // cycleTag with empty node (triggers default 'desc' -> 'dialog')
    const updateAttrsDefault = vi.fn();
    const emptyAttrsNode = useSemanticParagraphNode({ updateAttributes: updateAttrsDefault });
    emptyAttrsNode.cycleTag();
    expect(updateAttrsDefault).toHaveBeenCalledWith({ semanticTag: 'dialog' });

    // cycleTag with custom tag not in list (indexOf = -1 -> (-1+1)%3 = 0 -> 'desc')
    const updateAttrsCustom = vi.fn();
    const customNode = useSemanticParagraphNode({ node: { attrs: { semanticTag: 'unknown_tag' } }, updateAttributes: updateAttrsCustom });
    customNode.cycleTag();
    expect(updateAttrsCustom).toHaveBeenCalledWith({ semanticTag: 'desc' });
  });
});
