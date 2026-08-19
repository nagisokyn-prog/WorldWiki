import { describe, it, expect, vi } from 'vitest';
import { useSemanticParagraphNode } from '../useSemanticParagraphNode';

describe('useSemanticParagraphNode', () => {
  it('provides label, tooltip, badge style and cycles tags', () => {
    const updateAttributes = vi.fn();
    const props = {
      node: { attrs: { semanticTag: 'dialog' } },
      updateAttributes,
    };

    const node = useSemanticParagraphNode(props);

    expect(node.tagLabel.value).toBe('!д');
    expect(node.tagTooltip.value).toContain('Диалог');
    expect(node.badgeStyle.value.color).toBe('#38bdf8');

    node.cycleTag();
    expect(updateAttributes).toHaveBeenCalledWith({ semanticTag: 'thought' });
  });
});
