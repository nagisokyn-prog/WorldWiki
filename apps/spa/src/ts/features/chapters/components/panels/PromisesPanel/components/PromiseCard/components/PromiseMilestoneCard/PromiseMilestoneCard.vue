<template>
  <div class="promise-card milestone-collapsible-card" :class="[`stage-${stage}`, { 'is-card-collapsed': isCollapsed }]">
    <div class="card-header cursor-pointer select-none" @click="toggleCollapsed">
      <div class="flex items-center gap-1.5 flex-1 min-w-0">
        <span class="collapse-card-icon text-[10px] text-muted">{{ isCollapsed ? '▶' : '▼' }}</span>
        <span class="kind-icon">{{ stageIcon }}</span>
        <span v-if="!isCollapsed" class="kind-label font-semibold">
          {{ stage === 'resolution' ? 'Отстреляно' : 'Развитие' }}
        </span>
        <template v-if="isCollapsed">
          <span v-if="timeNatureIcon" class="collapsed-pill">{{ timeNatureIcon }}</span>
          <span v-if="collapsedBlockBadge" class="collapsed-pill font-mono">{{ collapsedBlockBadge }}</span>
          <span v-if="milestone.location_id" class="collapsed-preview text-xs text-muted truncate">
            📍 {{ milestone.location_id }}
          </span>
          <span v-if="participantCount > 0" class="collapsed-pill" title="Участники">👥 {{ participantCount }}</span>
          <span v-if="arcCount > 0" class="collapsed-pill" title="Арки">⚡ {{ arcCount }}</span>
          <span v-if="milestone.quote" class="collapsed-quote text-xs text-muted truncate italic">
            «{{ milestone.quote.slice(0, 32) }}{{ milestone.quote.length > 32 ? '...' : '' }}»
          </span>
        </template>
      </div>
      <button
        class="btn-delete-step"
        :title="stage === 'resolution' ? 'Сбросить завершение' : 'Удалить это упоминание'"
        @click.stop="handleRemove"
      >
        ✕
      </button>
    </div>

    <div v-if="!isCollapsed" class="card-body flex flex-col gap-2">
      <PromiseCardMeta
        :project="project"
        :item="milestoneAsPromise"
        :chapter-id="milestone.chapter_id || ''"
        :previous-scene="previousScene"
        :shared-entities="sharedEntities"
        @update:item="handleMetaUpdate"
        @change="$emit('change')"
      />

      <div class="milestone-step-footer flex flex-col gap-1.5">
        <div class="step-badge">
          <span class="step-location font-medium">
            {{ getChapterTitle(milestone.chapter_id || '') }} · абз. {{ milestone.order_index ?? 1 }}
          </span>
          <span v-if="isCurrentChapterPromise(milestone.chapter_id || '')" class="badge-current-chapter">текущая</span>
        </div>

        <blockquote class="card-quote quote-small" :class="{ 'quote-resolution': stage === 'resolution' }">
          «{{ milestone.quote || '' }}»
        </blockquote>

        <div class="step-actions">
          <button class="btn-locate-step" @click="handleLocate">
            {{ stage === 'resolution' ? '📍 Перейти к финалу' : '📍 Перейти' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import PromiseCardMeta from '../../../PromiseCardMeta/PromiseCardMeta.vue';
import type { PromiseMilestoneCardEmits, PromiseMilestoneCardProps } from './PromiseMilestoneCard.model';
import { usePromiseMilestoneCard } from './usePromiseMilestoneCard';

const props = defineProps<PromiseMilestoneCardProps>();
const emit = defineEmits<PromiseMilestoneCardEmits>();

const {
  isCollapsed,
  toggleCollapsed,
  stageIcon,
  collapsedBlockBadge,
  participantCount,
  arcCount,
  timeNatureIcon,
  milestoneAsPromise,
  handleMetaUpdate,
  handleLocate,
  handleRemove,
} = usePromiseMilestoneCard(props, emit);
</script>
