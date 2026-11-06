import { describe, it, expect } from 'vitest';
import { useTab2SyncCalendarForm } from './useTab2SyncCalendarForm';

describe('useTab2SyncCalendarForm', () => {
  it('initializes correctly', () => {
    const hook = useTab2SyncCalendarForm();
    expect(hook).toBeDefined();
  });
});
