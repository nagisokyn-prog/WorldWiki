import { describe, it, expect } from 'vitest';
import { useAcademicProfilesList } from './useAcademicProfilesList';

describe('useAcademicProfilesList', () => {
  it('initializes correctly', () => {
    const hook = useAcademicProfilesList();
    expect(hook).toBeDefined();
  });
});
