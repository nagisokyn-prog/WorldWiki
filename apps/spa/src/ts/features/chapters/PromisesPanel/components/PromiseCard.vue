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

    <!-- Секция контекста нарративного блока: участники, локация, событие таймлайна -->
    <div v-if="(item.participant_ids && item.participant_ids.length > 0) || item.location_id || item.timeline_event_id || item.block_id" class="promise-meta-tags flex flex-wrap gap-1 px-3 py-1.5 bg-surface-subtle border-b border-subtle text-2xs">
      <span v-if="item.block_id" class="badge-block font-mono text-muted" title="ID абзаца">
        🧱 {{ item.block_id }}
      </span>
      <span v-if="item.location_id" class="badge-loc text-accent font-semibold" title="Локация сцены">
        📍 {{ item.location_id.replace(/^entities:/, '') }}
      </span>
      <span v-if="item.timeline_event_id" class="badge-event text-warning font-semibold" title="Событие таймлайна">
        ⏱️ {{ item.timeline_event_id.replace(/^timeline_events:/, '') }}
      </span>
      <span v-for="pid in (item.participant_ids || [])" :key="pid" class="badge-participant text-muted" title="Участник сцены">
        👤 {{ pid.replace(/^entities:/, '') }}
      </span>
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
          <button class="btn-locate-step" @click="$emit('locate', { chapter_id: item.chapter_id, paragraph_index: item.paragraph_index, quote: item.quote, block_id: item.block_id })">
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
            <button class="btn-locate-step" @click="$emit('locate', { chapter_id: prog.chapter_id, paragraph_index: prog.paragraph_index, quote: prog.quote })">
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
            @click="item.resolution && $emit('removeMilestone', { item, milestoneId: item.resolution.id, stage: 'resolution' })"
          >
            ✕
          </button>
        </div>

        <blockquote class="card-quote quote-resolution">
          «{{ item.resolution.quote }}»
        </blockquote>

        <div class="step-actions">
          <button class="btn-locate-step" @click="item.resolution && $emit('locate', { chapter_id: item.resolution.chapter_id, paragraph_index: item.resolution.paragraph_index, quote: item.resolution.quote })">
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
    <PromiseCardNote
      :editing-note-id="editingNoteId"
      :item-id="item.id"
      :note="item.note"
      :note-draft="noteDraft"
      @update:note-draft="$emit('update:noteDraft', $event)"
      @start-edit="$emit('startEditNote', item)"
      @cancel-edit="$emit('cancelEditNote')"
      @save="$emit('saveNote', item)"
    />
  </div>
</template>

<script setup lang="ts">
import PromiseCardNote from './PromiseCardNote.vue';
import type { RichPlotPromise } from '../usePromisesPanel';

defineProps<{
  item: RichPlotPromise;
  kindInfo: { label: string; icon: string };
  editingNoteId: string | null;
  noteDraft: string;
  getChapterTitle: (chapterId: string) => string;
  isCurrentChapterPromise: (chapterId: string) => boolean;
}>();

defineEmits<{
  (e: 'remove', item: RichPlotPromise): void;
  (e: 'locate', payload: { chapter_id: string; paragraph_index: number; quote: string; block_id?: string | null }): void;
  (e: 'removeMilestone', payload: { item: RichPlotPromise; milestoneId: string; stage: 'progression' | 'resolution' }): void;
  (e: 'promptAttachMilestone', payload: { item: RichPlotPromise; stage: 'progression' | 'resolution' }): void;
  (e: 'startEditNote', item: RichPlotPromise): void;
  (e: 'cancelEditNote'): void;
  (e: 'saveNote', item: RichPlotPromise): void;
  (e: 'update:noteDraft', val: string): void;
}>();
</script>
