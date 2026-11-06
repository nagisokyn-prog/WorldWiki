import { describe, it, expect } from 'vitest';
import { usePromiseCardNote } from './usePromiseCardNote';

describe('usePromiseCardNote', () => {
  it('initializes correctly', () => {
    const hook = usePromiseCardNote();
    expect(hook).toBeDefined();
  });
});
