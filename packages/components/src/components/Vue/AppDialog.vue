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

<style scoped src="@worldwiki/resources/styles/components/AppDialog.css"></style>
