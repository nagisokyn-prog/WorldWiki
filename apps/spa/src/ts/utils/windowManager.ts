import { WebviewWindow, getAllWebviewWindows } from '@tauri-apps/api/webviewWindow';

export async function openEntityEditorWindow(project: string, type: string, id: string, name: string) {
    const label = `entity-editor-${type}-${id.replace(/:/g, '-')}`;

    try {
        // Check if window already exists
        const windows = await getAllWebviewWindows();
        const existingWindow = windows.find((w: WebviewWindow) => w.label === label);
        if (existingWindow) {
            await existingWindow.setFocus();
            return;
        }

        // Create new window
        const webview = new WebviewWindow(label, {
            url: `ui_editor.html?project=${encodeURIComponent(project)}&type=${encodeURIComponent(type)}&id=${encodeURIComponent(id)}`,
            title: `Редактор: ${name}`,
            width: 800,
            height: 600,
            minWidth: 400,
            minHeight: 300,
            decorations: true,
            center: true,
            backgroundColor: [15, 17, 23, 255]
        });

        webview.once('tauri://created', () => {
            console.log(`Window ${label} created successfully.`);
        });

        webview.once('tauri://error', (e) => {
            console.error(`Error creating window ${label}:`, e);
        });
    } catch (e) {
        console.error('Failed to open window', e);
    }
}

export async function openCharacterJourneyWindow(project: string, entityId?: string): Promise<boolean> {
    const label = `character-journey-${project.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

    try {
        const windows = await getAllWebviewWindows();
        const existingWindow = windows.find((w: WebviewWindow) => w.label === label);
        if (existingWindow) {
            await existingWindow.setFocus();
            return true;
        }

        const queryParams = new URLSearchParams({ project });
        if (entityId) queryParams.set('entity', entityId);

        const webview = new WebviewWindow(label, {
            url: `character_journey.html?${queryParams.toString()}`,
            title: '🗺️ Навигатор Сцен & Путь Персонажа',
            width: 1000,
            height: 700,
            minWidth: 760,
            minHeight: 520,
            decorations: true,
            center: true,
            backgroundColor: [15, 17, 23, 255]
        });

        webview.once('tauri://created', () => {
            console.log(`Character Journey window ${label} created successfully.`);
        });

        webview.once('tauri://error', (e) => {
            console.error(`Error creating Character Journey window ${label}:`, e);
        });
        return true;
    } catch (e) {
        console.error('Failed to open Character Journey window', e);
        return false;
    }
}

