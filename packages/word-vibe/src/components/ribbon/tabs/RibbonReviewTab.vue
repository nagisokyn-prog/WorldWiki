<template>
  <div class="ribbon-tab-content flex">
    <!-- Правописание и статистика -->
    <div class="ribbon-group">
      <div class="ribbon-row">
        <button 
          type="button" 
          class="ribbon-btn ribbon-btn-large" 
          title="Проверить правописание и грамматику"
          @click="commands.checkSpelling?.()"
        >
          <i class="fas fa-spell-check"></i>
          <span>Правописание</span>
        </button>
        <button 
          type="button" 
          class="ribbon-btn ribbon-btn-large" 
          title="Подобрать синонимы в тезаурусе"
          @click="commands.openThesaurus?.()"
        >
          <i class="fas fa-book"></i>
          <span>Тезаурус</span>
        </button>
        <button 
          type="button" 
          class="ribbon-btn ribbon-btn-large" 
          title="Статистика документа (слова, знаки, страницы)"
          @click="commands.showWordCount?.()"
        >
          <i class="fas fa-calculator"></i>
          <span>Статистика</span>
        </button>
      </div>
      <div class="ribbon-group-footer">
        <span class="ribbon-group-label">Правописание</span>
      </div>
    </div>

    <!-- Примечания / Комментарии -->
    <div class="ribbon-group">
      <div class="ribbon-row">
        <button 
          type="button" 
          class="ribbon-btn ribbon-btn-large" 
          title="Создать примечание к выделенному тексту"
          @click="commands.addComment?.()"
        >
          <i class="fas fa-comment-medical"></i>
          <span>Создать примечание</span>
        </button>
        <button 
          type="button" 
          class="ribbon-btn ribbon-btn-large" 
          title="Удалить выбранное примечание"
          @click="commands.deleteComment?.()"
        >
          <i class="fas fa-comment-slash"></i>
          <span>Удалить</span>
        </button>
        <div class="ribbon-col">
          <button 
            type="button" 
            class="ribbon-btn ribbon-btn-sm" 
            title="Предыдущее примечание"
            @click="commands.prevComment?.()"
          >
            <i class="fas fa-arrow-left"></i>
            <span>Назад</span>
          </button>
          <button 
            type="button" 
            class="ribbon-btn ribbon-btn-sm" 
            title="Следующее примечание"
            @click="commands.nextComment?.()"
          >
            <i class="fas fa-arrow-right"></i>
            <span>Далее</span>
          </button>
        </div>
      </div>
      <div class="ribbon-group-footer">
        <span class="ribbon-group-label">Примечания</span>
      </div>
    </div>

    <!-- Отслеживание изменений (Вынесено в группу) -->
    <RibbonTrackingGroup
      :is-tracking-changes="isTrackingChanges"
      :commands="commands"
    />
  </div>
</template>

<script setup lang="ts">
import type { RibbonCommands } from '../../../ribbon/commands';
import RibbonTrackingGroup from '../groups/RibbonTrackingGroup.vue';

defineProps<{
  isTrackingChanges: boolean;
  commands: Partial<RibbonCommands>;
}>();
</script>
