<template>
  <div ref="containerRef" class="messages-container" @scroll="$emit('scroll', $event)">
    <!-- Пустое состояние -->
    <div v-if="messages.length === 0" class="empty-chat-state">
      <i class="fas fa-comment-dots"></i>
      <p v-if="activeChatId">
        <span class="chat-title-label">Чат: </span>{{ chatTitle }}
      </p>
      <p v-else>Выберите чат слева или создайте новый</p>
    </div>
    
    <!-- Список сообщений -->
    <template v-else>
      <AiMessageItem
        v-for="(group, idx) in renderedMessages"
        :key="group.activeMessage.id || idx"
        :group="group"
        :idx="idx"
        :editing-message-id="editingMessageId"
        :edit-draft="editDraft"
        :render-markdown="renderMarkdown"
        :is-generating="isGenerating"
        @update:edit-draft="$emit('update:editDraft', $event)"
        @switch-variant="$emit('switch-variant', $event)"
        @start-edit="$emit('start-edit', $event)"
        @cancel-edit="$emit('cancel-edit')"
        @save-edit="$emit('save-edit', $event)"
        @regenerate="$emit('regenerate', $event)"
        @branch="$emit('branch', $event)"
        @delete="$emit('delete', $event)"
        @tool-approve="$emit('tool-approve', $event)"
        @tool-reject="$emit('tool-reject', $event)"
        @ask-source="$emit('ask-source', $event)"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import AiMessageItem from '../AiMessageItem/AiMessageItem.vue';
import type { AiMessageListProps, AiMessageListEmits } from './AiMessageList.model';
import { useAiMessageList } from './useAiMessageList';

defineProps<AiMessageListProps>();
defineEmits<AiMessageListEmits>();

const { containerRef } = useAiMessageList();

defineExpose({
  containerRef
});
</script>

<style scoped src="@worldwiki/resources/styles/features/ai/AiMessageList.css"></style>
