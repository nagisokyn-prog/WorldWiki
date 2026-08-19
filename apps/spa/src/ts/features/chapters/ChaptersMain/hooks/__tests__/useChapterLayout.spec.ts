import { describe, it, expect, beforeEach } from 'vitest';
import { useChapterLayout } from '../useChapterLayout';

describe('useChapterLayout', () => {
  it('toggles right panel, zen mode, and quick links', () => {
    const layout = useChapterLayout();

    expect(layout.isRightPanelVisible.value).toBe(true);
    layout.toggleRightPanel();
    expect(layout.isRightPanelVisible.value).toBe(false);

    layout.dismissQuickLinkHintForever();
    expect(layout.showQuickLinkHint.value).toBe(false);
    expect(layout.hideQuickLinkHintForever.value).toBe(true);
  });
});
