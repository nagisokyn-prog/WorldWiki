import { describe, it, expect, vi } from 'vitest';
import { reactive } from 'vue';
import { useFootnoteNodeView } from './useFootnoteNodeView';
import type { FootnoteNodeViewProps } from './FootnoteNodeView.model';

describe('useFootnoteNodeView', () => {
  it('computes footnote props with defaults, toggles/closes popover, and updates content', () => {
    const updateAttributes = vi.fn();
    const props = reactive({
      node: {
        attrs: {
          computedNumber: 3,
          content: 'Примечание'
        }
      },
      updateAttributes
    }) as unknown as FootnoteNodeViewProps;

    const view = useFootnoteNodeView(props);

    expect(view.isOpen.value).toBe(false);
    expect(view.footnoteNumber.value).toBe(3);
    expect(view.footnoteText.value).toBe('Примечание');

    const stopPropagation = vi.fn();
    view.togglePopover({ stopPropagation } as unknown as MouseEvent);
    expect(stopPropagation).toHaveBeenCalledTimes(1);
    expect(view.isOpen.value).toBe(true);

    view.closePopover();
    expect(view.isOpen.value).toBe(false);

    view.updateContent('Обновлено');
    expect(updateAttributes).toHaveBeenCalledWith({ content: 'Обновлено' });

    props.node.attrs.computedNumber = 0;
    props.node.attrs.content = '';
    expect(view.footnoteNumber.value).toBe(1);
    expect(view.footnoteText.value).toBe('');
  });
});

