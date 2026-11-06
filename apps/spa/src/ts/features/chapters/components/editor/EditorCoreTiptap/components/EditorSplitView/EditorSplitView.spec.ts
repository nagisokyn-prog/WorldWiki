import { describe, it, expect } from 'vitest';
import { useEditorSplitView } from './useEditorSplitView';

describe('useEditorSplitView', () => {
  it('initializes correctly', () => {
    const hook = useEditorSplitView();
    expect(hook).toBeDefined();
  });
});
