import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAiCitationPopover } from '../useAiCitationPopover';
import type { AiCitationPopoverProps } from '../AiCitation.model';

describe('useAiCitationPopover', () => {
  let emit: ReturnType<typeof vi.fn>;
  let props: AiCitationPopoverProps;

  beforeEach(() => {
    emit = vi.fn();
    props = {
      citation: {
        index: 1,
        evidence_id: 'ev_1',
        url: 'https://example.com',
        domain: 'example.com',
        title: 'Example Source',
        excerpt: 'Test excerpt',
      },
      isOpen: true,
      anchorEl: null,
    };
  });

  it('computes empty style when anchorEl is not provided', () => {
    const hook = useAiCitationPopover(props, emit);
    expect(hook.popoverStyle.value).toEqual({});
  });

  it('computes popoverStyle position based on anchorEl bounding rect', () => {
    const mockEl = {
      getBoundingClientRect: () => ({
        left: 200,
        bottom: 150,
        top: 100,
        right: 300,
        width: 100,
        height: 50,
      }),
    } as unknown as HTMLElement;

    props.anchorEl = mockEl;
    const hook = useAiCitationPopover(props, emit);

    expect(hook.popoverStyle.value).toEqual({
      left: '100px',
      top: '158px',
    });
  });

  it('handles close and askSource methods', () => {
    const hook = useAiCitationPopover(props, emit);

    hook.close();
    expect(emit).toHaveBeenCalledWith('close');

    hook.askSource();
    expect(emit).toHaveBeenCalledWith('ask-source', props.citation);
  });

  it('handles click outside correctly', () => {
    const hook = useAiCitationPopover(props, emit);
    const mockPopoverEl = document.createElement('div');
    hook.popoverRef.value = mockPopoverEl;

    const outsideTarget = document.createElement('button');
    const event = { target: outsideTarget } as unknown as MouseEvent;

    hook.handleClickOutside(event);
    expect(emit).toHaveBeenCalledWith('close');
  });
});
