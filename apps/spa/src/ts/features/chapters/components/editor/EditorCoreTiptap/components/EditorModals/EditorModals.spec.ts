import { describe, it, expect } from 'vitest';
import { useEditorModals } from './useEditorModals';

describe('useEditorModals', () => {
  it('initializes correctly', () => {
    const hook = useEditorModals();
    expect(hook).toBeDefined();
  });
});
