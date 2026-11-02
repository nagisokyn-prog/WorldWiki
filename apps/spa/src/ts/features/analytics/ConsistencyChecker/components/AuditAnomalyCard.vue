<template>
  <div
    class="audit-anomaly-card p-4 rounded-xl border border-subtle bg-surface hover:border-accent transition-all flex flex-col gap-3"
    :class="'severity-' + anomaly.severity"
  >
    <!-- Header: Rule Icon, Title, Severity Badge -->
    <div class="flex items-start justify-between gap-3">
      <div class="flex items-start gap-2.5">
        <span class="rule-icon text-lg leading-none mt-0.5" :title="ruleTooltip">
          {{ ruleEmoji }}
        </span>
        <div>
          <h4 class="text-sm font-bold m-0 text-main flex items-center gap-2">
            {{ anomaly.title }}
          </h4>
          <span class="text-2xs font-mono text-muted uppercase tracking-wider">
            {{ anomaly.rule }}
          </span>
        </div>
      </div>

      <span
        class="badge-severity text-2xs px-2.5 py-0.5 rounded-full font-mono uppercase font-bold"
        :class="'badge-' + anomaly.severity"
      >
        {{ anomaly.severity }}
      </span>
    </div>

    <!-- Description -->
    <p class="text-xs text-main m-0 leading-relaxed opacity-95 pl-7">
      {{ anomaly.description }}
    </p>

    <!-- Meta Tags: Entities & Chapters -->
    <div class="flex flex-wrap items-center gap-1.5 pl-7 text-2xs">
      <span
        v-for="eid in uniqueEntityIds"
        :key="eid"
        class="meta-tag tag-entity px-2 py-0.5 rounded-md border border-subtle bg-surface-hover text-main font-medium flex items-center gap-1 cursor-pointer hover:border-accent"
        @click="$emit('openEntity', eid)"
      >
        <span>👤</span>
        <span>{{ getEntityLabel(eid) }}</span>
      </span>

      <span
        v-for="cid in uniqueChapterIds"
        :key="cid"
        class="meta-tag tag-chapter px-2 py-0.5 rounded-md border border-subtle bg-surface-hover text-muted font-medium flex items-center gap-1 cursor-pointer hover:border-accent"
        @click="$emit('jumpToChapter', cid)"
      >
        <span>📖</span>
        <span>{{ getChapterLabel(cid) }}</span>
      </span>
    </div>

    <!-- Action Buttons Toolbar -->
    <div class="card-actions flex items-center justify-end gap-2 pt-2 border-t border-subtle pl-7">
      <button
        v-if="anomaly.chapter_ids && anomaly.chapter_ids.length > 0"
        class="btn-action btn-jump text-xs px-3 py-1 rounded-md font-semibold text-accent hover:bg-surface-hover border border-subtle cursor-pointer flex items-center gap-1.5 transition-colors"
        @click="$emit('jumpToChapter', anomaly.chapter_ids[0])"
      >
        <span>📍</span>
        <span>Перейти к главе</span>
      </button>

      <button
        v-if="anomaly.entity_ids && anomaly.entity_ids.length > 0"
        class="btn-action btn-entity text-xs px-3 py-1 rounded-md font-semibold text-main hover:bg-surface-hover border border-subtle cursor-pointer flex items-center gap-1.5 transition-colors"
        @click="$emit('openEntity', anomaly.entity_ids[0])"
      >
        <span>👤</span>
        <span>Досье</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AuditAnomalyCardProps, AuditAnomalyCardEmits } from './AuditAnomalyCard.model';
import { useAuditAnomalyCard } from './useAuditAnomalyCard';

const props = defineProps<AuditAnomalyCardProps>();

defineEmits<AuditAnomalyCardEmits>();

const {
  ruleEmoji,
  ruleTooltip,
  cleanId,
  uniqueEntityIds,
  uniqueChapterIds,
  getEntityLabel,
  getChapterLabel,
} = useAuditAnomalyCard(() => props.anomaly);
</script>
