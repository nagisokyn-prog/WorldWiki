import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openEntityEditorWindow } from '../windowManager';
import { WebviewWindow, getAllWebviewWindows } from '@tauri-apps/api/webviewWindow';

vi.mock('@tauri-apps/api/webviewWindow', () => {
  const mockWebview = vi.fn().mockImplementation(function (this: any, label: string, options: any) {
    this.label = label;
    this.options = options;
    this.once = vi.fn();
    this.setFocus = vi.fn();
    return this;
  });

  return {
    WebviewWindow: mockWebview,
    getAllWebviewWindows: vi.fn(),
  };
});

describe('windowManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('focuses existing window if one with label is already opened', async () => {
    const existingWin = {
      label: 'entity-editor-character-char-123',
      setFocus: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(getAllWebviewWindows).mockResolvedValue([existingWin as any]);

    await openEntityEditorWindow('proj1', 'character', 'char:123', 'Hero');

    expect(getAllWebviewWindows).toHaveBeenCalled();
    expect(existingWin.setFocus).toHaveBeenCalled();
    expect(WebviewWindow).not.toHaveBeenCalled();
  });

  it('creates new WebviewWindow when no existing window matches label', async () => {
    vi.mocked(getAllWebviewWindows).mockResolvedValue([]);

    await openEntityEditorWindow('proj1', 'character', 'char:123', 'Hero');

    expect(WebviewWindow).toHaveBeenCalledWith(
      'entity-editor-character-char-123',
      expect.objectContaining({
        title: 'Редактор: Hero',
        width: 800,
        height: 600,
      })
    );
  });

  it('handles errors gracefully without throwing', async () => {
    vi.mocked(getAllWebviewWindows).mockRejectedValue(new Error('Tauri IPC failure'));

    await expect(openEntityEditorWindow('proj1', 'character', '123', 'Hero')).resolves.not.toThrow();
  });
});
