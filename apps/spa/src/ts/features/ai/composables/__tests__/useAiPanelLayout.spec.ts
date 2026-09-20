import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, nextTick } from 'vue';
import { useAiPanelLayout } from '../useAiPanelLayout';

vi.mock('@tauri-apps/api/webviewWindow', () => ({
  WebviewWindow: vi.fn().mockImplementation(() => ({
    once: vi.fn(),
  })),
}));

describe('useAiPanelLayout', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('initializes with default layout values from localStorage', () => {
    localStorage.setItem('worldwiki_ai_panel_width', '500');
    localStorage.setItem('worldwiki_ai_show_sidebar', 'true');
    localStorage.setItem('worldwiki_ai_settings_open', 'true');

    const emitClose = vi.fn();
    const activeChatId = ref('chat_1');

    const layout = useAiPanelLayout({
      emitClose,
      activeChatId,
      currentProject: 'projects:p1'
    });

    expect(layout.panelWidth.value).toBe(500);
    expect(layout.showSidebar.value).toBe(true);
    expect(layout.isSettingsOpen.value).toBe(true);
    expect(layout.isToolInspectorOpen.value).toBe(false);
  });

  it('toggles sidebar and saves to localStorage', async () => {
    const layout = useAiPanelLayout({
      emitClose: vi.fn(),
      activeChatId: ref('chat_1'),
      currentProject: 'projects:p1'
    });

    expect(layout.showSidebar.value).toBe(false);
    layout.toggleSidebar();
    expect(layout.showSidebar.value).toBe(true);
    await nextTick();
    expect(localStorage.getItem('worldwiki_ai_show_sidebar')).toBe('true');
  });

  it('handles startResize mouse move events within boundaries', () => {
    const layout = useAiPanelLayout({
      emitClose: vi.fn(),
      activeChatId: ref('chat_1'),
      currentProject: 'projects:p1'
    });

    layout.panelWidth.value = 400;
    const mousedownEv = new MouseEvent('mousedown', { clientX: 1000 });
    layout.startResize(mousedownEv);

    // Simulate mousemove: delta = 1000 - 900 = 100 -> new width = 500
    const mousemoveEv = new MouseEvent('mousemove', { clientX: 900 });
    document.dispatchEvent(mousemoveEv);
    expect(layout.panelWidth.value).toBe(500);

    // Simulate mouseup
    const mouseupEv = new MouseEvent('mouseup');
    document.dispatchEvent(mouseupEv);
  });

  it('invokes detachWindow and emits close', async () => {
    const emitClose = vi.fn();
    const layout = useAiPanelLayout({
      emitClose,
      activeChatId: ref('chat_123'),
      currentProject: 'projects:p1'
    });

    await layout.detachWindow();
    expect(emitClose).toHaveBeenCalled();
  });
});
