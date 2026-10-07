/**
 * @file useSurrealConsole.ts
 * @description Composable логики для SurrealDB SQL консоли
 */

import { ref, computed, onMounted } from 'vue';
import * as api from '@/services/api.client';
import type { QueryHistoryItem, PresetQuery, SurrealConsoleProps } from './SurrealConsole.model';

const STORAGE_KEY_HISTORY = 'surreal_console_history_v1';
const MAX_HISTORY_ITEMS = 50;

export function useSurrealConsole(props?: SurrealConsoleProps) {
  const queryInput = ref('');
  const isLoading = ref(false);
  const history = ref<QueryHistoryItem[]>([]);
  const historyIndex = ref(-1);
  const activeResult = ref<QueryHistoryItem | null>(null);

  const cleanProject = computed(() => {
    const raw = props?.project || 'default';
    return raw.replace(/^projects:/, '').replace(/[`'"]/g, '');
  });

  const presets = computed<PresetQuery[]>(() => [
    {
      label: '📁 Проекты',
      description: 'Все проекты в базе',
      query: 'SELECT id, name, type::string(id) AS raw_id FROM projects;',
    },
    {
      label: '📖 Главы',
      description: 'Все главы с привязкой',
      query: `SELECT id, title, project_id, type::string(project_id) AS raw_project_id FROM chapters WHERE project_id = projects:⟨${cleanProject.value}⟩;`,
    },
    {
      label: '📚 Тома',
      description: 'Все тома проекта',
      query: `SELECT id, title, project_id, type::string(project_id) AS raw_project_id FROM volumes WHERE project_id = projects:⟨${cleanProject.value}⟩;`,
    },
    {
      label: '🔗 Иерархия contains',
      description: 'Связи проекта, томов и глав',
      query: 'SELECT in, out, sort_order FROM contains;',
    },
    {
      label: '🧙 Персонажи/Лор',
      description: 'Сущности текущего проекта',
      query: `SELECT id, name, entity_type, project_id FROM entities WHERE project_id = projects:⟨${cleanProject.value}⟩ LIMIT 50;`,
    },
    {
      label: '🌳 fn::get_chapter_hierarchy',
      description: 'Сбор полного дерева рукописи',
      query: `RETURN fn::get_chapter_hierarchy(projects:⟨${cleanProject.value}⟩);`,
    },
    {
      label: 'ℹ️ Схема базы (INFO FOR DB)',
      description: 'Таблицы, индексы, события и функции',
      query: 'INFO FOR DB;',
    },
  ]);

  const loadHistory = () => {
    if (typeof localStorage === 'undefined') return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY_HISTORY);
      if (saved) {
        history.value = JSON.parse(saved);
        if (history.value.length > 0) {
          activeResult.value = history.value[0];
        }
      }
    } catch {
      history.value = [];
    }
  };

  const saveHistory = () => {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(
        STORAGE_KEY_HISTORY,
        JSON.stringify(history.value.slice(0, MAX_HISTORY_ITEMS))
      );
    } catch {
      // ignore
    }
  };

  const executeQuery = async (customQuery?: string) => {
    const rawSql = (customQuery !== undefined ? customQuery : queryInput.value).trim();
    if (!rawSql || isLoading.value) return;

    isLoading.value = true;
    historyIndex.value = -1;
    const start = performance.now();

    const item: QueryHistoryItem = {
      id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      query: rawSql,
      timestamp: new Date().toLocaleTimeString(),
      durationMs: 0,
      success: false,
    };

    try {
      const res = await api.executeRawSurql(rawSql);
      const elapsed = Math.round(performance.now() - start);
      item.durationMs = elapsed;
      item.success = true;
      item.result = res;
    } catch (err: unknown) {
      const elapsed = Math.round(performance.now() - start);
      item.durationMs = elapsed;
      item.success = false;
      item.error = err instanceof Error ? err.message : String(err);
    } finally {
      isLoading.value = false;
      activeResult.value = item;
      history.value.unshift(item);
      if (history.value.length > MAX_HISTORY_ITEMS) {
        history.value.pop();
      }
      saveHistory();
    }
  };

  const selectPreset = (preset: PresetQuery) => {
    queryInput.value = preset.query;
  };

  const selectHistoryItem = (item: QueryHistoryItem) => {
    queryInput.value = item.query;
    activeResult.value = item;
  };

  const navigateHistory = (direction: 'up' | 'down') => {
    if (history.value.length === 0) return;

    if (direction === 'up') {
      if (historyIndex.value < history.value.length - 1) {
        historyIndex.value++;
        const item = history.value[historyIndex.value];
        if (item) {
          queryInput.value = item.query;
          activeResult.value = item;
        }
      }
    } else {
      if (historyIndex.value > 0) {
        historyIndex.value--;
        const item = history.value[historyIndex.value];
        if (item) {
          queryInput.value = item.query;
          activeResult.value = item;
        }
      } else if (historyIndex.value === 0) {
        historyIndex.value = -1;
        queryInput.value = '';
      }
    }
  };

  const clearHistory = () => {
    history.value = [];
    activeResult.value = null;
    historyIndex.value = -1;
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY_HISTORY);
    }
  };

  const formattedOutput = computed(() => {
    if (!activeResult.value) return '';
    if (!activeResult.value.success) {
      return `❌ Error (${activeResult.value.durationMs}ms):\n${activeResult.value.error}`;
    }
    return JSON.stringify(activeResult.value.result, null, 2);
  });

  onMounted(() => {
    loadHistory();
  });

  return {
    queryInput,
    isLoading,
    history,
    historyIndex,
    activeResult,
    presets,
    formattedOutput,
    executeQuery,
    selectPreset,
    selectHistoryItem,
    navigateHistory,
    clearHistory,
  };
}
