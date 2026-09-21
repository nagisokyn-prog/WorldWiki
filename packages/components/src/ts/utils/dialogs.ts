import { onScopeDispose } from 'vue';

export const appConfirm = async (message: string, title: string = 'Подтверждение'): Promise<boolean> => {
    return new Promise<boolean>(resolve => {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:var(--modal-backdrop);display:flex;align-items:center;justify-content:center;z-index:999999;backdrop-filter:blur(4px);';
        
        const modal = document.createElement('div');
        modal.style.cssText = 'background:var(--bg-card);padding:24px;border-radius:var(--radius-md);box-shadow:var(--shadow-dropdown);border:1px solid var(--border-color);max-width:400px;text-align:center;color:var(--text-main);font-family:inherit;';
        
        modal.innerHTML = `
            <h3 style="margin-top:0;margin-bottom:16px;font-size:18px;">${title}</h3>
            <p style="margin-bottom:24px;color:var(--text-muted);font-size:14px;white-space:pre-wrap;">${message}</p>
            <div style="display:flex;gap:12px;justify-content:center;">
                <button id="app-confirm-cancel" style="padding:10px 20px;border-radius:var(--radius-sm);border:1px solid var(--border-color);background:transparent;color:var(--text-main);cursor:pointer;transition:0.2s;" onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background='transparent'">Отмена</button>
                <button id="app-confirm-ok" style="padding:10px 20px;border-radius:var(--radius-sm);border:none;background:var(--error);color:var(--accent-text);cursor:pointer;font-weight:bold;transition:0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">Подтвердить</button>
            </div>
        `;
        
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        
        const cancelBtn = modal.querySelector('#app-confirm-cancel');
        const okBtn = modal.querySelector('#app-confirm-ok');
        
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                cleanup();
                resolve(false);
            }
        };

        const cleanup = () => {
            window.removeEventListener('keydown', onKeyDown);
            if (document.body.contains(overlay)) {
                document.body.removeChild(overlay);
            }
        };

        window.addEventListener('keydown', onKeyDown);
        
        cancelBtn?.addEventListener('click', () => { cleanup(); resolve(false); }, { once: true });
        okBtn?.addEventListener('click', () => { cleanup(); resolve(true); }, { once: true });
    });
};

export function useAppConfirm() {
    let activeCleanup: (() => void) | null = null;
    onScopeDispose(() => {
        if (activeCleanup) {
            activeCleanup();
            activeCleanup = null;
        }
    });
    return {
        confirm: (msg: string, title?: string) => appConfirm(msg, title)
    };
}
