import { ref, shallowRef, triggerRef, onMounted } from 'vue';

export interface Toast {
  id: number;
  text: string;
  type: 'success' | 'warn' | 'error' | 'info';
}

export interface ConsoleLog {
  id: number;
  text: string;
  type: 'info' | 'warn' | 'error' | 'success';
  timestamp: string;
}

export function useWorldWikiShell() {
  // Shell UI State
  const activeView = ref<'entity' | 'chapters' | 'static' | 'sandbox'>('entity');
  const currentSidebarTab = ref<string | null>(null);
  const showSettings = ref(false);
  const sidebarSearch = ref('');
  const activePanelTab = ref('');
  const sidebarVisible = ref(true);
  const zoomLevel = ref(parseFloat(localStorage.getItem('app-zoom') || '1'));
  const panelHeight = ref(parseInt(localStorage.getItem('app-panel-height') || '150'));
  const sidebarWidth = ref(parseInt(localStorage.getItem('app-sidebar-width') || '280'));
  const activeTreeNode = ref<{ type: string; node: any } | null>(null);

  // Logs & Toasts
  const consoleLogs = shallowRef<ConsoleLog[]>([]);
  let logCounter = 0;
  
  const toasts = ref<Toast[]>([]);
  let toastIdCounter = 0;

  const addLog = (text: string, type: 'info' | 'warn' | 'error' | 'success' = 'info') => {
    const logs = consoleLogs.value;
    logs.unshift({ id: ++logCounter, text, type, timestamp: new Date().toLocaleTimeString() });
    if (logs.length > 100) {
      logs.splice(100);
    }
    triggerRef(consoleLogs);
  };

  const addToast = (text: string, type: Toast['type'] = 'info', duration: number = 3000) => {
    const id = ++toastIdCounter;
    toasts.value.push({ id, text, type });
    setTimeout(() => {
      toasts.value = toasts.value.filter(t => t.id !== id);
    }, duration);
  };

  const getToastIcon = (type: Toast['type']) => {
    switch (type) {
      case 'success': return 'fas fa-check-circle';
      case 'warn': return 'fas fa-exclamation-triangle';
      case 'error': return 'fas fa-times-circle';
      default: return 'fas fa-info-circle';
    }
  };

  const applyZoom = (level: number) => {
    const clamped = Math.max(0.5, Math.min(2, level));
    zoomLevel.value = clamped;
    document.documentElement.style.setProperty('--app-zoom', String(clamped));
    const appEl = document.getElementById('app');
    if (appEl) {
      appEl.style.transform = `scale(${clamped})`;
      appEl.style.transformOrigin = 'top left';
      appEl.style.width = `${100 / clamped}%`;
      appEl.style.height = `${100 / clamped}%`;
    }
    localStorage.setItem('app-zoom', String(clamped));
  };

  return {
    activeView,
    currentSidebarTab,
    showSettings,
    sidebarSearch,
    activePanelTab,
    sidebarVisible,
    zoomLevel,
    panelHeight,
    sidebarWidth,
    activeTreeNode,
    consoleLogs,
    toasts,
    addLog,
    addToast,
    getToastIcon,
    applyZoom
  };
}
