import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { settingsService } from '../../../src/ts/services/settings.service';

describe('packages/components app/settings.ts', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = `
      <div id="settingsContent"></div>
      <button id="saveBtn">Save</button>
    `;
    (window as any).__APP_CONFIG__ = { backUrl: 'custom_back.html' };
    vi.spyOn(settingsService, 'saveSettings').mockResolvedValue(undefined as any);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('mounts app on DOMContentLoaded and binds save button', async () => {
    // Dynamically import settings app entrypoint
    await import('../../../src/ts/app/settings');

    document.dispatchEvent(new Event('DOMContentLoaded'));

    const saveBtn = document.getElementById('saveBtn') as HTMLButtonElement;
    expect(saveBtn).not.toBeNull();

    saveBtn.click();
    await vi.advanceTimersByTimeAsync(10);

    expect(saveBtn.textContent).toBe('✅ Saved');
    await vi.advanceTimersByTimeAsync(2100);
    expect(saveBtn.textContent).toBe('Save');
  });
});
