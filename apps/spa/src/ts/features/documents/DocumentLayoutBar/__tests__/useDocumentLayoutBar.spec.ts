import { describe, expect, it, vi } from 'vitest';
import { useDocumentLayoutBar } from '../useDocumentLayoutBar';

describe('useDocumentLayoutBar', () => {
  it('initializes in page mode with ruler visible by default', () => {
    const { isPageMode, isRulerVisible } = useDocumentLayoutBar({ editor: null });
    expect(isPageMode.value).toBe(true);
    expect(isRulerVisible.value).toBe(true);
  });

  it('switches between page and canvas modes invoking editor commands', () => {
    const mockEditor = {
      commands: {
        enablePagination: vi.fn(),
        disablePagination: vi.fn(),
        showRuler: vi.fn(),
        hideRuler: vi.fn()
      }
    };

    const { isPageMode, setMode, toggleRuler } = useDocumentLayoutBar({
      editor: mockEditor as unknown as Parameters<typeof useDocumentLayoutBar>[0]['editor']
    });

    setMode('canvas');
    expect(isPageMode.value).toBe(false);
    expect(mockEditor.commands.disablePagination).toHaveBeenCalled();

    setMode('page');
    expect(isPageMode.value).toBe(true);
    expect(mockEditor.commands.enablePagination).toHaveBeenCalled();

    toggleRuler();
    expect(mockEditor.commands.hideRuler).toHaveBeenCalled();
  });
});
