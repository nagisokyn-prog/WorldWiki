<template>
  <div 
    class="promise-card"
    :class="[`status-${item.status}`, { 'is-card-collapsed': isCardCollapsed }]"
  >
    <!-- Верхняя плашка: Сворачивание/разворачивание, Иконка, тип, превью и кнопка удаления -->
    <div 
      class="card-header cursor-pointer select-none"
      @click="toggleCollapsed"
    >
      <div class="flex items-center gap-1.5 flex-1 min-w-0">
        <span class="collapse-card-icon text-[10px] text-muted">{{ isCardCollapsed ? '▶' : '▼' }}</span>
        <span class="kind-icon">{{ kindInfo.icon }}</span>
        <span class="kind-label font-semibold">{{ kindInfo.label }}</span>
        <span v-if="isCardCollapsed && item.location_id" class="collapsed-preview text-xs text-muted truncate">
          📍 {{ item.location_id }}
        </span>
        <span v-if="isCardCollapsed && item.quote" class="collapsed-quote text-xs text-muted truncate italic">
          «{{ item.quote.slice(0, 35) }}{{ item.quote.length > 35 ? '...' : '' }}»
        </span>
      </div>
      <button 
        class="btn-delete" 
        title="Удалить карточку" 
        @click.stop="handleRemove"
      >
        ✕
      </button>
    </div>

    <!-- Разворачиваемое тело карточки -->
    <div v-show="!isCardCollapsed" class="card-body flex flex-col gap-2">
      <!-- Интерактивная мета-информация сцены: участники, гибридная локация, событие таймлайна, тип -->
      <PromiseCardMeta
        :project="project"
        :item="item"
        :chapter-id="item.chapter_id || ''"
        @update:item="$emit('update:item', $event)"
        @change="$emit('change')"
      />

      <!-- ХРОНОЛОГИЯ ЖИЗНИ ОБЕЩАНИЯ (МИНИ-ТАЙМЛАЙН) -->
      <div class="promise-timeline">
        <!-- 1. 🌱 ТОЧКА ПОСАДКИ (PLANT) / 🎬 СЦЕНА -->
        <div class="timeline-step step-plant">
          <div class="step-badge">
            <span class="step-icon">{{ item.kind === 'scene' ? '🎬' : '🌱' }}</span>
            <span class="step-name">{{ item.kind === 'scene' ? 'Сцена:' : 'Посажено:' }}</span>
            <span class="step-location">{{ getChapterTitle(item.chapter_id || '') }} · абз. {{ item.paragraph_index ?? 1 }}</span>
            <span v-if="isCurrentChapterPromise(item.chapter_id || '')" class="badge-current-chapter">текущая</span>
          </div>

          <!-- ⚠️ Orphan-баннер: исходный текст удалён из рукописи -->
          <div v-if="item.is_orphaned" class="orphan-banner">
            <span class="orphan-icon">⚠️</span>
            <span class="orphan-text">Текст удалён из рукописи</span>
            <button class="orphan-delete-btn" title="Удалить карточку" @click.stop="handleRemove">Удалить</button>
          </div>

          <blockquote class="card-quote" :class="{ 'quote-orphaned': item.is_orphaned }">
            «{{ item.quote || item.title }}»
          </blockquote>

          <div class="step-actions">
            <button class="btn-locate-step" @click="handleLocate">
              {{ item.kind === 'scene' ? '📍 Перейти к сцене' : '📍 Перейти к фразе' }}
            </button>
          </div>
        </div>

        <!-- 2. 🌿 ТОЧКИ РАЗВИТИЯ (PROGRESSIONS) - ТОЛЬКО ДЛЯ РУЖЕЙ -->
        <div v-if="item.kind !== 'scene' && item.progressions && item.progressions.length > 0" class="timeline-group-progressions">
          <div class="group-header">
            <span class="step-icon">🌿</span>
            <span class="group-title">Развитие ({{ item.progressions.length }}):</span>
          </div>

          <div 
            v-for="(prog, pIdx) in item.progressions" 
            :key="prog.id || prog.milestone_id || prog.quote || pIdx"
            class="timeline-step step-progression"
          >
            <div class="step-badge">
              <span class="step-connector">├─</span>
              <span class="step-location font-medium">{{ getChapterTitle(prog.chapter_id || '') }} · абз. {{ prog.paragraph_index ?? 1 }}</span>
              <span v-if="isCurrentChapterPromise(prog.chapter_id || '')" class="badge-current-chapter">текущая</span>
              <button 
                class="btn-delete-step" 
                title="Удалить это упоминание"
                @click="$emit('removeMilestone', { item, milestoneId: prog.id || prog.milestone_id || '', stage: 'progression' })"
              >
                ✕
              </button>
            </div>

            <blockquote class="card-quote quote-small">
              «{{ prog.quote || '' }}»
            </blockquote>

            <div class="step-actions">
              <button class="btn-locate-step" @click="$emit('locate', { chapter_id: prog.chapter_id || '', paragraph_index: prog.paragraph_index ?? 1, quote: prog.quote || '' })">
                📍 Перейти
              </button>
            </div>
          </div>
        </div>

        <!-- 3. 🎯 ТОЧКА ВЫСТРЕЛА / РАЗВЯЗКИ (RESOLUTION) - ТОЛЬКО ДЛЯ РУЖЕЙ -->
        <div v-if="item.kind !== 'scene' && item.resolution" class="timeline-step step-resolution">
          <div class="step-badge">
            <span class="step-icon">🎯</span>
            <span class="step-name font-bold text-success">Отстреляно:</span>
            <span class="step-location font-semibold">{{ getChapterTitle(item.resolution.chapter_id || '') }} · абз. {{ item.resolution.paragraph_index ?? 1 }}</span>
            <span v-if="isCurrentChapterPromise(item.resolution.chapter_id || '')" class="badge-current-chapter">текущая</span>
            <button 
              class="btn-delete-step" 
              title="Сбросить завершение"
              @click="$emit('removeMilestone', { item, milestoneId: item.resolution?.id || item.resolution?.milestone_id || '', stage: 'resolution' })"
            >
              ✕
            </button>
          </div>

          <blockquote class="card-quote quote-resolution">
            «{{ item.resolution.quote || '' }}»
          </blockquote>

          <div class="step-actions">
            <button class="btn-locate-step" @click="$emit('locate', { chapter_id: item.resolution?.chapter_id || '', paragraph_index: item.resolution?.paragraph_index ?? 1, quote: item.resolution?.quote || '' })">
              📍 Перейти к финалу
            </button>
          </div>
        </div>
      </div>

      <!-- 4. ДРЕВОВИДНЫЕ СВЯЗАННЫЕ ПОД-СЦЕНЫ -->
      <div v-if="item.children && item.children.length > 0" class="subscenes-tree-container mt-2">
        <div class="tree-header text-xs text-muted font-medium mb-1.5 flex items-center gap-1">
          <span>🎬 Связанные сцены ({{ item.children.length }}):</span>
        </div>
        <div class="tree-branches pl-2.5 border-l-2 border-dashed border-border-subtle flex flex-col gap-2">
          <PromiseCard
            v-for="child in item.children"
            :key="child.id || child.quote"
            :project="project"
            :item="child"
            :kind-info="kindInfo"
            :editing-note-id="editingNoteId"
            :note-draft="noteDraft"
            :get-chapter-title="getChapterTitle"
            :is-current-chapter-promise="isCurrentChapterPromise"
            :level="(level || 0) + 1"
            @update:item="$emit('update:item', $event)"
            @update:note-draft="$emit('update:noteDraft', $event)"
            @remove="$emit('remove', $event)"
            @locate="$emit('locate', $event)"
            @remove-milestone="$emit('removeMilestone', $event)"
            @prompt-attach-milestone="$emit('promptAttachMilestone', $event)"
            @start-edit-note="$emit('startEditNote', $event)"
            @cancel-edit-note="$emit('cancelEditNote')"
            @save-note="$emit('saveNote', $event)"
            @change="$emit('change')"
          />
        </div>
      </div>

      <!-- Быстрые действия с карточкой (только для сюжетных обещаний / ружей) -->
      <div v-if="item.kind !== 'scene'" class="card-quick-actions">
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
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'PromiseCard' });
import PromiseCardMeta from '../PromiseCardMeta/PromiseCardMeta.vue';
import PromiseCardNote from '../PromiseCardNote/PromiseCardNote.vue';
import { usePromiseCard } from './usePromiseCard';
import type { PromiseCardProps, PromiseCardEmits } from './PromiseCard.model';

const props = defineProps<PromiseCardProps>();
const emit = defineEmits<PromiseCardEmits>();

const {
  isCardCollapsed,
  toggleCollapsed,
  handleLocate,
  handleRemove
} = usePromiseCard(props, emit);
</script>

