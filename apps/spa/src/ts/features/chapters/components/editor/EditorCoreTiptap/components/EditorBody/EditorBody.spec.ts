import { describe, it, expect } from 'vitest';
import { useEditorBody } from './useEditorBody';

describe('useEditorBody', () => {
  it('initializes correctly', () => {
    const hook = useEditorBody();
    expect(hook).toBeDefined();
  });
});
