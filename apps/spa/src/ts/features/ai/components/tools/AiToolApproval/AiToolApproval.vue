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
import { 
  useAiToolApproval, 
  type AiToolApprovalProps, 
  type AiToolApprovalEmits,
  type ToolCallPayload 
} from './useAiToolApproval';

export type { ToolCallPayload };

const props = defineProps<AiToolApprovalProps>();
const emit = defineEmits<AiToolApprovalEmits>();

const {
  feedbackText,
  hasResponded,
  isApproved,
  formatArgs,
  approveTool,
  rejectWithFeedback
} = useAiToolApproval(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/ai/AiToolApproval.css"></style>
