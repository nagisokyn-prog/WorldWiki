import { describe, it, expect, vi } from 'vitest';
import { useAiMermaidDiagram } from './useAiMermaidDiagram';

describe('useAiMermaidDiagram', () => {
  it('initializes with default state', () => {
    const emit = vi.fn();
    const { svgContent, isLoading, errorMessage, showRaw, isCopied } = useAiMermaidDiagram(
      { code: 'flowchart TD\nA --> B' },
      emit
    );

    expect(svgContent.value).toBe('');
    expect(isLoading.value).toBe(true);
    expect(errorMessage.value).toBe('');
    expect(showRaw.value).toBe(false);
    expect(isCopied.value).toBe(false);
  });

  it('toggles raw code view', () => {
    const emit = vi.fn();
    const { showRaw, toggleRaw } = useAiMermaidDiagram(
      { code: 'flowchart TD\nA --> B' },
      emit
    );

    expect(showRaw.value).toBe(false);
    toggleRaw();
    expect(showRaw.value).toBe(true);
    toggleRaw();
    expect(showRaw.value).toBe(false);
  });
});
