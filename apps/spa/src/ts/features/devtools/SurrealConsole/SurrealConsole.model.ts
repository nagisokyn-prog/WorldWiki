/**
 * @file SurrealConsole.model.ts
 * @description Модели данных и типы для встроенной интерактивной консоли SurrealDB REPL
 */

export interface QueryHistoryItem {
  id: string;
  query: string;
  timestamp: string;
  durationMs: number;
  success: boolean;
  result?: unknown;
  error?: string;
}

export interface PresetQuery {
  label: string;
  description: string;
  query: string;
}

export interface SurrealConsoleProps {
  project?: string;
}
