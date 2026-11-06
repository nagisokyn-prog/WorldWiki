import { describe, it, expect } from 'vitest';
import { useEditorStatusBar } from './useEditorStatusBar';

describe('useEditorStatusBar', () => {
  it('initializes correctly', () => {
    const hook = useEditorStatusBar();
    expect(hook).toBeDefined();
  });
});
