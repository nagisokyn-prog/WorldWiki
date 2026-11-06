import { describe, it, expect } from 'vitest';
import { useSurrealConsolePresets } from './useSurrealConsolePresets';

describe('useSurrealConsolePresets', () => {
  it('initializes correctly', () => {
    const hook = useSurrealConsolePresets();
    expect(hook).toBeDefined();
  });
});
