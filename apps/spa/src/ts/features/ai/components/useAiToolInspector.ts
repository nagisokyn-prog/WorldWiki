import { ref, watch } from 'vue';
import { invoke } from '@tauri-apps/api/core';

export interface AiToolInspectorProps {
  currentProject: string;
  isOpen: boolean;
}

export interface AiToolInspectorEmits {
  (e: 'close'): void;
  (e: 'insert-context', text: string): void;
}

export function useAiToolInspector(
  props: AiToolInspectorProps,
  emit: AiToolInspectorEmits
) {
  const selectedTool = ref<'query_world' | 'inspect_entity' | 'read_manuscript'>('query_world');
  const queryInput = ref('Лёха');
  const scopeInput = ref<'all' | 'entities' | 'chapters'>('all');
  const topKInput = ref(8);
  const isLoading = ref(false);
  const executionTimeMs = ref<number | null>(null);
  const resultJson = ref<string | null>(null);
  const resultError = ref<string | null>(null);

  watch(() => props.isOpen, (v) => {
    console.log('🔥🔥🔥 [useAiToolInspector] isOpen prop is now:', v);
  }, { immediate: true });

  const executeTool = async () => {
    if (!props.currentProject) return;
    isLoading.value = true;
    resultError.value = null;
    resultJson.value = null;
    executionTimeMs.value = null;

    const start = performance.now();
    let toolInput: Record<string, unknown> = {};

    if (selectedTool.value === 'query_world') {
      toolInput = {
        query: queryInput.value.trim(),
        scope: scopeInput.value,
        top_k: topKInput.value,
      };
    } else if (selectedTool.value === 'inspect_entity') {
      toolInput = {
        entity_id_or_name: queryInput.value.trim(),
      };
    } else if (selectedTool.value === 'read_manuscript') {
      toolInput = {
        chapter_id: queryInput.value.trim() || 'list',
      };
    }

    console.log(`🔥🔥🔥 [TOOL INSPECTOR] Executing tool='${selectedTool.value}' project='${props.currentProject}' input=`, toolInput);
    try {
      const res = await invoke<unknown>('execute_ai_tool_direct', {
        project: props.currentProject,
        toolName: selectedTool.value,
        toolInput,
      });
      executionTimeMs.value = Math.round(performance.now() - start);
      resultJson.value = JSON.stringify(res, null, 2);
      console.log(`🔥🔥🔥 [TOOL INSPECTOR] Success (${executionTimeMs.value}ms):`, res);
    } catch (err) {
      executionTimeMs.value = Math.round(performance.now() - start);
      resultError.value = String(err);
      console.error(`🔥🔥🔥 [TOOL INSPECTOR] Execution Error (${executionTimeMs.value}ms):`, err);
    } finally {
      isLoading.value = false;
    }
  };

  const copyResult = async () => {
    if (resultJson.value) {
      await navigator.clipboard.writeText(resultJson.value);
    }
  };

  const insertIntoContext = () => {
    if (resultJson.value) {
      emit('insert-context', `[Результат инструмента ${selectedTool.value}]:\n${resultJson.value}`);
      emit('close');
    }
  };

  const closeModal = () => {
    emit('close');
  };

  return {
    selectedTool,
    queryInput,
    scopeInput,
    topKInput,
    isLoading,
    executionTimeMs,
    resultJson,
    resultError,
    executeTool,
    copyResult,
    insertIntoContext,
    closeModal,
  };
}
