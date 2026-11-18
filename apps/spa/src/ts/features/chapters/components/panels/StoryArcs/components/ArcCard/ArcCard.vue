<template>
  <div class="arc-card">
    <!-- Card Header -->
    <div class="arc-card-header">
      <div class="arc-title-group">
        <span class="arc-card-title" :title="arc.title">{{ arc.title }}</span>
        <span class="arc-card-type">{{ getArcTypeLabel(arc.arc_type) }}</span>
      </div>

      <div class="arc-card-actions" @click.stop>
        <XboxWheel
          :model-value="effectiveStatus"
          :options="arcStatusOptions"
          compact
          @update:model-value="$emit('update-status', arc, $event as ArcStatus)"
        />

        <button
          class="btn-delete-arc"
          title="Удалить арку"
          @click.stop="$emit('delete', arc.id)"
        >
          🗑️
        </button>
      </div>
    </div>

    <!-- Description -->
    <p v-if="arc.description" class="arc-card-desc">
      {{ arc.description }}
    </p>

    <!-- Narrative Composition Phase Stepper -->
    <div class="arc-phase-stepper">
      <div
        class="phase-step-badge"
        :class="{ 'phase-step-active phase-setup-active': phaseCounts.setup > 0, 'phase-step-empty': phaseCounts.setup === 0 }"
        title="Завязка"
      >
        <span class="phase-step-label">🌱 {{ phaseCounts.setup }}</span>
      </div>
      <div
        class="phase-step-badge"
        :class="{ 'phase-step-active phase-escalation-active': phaseCounts.escalation > 0, 'phase-step-empty': phaseCounts.escalation === 0 }"
        title="Эскалация"
      >
        <span class="phase-step-label">⚡ {{ phaseCounts.escalation }}</span>
      </div>
      <div
        class="phase-step-badge"
        :class="{ 'phase-step-active phase-climax-active': phaseCounts.climax > 0, 'phase-step-empty': phaseCounts.climax === 0 }"
        title="Кульминация"
      >
        <span class="phase-step-label">🔥 {{ phaseCounts.climax }}</span>
      </div>
      <div
        class="phase-step-badge"
        :class="{ 'phase-step-active phase-resolution-active': phaseCounts.resolution > 0, 'phase-step-empty': phaseCounts.resolution === 0 }"
        title="Развязка"
      >
        <span class="phase-step-label">✅ {{ phaseCounts.resolution }}</span>
      </div>
    </div>

    <!-- Linked Narrative Blocks Chain -->
    <div v-if="linkedBlocks.length > 0" class="arc-blocks-list">
      <div class="arc-blocks-header">
        <span>Сцены в рукописи ({{ linkedBlocks.length }}):</span>
      </div>

      <div
        v-for="(block, bIdx) in displayBlocks"
        :key="block.id || block.quote || bIdx"
        class="arc-block-item"
        :title="block.quote ? `«${block.quote}»` : 'Перейти к фрагменту текста'"
        @click.stop="$emit('locate', { chapterId: block.chapter_id || '', paragraphIndex: block.paragraph_index || 1, quote: block.quote || block.title || '', blockId: block.block_id || undefined })"
      >
        <div class="arc-block-meta">
          <span class="phase-badge" :class="block.phaseClass">
            {{ block.phaseLabel }}
          </span>
          <span class="arc-block-location">
            {{ block.formattedChapter }} · абз.{{ block.paragraph_index }}
          </span>
        </div>
        <span class="arc-block-status">
          {{ block.statusLabel }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { XboxWheel } from '@worldwiki/components';
import type { ArcStatus } from '../../StoryArcs.model';
import type { ArcCardProps, ArcCardEmits } from './ArcCard.model';
import { useArcCard } from './useArcCard';

const arcStatusOptions = [
  { value: 'planned', label: '📋 Запланировано' },
  { value: 'in_progress', label: '⚡ В Процессе' },
  { value: 'completed', label: '✅ Завершено' },
  { value: 'abandoned', label: '🛑 Отменено' },
];

const props = defineProps<ArcCardProps>();
defineEmits<ArcCardEmits>();

const {
  phaseCounts,
  displayBlocks,
  getArcTypeLabel,
} = useArcCard(props);
</script>

<style scoped src="@worldwiki/resources/styles/features/chapters/ArcBoard.css"></style>

