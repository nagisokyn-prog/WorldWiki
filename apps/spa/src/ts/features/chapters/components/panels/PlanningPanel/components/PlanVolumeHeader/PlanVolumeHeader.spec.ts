import { describe, it, expect } from 'vitest';
import { usePlanVolumeHeader } from './usePlanVolumeHeader';

describe('usePlanVolumeHeader', () => {
  it('initializes correctly', () => {
    const hook = usePlanVolumeHeader();
    expect(hook).toBeDefined();
  });
});
