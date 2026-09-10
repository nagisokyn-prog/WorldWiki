<template>
  <div ref="containerRef" class="ai-auto-approve-container">
    <button 
      class="auto-approve-badge-btn" 
      :class="{ 'is-active': activeCount > 0 && state.enabled }"
      :title="'Настройка авто-разрешений инструментов'"
      @click="toggleModal"
    >
      <i class="fas fa-shield-alt"></i>
      <span>{{ badgeText }}</span>
      <i class="fas fa-chevron-down badge-chevron"></i>
    </button>

    <div v-if="isOpen" class="auto-approve-popover" :class="{ 'open-down': placement === 'bottom' }">
      <div class="modal-header">
        <div class="modal-title-row">
          <span class="modal-title">Авто-разрешения</span>
          <i class="fas fa-cog modal-header-icon"></i>
        </div>
        <span class="modal-subtitle">
          Разрешенные категории действий выполняются без запроса подтверждения. Включайте только проверенные операции.
        </span>
      </div>

      <div class="categories-grid">
        <div 
          v-for="cat in availableCategories"
          :key="cat.key"
          class="category-pill" 
          :class="{ 'is-selected': state.categories[cat.key] && state.enabled }"
          :title="cat.description"
          @click="toggleCategory(cat.key)"
        >
          <i :class="cat.icon"></i>
          <span>{{ cat.label }}</span>
        </div>
      </div>

      <div class="modal-footer-row">
        <div class="quick-buttons">
          <button class="quick-btn" @click="setAll">
            <i class="fas fa-check-double"></i> Все
          </button>
          <button class="quick-btn" @click="setNone">
            <i class="fas fa-times"></i> Сброс
          </button>
        </div>

        <div class="master-toggle" @click="toggleMaster">
          <div class="switch-pill" :class="{ 'is-on': state.enabled }">
            <div class="switch-handle"></div>
          </div>
          <span>{{ state.enabled ? 'Включено' : 'Выключено' }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AiAutoApproveModalProps, AiAutoApproveModalEmits } from './AiAutoApproveModal.model';
import { useAiAutoApproveModal } from './useAiAutoApproveModal';

const props = defineProps<AiAutoApproveModalProps>();
const emit = defineEmits<AiAutoApproveModalEmits>();

const {
  isOpen,
  containerRef,
  state,
  availableCategories,
  activeCount,
  badgeText,
  toggleCategory,
  setAll,
  setNone,
  toggleMaster,
  toggleModal
} = useAiAutoApproveModal(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/ai/AiAutoApproveModal.css"></style>

