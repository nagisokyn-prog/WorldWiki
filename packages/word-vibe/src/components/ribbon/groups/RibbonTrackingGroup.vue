<template>
  <div class="ribbon-group">
    <div class="ribbon-row">
      <button 
        type="button" 
        class="ribbon-btn ribbon-btn-large" 
        :class="{ 'is-active': isTrackingChanges }"
        title="Включить / выключить запись исправлений"
        @click="commands.toggleTrackChanges?.()"
      >
        <i class="fas fa-history"></i>
        <span>Исправления</span>
      </button>
      <div class="ribbon-col">
        <button 
          type="button" 
          class="ribbon-btn ribbon-btn-sm" 
          title="Принять изменение"
          @click="commands.acceptChange?.()"
        >
          <i class="fas fa-check text-green"></i>
          <span>Принять</span>
        </button>
        <button 
          type="button" 
          class="ribbon-btn ribbon-btn-sm" 
          title="Отклонить изменение"
          @click="commands.rejectChange?.()"
        >
          <i class="fas fa-times text-red"></i>
          <span>Отклонить</span>
        </button>
      </div>
      <div class="ribbon-col">
        <button 
          type="button" 
          class="ribbon-btn ribbon-btn-sm" 
          title="Предыдущее исправление"
          @click="commands.prevChange?.()"
        >
          <i class="fas fa-arrow-left"></i>
          <span>Назад</span>
        </button>
        <button 
          type="button" 
          class="ribbon-btn ribbon-btn-sm" 
          title="Следующее исправление"
          @click="commands.nextChange?.()"
        >
          <i class="fas fa-arrow-right"></i>
          <span>Далее</span>
        </button>
      </div>
    </div>
    <div class="ribbon-group-footer">
      <span class="ribbon-group-label">Отслеживание</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { RibbonTrackingGroupProps } from './RibbonTrackingGroup.model';

defineProps<RibbonTrackingGroupProps>();
</script>
