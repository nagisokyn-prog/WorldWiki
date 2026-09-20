<template>
  <div 
    class="promise-card"
    :class="`status-${item.status}`"
  >
    <!-- Верхняя плашка: Иконка, тип, локация и кнопка удаления -->
    <div class="card-header">
      <div class="flex items-center gap-1.5 flex-1 min-w-0">
        <span class="kind-icon">{{ kindInfo.icon }}</span>
        <span class="kind-label font-semibold">{{ kindInfo.label }}</span>
      </div>
      <button 
        class="btn-delete" 
        title="Удалить обещание" 
        @click="$emit('remove', item)"
      >
        ✕
      </button>
    </div>

    <!-- ХРОНОЛОГИЯ ЖИЗНИ ОБЕЩАНИЯ (МИНИ-ТАЙМЛАЙН) -->
    <div class="promise-timeline">
      <!-- 1. 🌱 ТОЧКА ПОСАДКИ (PLANT) -->
      <div class="timeline-step step-plant">
        <div class="step-badge">
          <span class="step-icon">🌱</span>
          <span class="step-name">Посажено:</span>
          <span class="step-location">{{ getChapterTitle(item.chapter_id) }} · абз. {{ item.paragraph_index }}</span>
          <span v-if="isCurrentChapterPromise(item.chapter_id)" class="badge-current-chapter">текущая</span>
        </div>
        
        <blockquote class="card-quote">
          «{{ item.quote }}»
        </blockquote>

        <div class="step-actions">
          <button class="btn-locate-step" @click="$emit('locate', item)">
            📍 Перейти к сцене
          </button>
        </div>
      </div>

      <!-- 2. 🌿 ТОЧКИ РАЗВИТИЯ (PROGRESSIONS) -->
      <div v-if="item.progressions && item.progressions.length > 0" class="timeline-group-progressions">
        <div class="group-header">
          <span class="step-icon">🌿</span>
          <span class="group-title">Развитие ({{ item.progressions.length }}):</span>
        </div>

        <div 
          v-for="prog in item.progressions" 
          :key="prog.id"
          class="timeline-step step-progression"
        >
          <div class="step-badge">
            <span class="step-connector">├─</span>
            <span class="step-location font-medium">{{ getChapterTitle(prog.chapter_id) }} · абз. {{ prog.paragraph_index }}</span>
            <span v-if="isCurrentChapterPromise(prog.chapter_id)" class="badge-current-chapter">текущая</span>
            <button 
              class="btn-delete-step" 
              title="Удалить это упоминание"
              @click="$emit('removeMilestone', { item, milestoneId: prog.id, stage: 'progression' })"
            >
              ✕
            </button>
          </div>

          <blockquote class="card-quote quote-small">
            «{{ prog.quote }}»
          </blockquote>

          <div class="step-actions">
            <button class="btn-locate-step" @click="$emit('locate', prog)">
              📍 Перейти
            </button>
          </div>
        </div>
      </div>

      <!-- 3. 🎯 ТОЧКА ВЫСТРЕЛА / РАЗВЯЗКИ (RESOLUTION) -->
      <div v-if="item.resolution" class="timeline-step step-resolution">
        <div class="step-badge">
          <span class="step-icon">🎯</span>
          <span class="step-name font-bold text-success">Отстреляно:</span>
          <span class="step-location font-semibold">{{ getChapterTitle(item.resolution.chapter_id) }} · абз. {{ item.resolution.paragraph_index }}</span>
          <span v-if="isCurrentChapterPromise(item.resolution.chapter_id)" class="badge-current-chapter">текущая</span>
          <button 
            class="btn-delete-step" 
            title="Сбросить выстрел"
            @click="$emit('removeMilestone', { item, milestoneId: item.resolution.id, stage: 'resolution' })"
          >
            ✕
          </button>
        </div>

        <blockquote class="card-quote quote-resolution">
          «{{ item.resolution.quote }}»
        </blockquote>

        <div class="step-actions">
          <button class="btn-locate-step" @click="$emit('locate', item.resolution)">
            📍 Перейти к финалу
          </button>
        </div>
      </div>
    </div>

    <!-- Быстрые действия с карточкой -->
    <div class="card-quick-actions">
      <button 
        class="btn-quick btn-quick-progress" 
        title="Развить обещание выделенной фразой"
        @click="$emit('promptAttachMilestone', { item, stage: 'progression' })"
      >
        🌿 + Развить
      </button>
      <button 
        v-if="!item.resolution"
        class="btn-quick btn-quick-resolve" 
        title="Отстрелять обещание в текущей главе"
        @click="$emit('promptAttachMilestone', { item, stage: 'resolution' })"
      >
        🎯 Отстрелять
      </button>
    </div>

    <!-- Заметка -->
    <div class="card-note-section">
      <div v-if="editingNoteId === item.id" class="note-edit-box">
        <textarea 
          :value="noteDraft" 
          placeholder="Заметка к обещанию..."
          class="note-textarea"
          rows="2"
          @input="$emit('update:noteDraft', ($event.target as HTMLTextAreaElement).value)"
          @keydown.enter.ctrl.prevent="$emit('saveNote', item)"
          @keydown.esc.prevent="$emit('cancelEditNote')"
        ></textarea>
        <div class="note-actions">
          <button class="btn-xs btn-primary" @click="$emit('saveNote', item)">Сохранить</button>
          <button class="btn-xs btn-ghost" @click="$emit('cancelEditNote')">Отмена</button>
        </div>
      </div>
      <div v-else-if="item.note" class="note-display" @click="$emit('startEditNote', item)">
        <span class="note-icon">📝</span>
        <span class="note-text">{{ item.note }}</span>
      </div>
      <button 
        v-else 
        class="btn-add-note" 
        @click="$emit('startEditNote', item)"
      >
        + Добавить заметку
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PlotPromise } from '@/types/generated/PlotPromise';

defineProps<{
  item: PlotPromise;
  kindInfo: { label: string; icon: string };
  editingNoteId: string | null;
  noteDraft: string;
  getChapterTitle: (chapterId: string) => string;
  isCurrentChapterPromise: (chapterId: string) => boolean;
}>();

defineEmits<{
  (e: 'remove', item: PlotPromise): void;
  (e: 'locate', payload: { chapter_id: string; paragraph_index: number; quote: string; block_id?: string | null }): void;
  (e: 'removeMilestone', payload: { item: PlotPromise; milestoneId: string; stage: 'progression' | 'resolution' }): void;
  (e: 'promptAttachMilestone', payload: { item: PlotPromise; stage: 'progression' | 'resolution' }): void;
  (e: 'startEditNote', item: PlotPromise): void;
  (e: 'cancelEditNote'): void;
  (e: 'saveNote', item: PlotPromise): void;
  (e: 'update:noteDraft', val: string): void;
}>();
</script>
