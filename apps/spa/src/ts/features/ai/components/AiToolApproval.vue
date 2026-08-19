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

const props = defineProps<{
  toolCall: any;
}>();

const emit = defineEmits<{
  (e: 'approve', payload: { toolCallId: string; approved: boolean }): void;
  (e: 'reject', payload: { toolCallId: string; approved: boolean; feedback: string }): void;
}>();

const feedbackText = ref('');
const hasResponded = ref(false);
const isApproved = ref(false);

const formatArgs = (args: any) => {
  try {
    return JSON.stringify(args, null, 2);
  } catch {
    return String(args);
  }
};

const approveTool = () => {
  hasResponded.value = true;
  isApproved.value = true;
  emit('approve', { toolCallId: props.toolCall.tool_call_id, approved: true });
};

const rejectWithFeedback = () => {
  hasResponded.value = true;
  isApproved.value = false;
  emit('reject', { 
    toolCallId: props.toolCall.tool_call_id, 
    approved: false, 
    feedback: feedbackText.value 
  });
};
</script>

<style scoped>
.tool-approval-card {
  background: var(--bg-panel);
  border: 1px solid var(--accent);
  border-radius: 8px;
  overflow: hidden;
  margin: 10px 0;
  box-shadow: 0 4px 12px rgba(139, 92, 246, 0.15);
}

.tool-header {
  background: rgba(139, 92, 246, 0.1);
  padding: 10px 14px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(139, 92, 246, 0.2);
}

.tool-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-main);
  display: flex;
  align-items: center;
  gap: 8px;
}

.tool-title i {
  color: var(--accent);
}

.tool-name {
  font-family: monospace;
  background: var(--bg-surface);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
  color: var(--accent);
  border: 1px solid var(--border-color);
}

.tool-body {
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.args-viewer {
  background: var(--bg-input);
  border-radius: 6px;
  border: 1px solid var(--border-color);
  overflow: hidden;
}

.args-header {
  padding: 6px 10px;
  font-size: 11px;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border-color);
  background: rgba(0, 0, 0, 0.2);
}

.args-content {
  margin: 0;
  padding: 10px;
  font-size: 12px;
  color: var(--text-main);
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 150px;
  overflow-y: auto;
}

.approval-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.feedback-input .input-base {
  width: 100%;
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  color: var(--text-main);
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13px;
}

.feedback-input .input-base:focus {
  border-color: var(--accent);
  outline: none;
}

.buttons-row {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.buttons-row button {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  border: none;
  transition: all 0.2s;
}

.btn-reject {
  background: transparent;
  color: var(--danger);
  border: 1px solid var(--danger) !important;
}

.btn-reject:hover {
  background: rgba(250, 82, 82, 0.1);
}

.btn-approve {
  background: var(--accent);
  color: white;
}

.btn-approve:hover {
  background: var(--accent-hover);
}

.response-status {
  padding: 8px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: center;
}

.response-status.approved {
  background: rgba(139, 92, 246, 0.1);
  color: var(--accent);
  border: 1px solid rgba(139, 92, 246, 0.2);
}

.response-status.rejected {
  background: rgba(250, 82, 82, 0.1);
  color: var(--danger);
  border: 1px solid rgba(250, 82, 82, 0.2);
}
</style>
