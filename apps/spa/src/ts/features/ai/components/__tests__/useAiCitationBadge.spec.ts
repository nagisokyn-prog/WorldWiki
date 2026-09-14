import { describe, it, expect, vi } from 'vitest';
import { useAiCitationBadge } from '../useAiCitationBadge';
import type { CitationItem } from '../AiCitation.model';

describe('useAiCitationBadge', () => {
  it('toggles and closes popover and emits ask-source', () => {
    const emit = vi.fn();
    const hook = useAiCitationBadge(emit);

    expect(hook.isPopoverOpen.value).toBe(false);

    hook.togglePopover();
    expect(hook.isPopoverOpen.value).toBe(true);

    hook.togglePopover();
    expect(hook.isPopoverOpen.value).toBe(false);

    const testCitation: CitationItem = {
      index: 1,
      evidence_id: 'ev_1',
      url: 'https://example.com',
      domain: 'example.com',
      title: 'Test',
      excerpt: 'Sample',
    };

    hook.isPopoverOpen.value = true;
    hook.onAskSource(testCitation);
    expect(emit).toHaveBeenCalledWith('ask-source', testCitation);
    expect(hook.isPopoverOpen.value).toBe(false);

    hook.isPopoverOpen.value = true;
    hook.closePopover();
    expect(hook.isPopoverOpen.value).toBe(false);
  });
});
