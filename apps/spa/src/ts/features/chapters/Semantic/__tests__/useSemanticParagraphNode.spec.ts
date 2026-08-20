import { describe, it, expect, vi } from 'vitest';
import { useSemanticParagraphNode } from '../useSemanticParagraphNode';

describe('useSemanticParagraphNode', () => {
  it('handles all tag types (desc, dialog, thought, unknown, empty) for label, tooltip, and badgeStyle', () => {
    // desc
    const descNode = useSemanticParagraphNode({ node: { attrs: { semanticTag: 'desc' } } });
    expect(descNode.tagLabel.value).toBe('!о');
    expect(descNode.tagTooltip.value).toContain('Описание');
    expect(descNode.badgeStyle.value.color).toBe('#94a3b8');

    // dialog
    const dialogNode = useSemanticParagraphNode({ node: { attrs: { semanticTag: 'dialog' } } });
    expect(dialogNode.tagLabel.value).toBe('!д');
    expect(dialogNode.tagTooltip.value).toContain('Диалог');
    expect(dialogNode.badgeStyle.value.color).toBe('#38bdf8');

    // thought
    const thoughtNode = useSemanticParagraphNode({ node: { attrs: { semanticTag: 'thought' } } });
    expect(thoughtNode.tagLabel.value).toBe('!м');
    expect(thoughtNode.tagTooltip.value).toContain('Мысль');
    expect(thoughtNode.badgeStyle.value.color).toBe('#c084fc');

    // unknown / empty
    const unknownNode = useSemanticParagraphNode({ node: { attrs: { semanticTag: 'custom' } } });
    expect(unknownNode.tagLabel.value).toBe('!о');
    expect(unknownNode.tagTooltip.value).toBe('Тег');
    expect(unknownNode.badgeStyle.value.color).toBe('#94a3b8');

    const emptyNode = useSemanticParagraphNode({});
    expect(emptyNode.tagLabel.value).toBe('!о');
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
