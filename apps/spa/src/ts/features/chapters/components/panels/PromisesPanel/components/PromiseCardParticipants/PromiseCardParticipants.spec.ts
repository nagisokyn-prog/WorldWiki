import { describe, it, expect } from 'vitest';
import { usePromiseCardParticipants } from './usePromiseCardParticipants';

describe('usePromiseCardParticipants', () => {
  it('initializes correctly', () => {
    const hook = usePromiseCardParticipants();
    expect(hook).toBeDefined();
  });
});
