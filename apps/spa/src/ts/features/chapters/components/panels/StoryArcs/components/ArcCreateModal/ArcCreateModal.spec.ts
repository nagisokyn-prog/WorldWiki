import { describe, it, expect } from 'vitest';
import { useArcCreateModal } from './useArcCreateModal';

describe('useArcCreateModal', () => {
  it('initializes correctly', () => {
    const hook = useArcCreateModal();
    expect(hook).toBeDefined();
  });
});
