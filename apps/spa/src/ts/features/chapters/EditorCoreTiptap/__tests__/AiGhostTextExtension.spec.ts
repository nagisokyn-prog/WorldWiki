import { describe, it, expect } from 'vitest';
import { AiGhostTextExtension } from '../AiGhostTextExtension';

describe('AiGhostTextExtension', () => {
  it('creates extension with options', () => {
    expect(AiGhostTextExtension.name).toBe('aiGhostText');
    const ext = AiGhostTextExtension.configure({ projectId: 'my-proj' });
    expect(ext.options.projectId).toBe('my-proj');
  });
});
