import { describe, it, expect } from 'vitest';
import { useQuickLinkHint } from './useQuickLinkHint';

describe('useQuickLinkHint', () => {
  it('initializes correctly', () => {
    const hook = useQuickLinkHint();
    expect(hook).toBeDefined();
  });
});
