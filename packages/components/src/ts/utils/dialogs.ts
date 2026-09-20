import { onScopeDispose } from 'vue';

export const appConfirm = async (message: string, title: string = 'Подтверждение'): Promise<boolean> => {
    return new Promise<boolean>(resolve => {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:999999;backdrop-filter:blur(4px);';
        
        const modal = document.createElement('div');
        modal.style.cssText = 'background:var(--bg-card, #1e1e1e);padding:24px;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,0.5);border:1px solid var(--border-color, #333);max-width:400px;text-align:center;color:var(--text-main, #eee);font-family:inherit;';
        
        modal.innerHTML = `
            <h3 style="margin-top:0;margin-bottom:16px;font-size:18px;">${title}</h3>
            <p style="margin-bottom:24px;color:var(--text-muted, #aaa);font-size:14px;white-space:pre-wrap;">${message}</p>
            <div style="display:flex;gap:12px;justify-content:center;">
                <button id="app-confirm-cancel" style="padding:10px 20px;border-radius:8px;border:1px solid var(--border-color, #333);background:transparent;color:var(--text-main, #eee);cursor:pointer;transition:0.2s;" onmouseover="this.style.background='var(--bg-hover, rgba(255,255,255,0.1))'" onmouseout="this.style.background='transparent'">Отмена</button>
                <button id="app-confirm-ok" style="padding:10px 20px;border-radius:8px;border:none;background:#ff5555;color:#fff;cursor:pointer;font-weight:bold;transition:0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">Подтвердить</button>
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
