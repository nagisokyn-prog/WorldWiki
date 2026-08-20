<template>
  <div class="tool-approval-card">
    <div class="tool-header">
      <div class="tool-title">
        <i class="fas fa-tools"></i> ИИ хочет использовать инструмент
      </div>
      <div class="tool-name">{{ toolCall.tool_name }}</div>
    </div>
    
    <div class="tool-body">
      <div class="args-viewer">
        <div class="args-header">Аргументы:</div>
        <pre class="args-content">{{ formatArgs(toolCall.tool_args) }}</pre>
      </div>

      <div v-if="!hasResponded" class="approval-actions">
        <div class="feedback-input">
          <input 
            v-model="feedbackText" 
            type="text" 
            class="input-base" 
            placeholder="Опционально: почему вы отклоняете это действие?"
            @keyup.enter="rejectWithFeedback"
          >
        </div>
        
        <div class="buttons-row">
          <button class="btn-reject" @click="rejectWithFeedback">
            <i class="fas fa-times"></i> Отклонить
          </button>
          <button class="btn-approve" @click="approveTool">
            <i class="fas fa-check"></i> Разрешить
          </button>
        </div>
      </div>
      
      <div v-else class="response-status" :class="{ approved: isApproved, rejected: !isApproved }">
        <i :class="isApproved ? 'fas fa-check-circle' : 'fas fa-times-circle'"></i>
        {{ isApproved ? 'Разрешено' : 'Отклонено' }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

export interface ToolCallPayload {
  tool_call_id?: string;
  tool_name?: string;
  arguments?: unknown;
  [key: string]: unknown;
}

const props = defineProps<{
  toolCall: ToolCallPayload;
}>();

const emit = defineEmits<{
  (e: 'approve', payload: { toolCallId: string; approved: boolean }): void;
  (e: 'reject', payload: { toolCallId: string; approved: boolean; feedback: string }): void;
}>();

const feedbackText = ref('');
const hasResponded = ref(false);
const isApproved = ref(false);

const formatArgs = (args: unknown) => {
  try {
    return JSON.stringify(args, null, 2);
  } catch {
    return String(args);
  }
};

const approveTool = () => {
  hasResponded.value = true;
  isApproved.value = true;
  emit('approve', { toolCallId: props.toolCall.tool_call_id || '', approved: true });
};

const rejectWithFeedback = () => {
  hasResponded.value = true;
  isApproved.value = false;
  emit('reject', { 
    toolCallId: props.toolCall.tool_call_id || '', 
    approved: false, 
    feedback: feedbackText.value 
  });
};
</script>

<style scoped src="@worldwiki/resources/styles/features/ai/AiToolApproval.css"></style>
