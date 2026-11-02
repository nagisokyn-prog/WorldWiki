<template>
  <div v-if="isOpen" class="modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
    <div class="modal-content bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
      <!-- Modal Header -->
      <div class="modal-header p-4 border-b border-border flex items-center justify-between bg-surface/50">
        <div class="flex items-center gap-2 min-w-0">
          <span class="text-xl shrink-0">{{ isPromise ? '🗡️' : '📦' }}</span>
          <div class="min-w-0">
            <h3 class="text-base font-bold text-main truncate" :title="modalTitle">
              {{ modalTitle }}
            </h3>
            <p class="text-xs text-muted truncate">
              {{ itemTypeLabel }} • {{ statusCategoryLabel }}
            </p>
          </div>
        </div>
        <button
          class="btn-close text-muted hover:text-main p-1.5 rounded-lg hover:bg-hover transition-all cursor-pointer shrink-0 ml-2"
          @click="$emit('close')"
        >
          ✕
        </button>
      </div>

      <!-- Modal Body: Timeline -->
      <div class="modal-body flex-1 overflow-y-auto p-5 space-y-4">
        <div v-if="isLoading" class="p-8 text-center text-sm text-muted">
          <span class="animate-spin inline-block mr-2">🔄</span> {{ isPromise ? 'Загрузка вех развития ружья...' : 'Загрузка хронологии артефакта...' }}
        </div>

        <div v-else-if="!hasNodes" class="p-8 text-center text-sm text-muted italic">
          {{ emptyText }}
        </div>

        <div v-else class="journey-tree relative pl-6 space-y-4 border-l-2 border-primary/30 ml-2">
          <div
            v-for="node in nodes"
            :key="node.id"
            class="journey-node relative group"
          >
            <!-- Bullet Icon -->
            <div
              class="absolute -left-[31px] top-1.5 w-6 h-6 rounded-full border flex items-center justify-center text-xs shadow-xs"
              :class="node.badgeClass"
            >
              {{ node.icon }}
            </div>

            <!-- Content Card -->
            <div class="node-card p-3.5 rounded-lg border border-border bg-surface hover:border-primary/40 transition-all space-y-2">
              <div class="flex items-center justify-between gap-2">
                <span class="text-xs font-bold text-main">{{ node.title }}</span>
                <span v-if="node.chapter_title" class="text-[11px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20 shrink-0">
                  {{ node.chapter_title }}
                </span>
              </div>

              <blockquote v-if="node.description && isPromise" class="text-xs text-main/90 leading-relaxed italic border-l-2 border-primary/40 pl-2.5 py-1 my-1 bg-surface-hover/30 rounded-r">
                «{{ node.description }}»
              </blockquote>
              <p v-else-if="node.description" class="text-xs text-muted leading-relaxed">
                {{ node.description }}
              </p>

              <div v-if="node.owner_name" class="text-xs text-muted/90 flex items-center gap-1 font-medium pt-0.5">
                <span>{{ isPromise ? '🎭' : '👤' }}</span>
                <span>{{ isPromise ? `В сцене: ${node.owner_name}` : `Владелец: ${node.owner_name}` }}</span>
              </div>

              <div v-if="node.chapter_id" class="pt-1 flex justify-end">
                <button
                  class="btn-jump text-[11px] text-primary hover:underline font-semibold cursor-pointer flex items-center gap-1"
                  @click="onLocateNode(node)"
                >
                  <span>📍</span>
                  <span>Перейти к тексту в рукописи →</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal Footer -->
      <div class="modal-footer p-3 border-t border-border flex justify-end bg-surface/50">
        <button
          class="px-4 py-1.5 rounded-lg text-xs font-bold bg-surface-hover hover:bg-hover text-main border border-border cursor-pointer transition-all"
          @click="$emit('close')"
        >
          Закрыть
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { GunJourneyModalProps, GunJourneyModalEmits } from '../ChekhovGunTracker.model';
import { useGunJourneyModal } from './useGunJourneyModal';

const props = defineProps<GunJourneyModalProps>();
const emit = defineEmits<GunJourneyModalEmits>();

const {
  isPromise,
  modalTitle,
  itemTypeLabel,
  statusCategoryLabel,
  emptyText,
  hasNodes,
  nodes,
  onLocateNode,
} = useGunJourneyModal(
  () => props.journey,
  () => props.activeItem,
  emit
);
</script>

<style scoped src="@worldwiki/resources/styles/features/analytics/ChekhovGunTracker.css"></style>
