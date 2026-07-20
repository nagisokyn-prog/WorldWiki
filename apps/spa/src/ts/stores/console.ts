/**
 * @file console.ts
 * @description Pinia store для консоли (логи и тосты)
 */
import { defineStore } from 'pinia';
import { ref } from 'vue';

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

export const useConsoleStore = defineStore('console', () => {
  const consoleLogs = ref<ConsoleLog[]>([]);
  const toasts = ref<Toast[]>([]);
  
  let logCounter = 0;
  let toastIdCounter = 0;

  const addLog = (text: string, type: 'info' | 'warn' | 'error' | 'success' = 'info') => {
    const logs = consoleLogs.value;
    logs.unshift({ id: ++logCounter, text, type, timestamp: new Date().toLocaleTimeString() });
    if (logs.length > 100) logs.splice(100);
  };

  const addToast = (text: string, type: Toast['type'] = 'info') => {
    const id = ++toastIdCounter;
    toasts.value.push({ id, text, type });
    setTimeout(() => {
      toasts.value = toasts.value.filter(t => t.id !== id);
    }, 3000);
  };

  const getToastIcon = (type: Toast['type']): string => {
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
});