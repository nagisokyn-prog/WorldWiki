import { describe, it, expect, beforeEach, vi } from 'vitest';
import { appConfirm } from '../../../src/ts/utils/dialogs';

describe('packages/components/src/ts/utils/dialogs.ts', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('resolves false on cancel button click', async () => {
    const promise = appConfirm('Cancel message', 'Custom Title');
    const cancelBtn = document.getElementById('app-confirm-cancel') as HTMLButtonElement;
    expect(cancelBtn).not.toBeNull();
    cancelBtn.click();

    expect(await promise).toBe(false);
    expect(document.getElementById('app-confirm-cancel')).toBeNull();
  });

  it('resolves true on ok button click with default title', async () => {
    const promise = appConfirm('OK message');
    const okBtn = document.getElementById('app-confirm-ok') as HTMLButtonElement;
    expect(okBtn).not.toBeNull();
    okBtn.click();

    expect(await promise).toBe(true);
    expect(document.getElementById('app-confirm-ok')).toBeNull();
  });

  it('handles cleanup when overlay is not contained in document.body', async () => {
    const promise = appConfirm('Removed overlay test');
    // In JSDOM, there is exactly one element appended to body
    const overlay = document.body.lastElementChild as HTMLDivElement;
    const cancelBtn = document.getElementById('app-confirm-cancel') as HTMLButtonElement;

    // Remove the overlay manually
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
    cancelBtn.click();
    expect(await promise).toBe(false);

    // Ok branch with removed overlay
    const promise2 = appConfirm('Removed overlay ok test');
    const overlay2 = document.body.lastElementChild as HTMLDivElement;
    const okBtn = document.getElementById('app-confirm-ok') as HTMLButtonElement;

    if (overlay2 && overlay2.parentNode) {
      overlay2.parentNode.removeChild(overlay2);
    }
    okBtn.click();
    expect(await promise2).toBe(true);
  });

  it('handles null cancelBtn and okBtn from querySelector safely', () => {
    const origCreate = document.createElement.bind(document);
    const spy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreate(tag);
      if (tag === 'div') {
        vi.spyOn(el, 'querySelector').mockReturnValue(null);
      }
      return el;
    });

    appConfirm('Null buttons message');
    spy.mockRestore();
  });
});
