import type { QueryHistoryItem } from '../SurrealConsole.model'

export interface SurrealConsoleOutputProps {
  output: string;
    result: QueryHistoryItem | null;
    loading: boolean;
}

export type SurrealConsoleOutputEmits = {};
