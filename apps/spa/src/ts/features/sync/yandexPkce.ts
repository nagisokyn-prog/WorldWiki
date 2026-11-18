export const YANDEX_CLIENT_ID = 'bbbe3d5f9d2d4356868756399fecf9b6';

function toBase64Url(bytes: Uint8Array): string {
    let binary = '';
    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Генерирует одноразовую пару PKCE (verifier + SHA-256 challenge) для Яндекс OAuth. */
export async function createPkcePair(): Promise<{ verifier: string; challenge: string }> {
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    const verifier = toBase64Url(randomBytes);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    const challenge = toBase64Url(new Uint8Array(digest));
    return { verifier, challenge };
}

export function formatErrorMessage(err: unknown): string {
    if (!err) return 'Неизвестная ошибка';
    if (typeof err === 'string') return err;
    if (err instanceof Error) return err.message;
    if (typeof err === 'object') {
        const obj = err as Record<string, unknown>;
        if (typeof obj.message === 'string' && obj.message) return obj.message;
        if (typeof obj.error === 'string' && obj.error) return obj.error;
        try {
            return JSON.stringify(err);
        } catch (stringifyErr) {
            console.warn('[CloudSync] Failed to serialize error object:', stringifyErr);
        }
    }
    return String(err);
}
