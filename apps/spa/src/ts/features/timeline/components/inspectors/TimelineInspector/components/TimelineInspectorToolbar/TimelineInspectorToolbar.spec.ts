import { describe, it, expect } from 'vitest';
import { useTimelineInspectorToolbar } from './useTimelineInspectorToolbar';

describe('useTimelineInspectorToolbar', () => {
  it('initializes correctly', () => {
    const hook = useTimelineInspectorToolbar();
    expect(hook).toBeDefined();
  });
});
