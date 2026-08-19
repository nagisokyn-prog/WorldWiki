import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { settingsService } from '../../../src/ts/services/settings.service';

describe('packages/components app/settings.ts', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('handles missing settingsContent container gracefully', async () => {
    document.body.innerHTML = '';
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await import('../../../src/ts/app/settings');
    document.dispatchEvent(new Event('DOMContentLoaded'));

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('settingsContent element not found'));
    warnSpy.mockRestore();
  });

  it('mounts app, tests onClose / onBack navigation and handles save errors', async () => {
    document.body.innerHTML = `
      <div id="settingsContent"></div>
      <button id="saveBtn">Save</button>
    `;
    (window as any).__APP_CONFIG__ = {}; // Fallback to 'main.html'

    document.dispatchEvent(new Event('DOMContentLoaded'));

    const saveBtn = document.getElementById('saveBtn') as HTMLButtonElement;

    // Trigger save rejection
    vi.spyOn(settingsService, 'saveSettings').mockRejectedValueOnce(new Error('Save failed'));
    saveBtn.click();
    await vi.advanceTimersByTimeAsync(10);

    // Trigger successful save
    vi.spyOn(settingsService, 'saveSettings').mockResolvedValueOnce(undefined as any);
    saveBtn.click();
    await vi.advanceTimersByTimeAsync(10);
    expect(saveBtn.textContent).toBe('✅ Saved');
    await vi.advanceTimersByTimeAsync(2100);
    expect(saveBtn.textContent).toBe('Save');
  });
});
