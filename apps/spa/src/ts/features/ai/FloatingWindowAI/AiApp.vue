<template>
  <div class="wowilon-app-container">
    <AppDialog />
    <!-- SETTINGS VIEW -->
    <AiSettingsView 
      v-if="isSettingsOpen" 
      @close="isSettingsOpen = false" 
    />
    
    <!-- MAIN CHAT VIEW -->
    <div v-else class="wowilon-app-inner">
      <AiHeader 
        :is-detached="true" 
        @open-settings="isSettingsOpen = true" 
      />

      <div class="wowilon-body">
        <div class="wowilon-chat-area">
          <div ref="messagesContainer" class="messages-container">
            <div v-if="renderedMessages.length === 0" class="empty-chat-state">
              <i class="fas fa-comment-dots"></i>
              <p>Чем могу помочь сегодня?</p>
            </div>
            
            <div 
              v-for="(group, idx) in renderedMessages" 
              :key="group.activeMessage.id || idx" 
              class="message-wrapper" 
              :class="'message-' + group.activeMessage.role"
            >
              <div class="message-avatar">
                <i :class="group.activeMessage.role === 'user' ? 'fas fa-user' : 'fas fa-robot'"></i>
              </div>
              <SafeHtml class="message-content" :content="renderMarkdown(group.activeMessage.content)" />
            </div>
          </div>

          <div class="chat-input-container">
            <AiChatInput :loading="isGenerating" @submit="handleSend" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { AppDialog, SafeHtml } from '@worldwiki/components';
import { AiChatInput, AiHeader } from '../components';
import AiSettingsView from '../settings/AiSettingsView.vue';
import { useAiApp } from './useAiApp';

const {
  isSettingsOpen,
  messagesContainer,
  renderedMessages,
  isGenerating,
  renderMarkdown,
  handleSend
} = useAiApp();
</script>

<style scoped src="@worldwiki/resources/styles/features/ai/AiApp.css"></style>
