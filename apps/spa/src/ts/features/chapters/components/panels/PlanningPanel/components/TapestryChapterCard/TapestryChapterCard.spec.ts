import { describe, it, expect } from 'vitest';
import { useTapestryChapterCard } from './useTapestryChapterCard';

describe('useTapestryChapterCard', () => {
  it('initializes correctly', () => {
    const hook = useTapestryChapterCard();
    expect(hook).toBeDefined();
  });
});
