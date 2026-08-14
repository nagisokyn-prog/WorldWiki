<template>
  <Transition name="modal-fade">
    <div v-if="state.isOpen" class="app-dialog-overlay" @click.self="handleOverlayClick">
      <div class="glass-modal app-dialog-content">
        <div class="modal-header">
          <h2 class="glass-title">{{ state.options.title }}</h2>
          <button class="close-btn glass-btn" @click="cancel">×</button>
        </div>
        <div class="modal-body">
          <p class="dialog-message">{{ state.options.message }}</p>
        </div>
        <div class="modal-footer dialog-footer">
          <button 
            v-if="!state.options.isAlert" 
            class="glass-btn secondary" 
            @click="cancel"
          >
            {{ state.options.cancelText }}
          </button>
          <button 
            class="glass-btn primary" 
            @click="confirm"
          >
            {{ state.options.confirmText }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { useAppDialog } from '../../ts/composables/useAppDialog';

const { state, confirm, cancel } = useAppDialog();

const handleOverlayClick = () => {
  // alerts can be dismissed by clicking outside, confirms usually shouldn't, 
  // but to be safe we'll treat overlay click as cancel
  cancel();
};
</script>

<style scoped>
.app-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999999;
}

.app-dialog-content {
  width: 100%;
  max-width: 420px;
  display: flex;
  flex-direction: column;
}

.dialog-message {
  color: var(--text-muted, #aaa);
  font-size: 14px;
  white-space: pre-wrap;
  line-height: 1.5;
  margin: 0;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 16px;
}

/* Transitions */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
.modal-fade-enter-from .app-dialog-content,
.modal-fade-leave-to .app-dialog-content {
  transform: scale(0.95) translateY(10px);
}
</style>
