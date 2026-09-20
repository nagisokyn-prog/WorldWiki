import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAiContextSelection } from '../useAiContextSelection';

describe('useAiContextSelection', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('manages web search toggle and localStorage persistence', () => {
    const ctx = useAiContextSelection();
    expect(ctx.isWebSearchEnabled.value).toBe(false);

    ctx.toggleWebSearch();
    expect(ctx.isWebSearchEnabled.value).toBe(true);
    expect(localStorage.getItem('wowilon_web_search_enabled')).toBe('true');
  });

  it('handles quotes and citations with focus callback', () => {
    const onFocusInput = vi.fn();
    const ctx = useAiContextSelection({ onFocusInput });

    ctx.handleAskWoWiLon({ selected_text: 'Quote text', source_message_id: 'm1' });
    expect(ctx.activeQuote.value?.selected_text).toBe('Quote text');
    expect(onFocusInput).toHaveBeenCalled();

    ctx.handleClearQuote();
    expect(ctx.activeQuote.value).toBeNull();

    ctx.handleAskSource({
      domain: 'wiki.org',
      title: 'Article',
      excerpt: 'Summary excerpt',
      url: 'https://wiki.org'
    });
    expect(ctx.activeQuote.value?.selected_text).toContain('Article (wiki.org)');
  });

  it('manages lore context and manual insertions', () => {
    const onCloseToolInspector = vi.fn();
    const ctx = useAiContextSelection({ onCloseToolInspector });

    ctx.handleAddToLore('Some story lore text');
    expect(ctx.selectedContext.value.length).toBe(1);
    expect(ctx.selectedContext.value[0].type).toBe('manual');
    expect(ctx.selectedContext.value[0].content).toBe('Some story lore text');

    ctx.handleInsertContext('Tool output context');
    expect(ctx.selectedContext.value.length).toBe(2);
    expect(onCloseToolInspector).toHaveBeenCalled();

    ctx.removeContext(ctx.selectedContext.value[0]);
    expect(ctx.selectedContext.value.length).toBe(1);
  });
});
