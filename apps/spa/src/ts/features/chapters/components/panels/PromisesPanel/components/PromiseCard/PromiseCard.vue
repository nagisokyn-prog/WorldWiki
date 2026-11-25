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
        <span v-if="!isCardCollapsed" class="kind-label font-semibold">{{ kindInfo.label }}</span>
        <template v-if="isCardCollapsed">
          <span v-if="timeNatureIcon" class="collapsed-pill" :title="item.time_nature || ''">{{ timeNatureIcon }}</span>
          <span v-if="collapsedBlockBadge" class="collapsed-pill font-mono">{{ collapsedBlockBadge }}</span>
          <span v-if="item.location_id" class="collapsed-preview text-xs text-muted truncate">
            📍 {{ item.location_id }}
          </span>
          <span v-if="participantCount > 0" class="collapsed-pill" title="Участники">👥 {{ participantCount }}</span>
          <span v-if="arcCount > 0" class="collapsed-pill" title="Арки">⚡ {{ arcCount }}</span>
          <span v-if="progressionCount > 0" class="collapsed-pill" title="Этапы развития">🌿 {{ progressionCount }}</span>
          <span v-if="hasResolution" class="collapsed-pill" title="Отстреляно">🎯</span>
          <span v-if="item.quote" class="collapsed-quote text-xs text-muted truncate italic">
            «{{ item.quote.slice(0, 32) }}{{ item.quote.length > 32 ? '...' : '' }}»
          </span>
        </template>
      </div>
      <button 
        class="btn-delete" 
        title="Удалить карточку" 
        @click.stop="handleRemove"
      >
        ✕
      </button>
    </div>

    <!-- Разворачиваемое тело карточки (lazy mount) -->
    <div v-if="!isCardCollapsed" class="card-body flex flex-col gap-2">
      <!-- Интерактивная мета-информация сцены: участники, гибридная локация, событие таймлайна, тип -->
      <PromiseCardMeta
        :project="project"
        :item="item"
        :chapter-id="item.chapter_id || ''"
        :previous-scene="previousScene"
        :shared-entities="sharedEntities"
        @update:item="$emit('update:item', $event)"
        @change="$emit('change')"
      />

      <!-- ХРОНОЛОГИЯ ЖИЗНИ ОБЕЩАНИЯ (МИНИ-ТАЙМЛАЙН) -->
      <PromiseCardTimeline
        :project="project"
        :item="item"
        :get-chapter-title="getChapterTitle"
        :is-current-chapter-promise="isCurrentChapterPromise"
        :previous-scene="previousScene"
        :shared-entities="sharedEntities"
        @remove="handleRemove"
        @locate="handleLocate"
        @locate-step="$emit('locate', $event)"
        @remove-milestone="$emit('removeMilestone', $event)"
        @update:item="$emit('update:item', $event)"
        @change="$emit('change')"
      />

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
            :shared-entities="sharedEntities"
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
import PromiseCardTimeline from './components/PromiseCardTimeline.vue';
import { usePromiseCard } from './usePromiseCard';
import type { PromiseCardProps, PromiseCardEmits } from './PromiseCard.model';

const props = withDefaults(defineProps<PromiseCardProps>(), {
  expanded: undefined
});
const emit = defineEmits<PromiseCardEmits>();

const {
  isCardCollapsed,
  collapsedBlockBadge,
  timeNatureIcon,
  participantCount,
  arcCount,
  progressionCount,
  hasResolution,
  toggleCollapsed,
  handleLocate,
  handleRemove
} = usePromiseCard(props, emit);
</script>

