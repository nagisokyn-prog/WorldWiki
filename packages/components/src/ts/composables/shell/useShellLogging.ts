/**
 * @file useShellLogging.ts
 * @description Логирование консоли и тосты для shell приложения
 */

import { ref, shallowRef, triggerRef } from 'vue';

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

export function useShellLogging(toastDuration = 3000) {
  // Toasts
  const toasts = ref<Toast[]>([]);
  let toastId = 0;

  const addToast = (text: string, type: Toast['type'] = 'info') => {
    const id = ++toastId;
    toasts.value.push({ id, text, type });
    setTimeout(() => {
      toasts.value = toasts.value.filter(t => t.id !== id);
    }, toastDuration);
  };

  const getToastIcon = (type: Toast['type']) => {
    switch (type) {
      case 'success': return 'fas fa-check-circle';
      case 'warn': return 'fas fa-exclamation-triangle';
      case 'error': return 'fas fa-times-circle';
      default: return 'fas fa-info-circle';
    }
  };

  // Console log
  const consoleLogs = shallowRef<ConsoleLog[]>([]);
  let logCounter = 0;

  const addLog = (text: string, type: ConsoleLog['type'] = 'info') => {
    const logs = consoleLogs.value;
    logs.unshift({ id: ++logCounter, text, type, timestamp: new Date().toLocaleTimeString() });
    if (logs.length > 100) logs.splice(100);
    triggerRef(consoleLogs);
  };

  return {
    toasts,
    addToast,
    getToastIcon,
    consoleLogs,
    addLog
  };
}
