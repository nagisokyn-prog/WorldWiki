// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAppDialog, appConfirm as appDialogConfirm, appAlert } from '../../../src/ts/composables/useAppDialog';
import { appConfirm as domConfirm } from '../../../src/ts/utils/dialogs';

describe('useAppDialog & dialogs', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('useAppDialog composable', () => {
    it('opens dialog with options and resolves true on confirm', async () => {
      const { showDialog, confirm, state } = useAppDialog();
      const promise = showDialog({ message: 'Are you sure?', title: 'Confirm Action' });

      expect(state.value.isOpen).toBe(true);
      expect(state.value.options.title).toBe('Confirm Action');
      expect(state.value.options.message).toBe('Are you sure?');

      confirm();
      const result = await promise;
      expect(result).toBe(true);
      expect(state.value.isOpen).toBe(false);
    });

    it('resolves false on cancel', async () => {
      const { showDialog, cancel, state } = useAppDialog();
      const promise = showDialog({ message: 'Delete item?' });

      expect(state.value.isOpen).toBe(true);
      expect(state.value.options.title).toBe('Внимание'); // default title

      cancel();
      const result = await promise;
      expect(result).toBe(false);
      expect(state.value.isOpen).toBe(false);
    });

    it('appDialogConfirm and appAlert helper functions trigger dialog', async () => {
      const { state, confirm } = useAppDialog();

      const confirmPromise = appDialogConfirm('Delete all?');
      expect(state.value.isOpen).toBe(true);
      expect(state.value.options.isAlert).toBe(false);
      confirm();
      expect(await confirmPromise).toBe(true);

      const alertPromise = appAlert('Success message!');
      expect(state.value.isOpen).toBe(true);
      expect(state.value.options.isAlert).toBe(true);
      confirm();
      expect(await alertPromise).toBe(true);
    });

    it('handles confirm and cancel safely when state.resolve is null (covers lines 41, 48)', () => {
      const { confirm, cancel, state } = useAppDialog();
      state.value.resolve = null;
      confirm();
      expect(state.value.isOpen).toBe(false);
      cancel();
      expect(state.value.isOpen).toBe(false);
    });
  });

  describe('DOM appConfirm dialog', () => {
    it('creates DOM overlay and resolves false on cancel click', async () => {
      const promise = domConfirm('Are you sure you want to proceed?', 'Warning');

      const cancelBtn = document.querySelector('#app-confirm-cancel') as HTMLButtonElement;
      expect(cancelBtn).not.toBeNull();
      cancelBtn.click();

      const result = await promise;
      expect(result).toBe(false);
      expect(document.querySelector('#app-confirm-cancel')).toBeNull();
    });

    it('creates DOM overlay and resolves true on confirm click', async () => {
      const promise = domConfirm('Do it now');

      const okBtn = document.querySelector('#app-confirm-ok') as HTMLButtonElement;
      expect(okBtn).not.toBeNull();
      okBtn.click();

      const result = await promise;
      expect(result).toBe(true);
      expect(document.querySelector('#app-confirm-ok')).toBeNull();
    });

    it('handles cleanup when overlay is already removed from DOM', async () => {
      const promise = domConfirm('Removed overlay test');
      const overlay = document.querySelector('div[style*="z-index:999999"]') as HTMLDivElement;
      const cancelBtn = document.querySelector('#app-confirm-cancel') as HTMLButtonElement;

      // Detach overlay before clicking
      if (overlay && overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
      cancelBtn.click();

      const result = await promise;
      expect(result).toBe(false);

      // Detached okBtn click
      const promiseOk = domConfirm('Removed overlay test OK');
      const overlayOk = document.querySelector('div[style*="z-index:999999"]') as HTMLDivElement;
      const okBtn = document.querySelector('#app-confirm-ok') as HTMLButtonElement;
      if (overlayOk && overlayOk.parentNode) {
        overlayOk.parentNode.removeChild(overlayOk);
      }
      okBtn.click();
      expect(await promiseOk).toBe(true);
    });

    it('handles null cancelBtn and okBtn querySelector in DOM appConfirm', () => {
      const origCreate = document.createElement.bind(document);
      const spy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        const el = origCreate(tag);
        if (tag === 'div') {
          vi.spyOn(el, 'querySelector').mockReturnValue(null);
        }
        return el;
      });

      domConfirm('Null buttons test');
      spy.mockRestore();
    });
  });
});


