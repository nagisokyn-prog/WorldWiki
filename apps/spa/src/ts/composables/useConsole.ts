import { ref, triggerRef } from 'vue';

export interface Toast {
  id: number;
  text: string;
  type: 'success' | 'warn' | 'error' | 'info';
}

export function useConsole(ctx?: {
  settings?: { value: { notifications?: { duration?: number } } };
}) {
  const consoleLogs = ref<Array<{ id: number; text: string; type: 'info' | 'warn' | 'error' | 'success'; timestamp: string }>>([]);
  const toasts = ref<Toast[]>([]);
  let logCounter = 0;
  let toastIdCounter = 0;

  const addLog = (text: string, type: 'info' | 'warn' | 'error' | 'success' = 'info') => {
    const logs = consoleLogs.value;
    logs.unshift({ id: ++logCounter, text, type, timestamp: new Date().toLocaleTimeString() });
    if (logs.length > 100) logs.splice(100);
    triggerRef(consoleLogs);
  };

  const addToast = (text: string, type: Toast['type'] = 'info') => {
    const duration = ctx?.settings?.value?.notifications?.duration;
    const id = ++toastIdCounter;
    toasts.value.push({ id, text, type });
    const ms = typeof duration === 'number' ? duration : 3000;
    setTimeout(() => {
      toasts.value = toasts.value.filter(t => t.id !== id);
    }, ms);
  };

  const getToastIcon = (type: Toast['type']) => {
    switch (type) {
      case 'success': return 'fas fa-check-circle';
      case 'warn': return 'fas fa-exclamation-triangle';
      case 'error': return 'fas fa-times-circle';
      default: return 'fas fa-info-circle';
    }
  };

  return {
    consoleLogs,
    toasts,
    addLog,
    addToast,
    getToastIcon,
  };
}