<template>
  <div class="tool-section participants-section">
    <h4><i class="fas fa-users"></i> Участники</h4>
    
    <div class="participants-list" style="display: flex; flex-direction: column; gap: 8px;">
      <div v-if="normalizedParticipants.length === 0" style="color: var(--text-muted); font-size: 12px; padding: 10px;">
        Упомяните сущность в тексте через Ctrl+Q чтобы она появилась здесь.
      </div>
      
      <div v-for="(p, idx) in normalizedParticipants" :key="idx" class="participant-item" style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-input); padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color);">
        <div style="display: flex; align-items: center; gap: 8px;">
          <i v-if="isFaIcon(getIcon(p.type))" :class="formatFaIcon(getIcon(p.type))"></i>
          <span v-else>{{ getIcon(p.type) }}</span>
          <span style="font-size: 13px; font-weight: 500;">{{ resolveEntityName(p.id, p.type, p.name) }}</span>
        </div>
        <button v-if="!p.autoParsed" style="background: transparent; border: none; color: #ef4444; cursor: pointer; opacity: 0.7;" @click="removeParticipant(idx)">✕</button>
        <span v-else style="font-size: 10px; color: var(--accent); opacity: 0.7;" title="Автоматически найдено в тексте">Авто</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useParticipantsPanel } from './useParticipantsPanel';
import type { ParticipantItem } from './useParticipantsPanel';

const props = withDefaults(defineProps<{
  project: string;
  participants?: ParticipantItem[] | string[] | null;
}>(), {
  participants: () => []
});

const emit = defineEmits<{
  (e: 'update:participants', val: ParticipantItem[]): void;
  (e: 'change'): void;
}>();

const {
  getIcon,
  resolveEntityName,
  normalizedParticipants,
  removeParticipant
} = useParticipantsPanel(props, emit as (event: 'update:participants' | 'change', ...args: unknown[]) => void);

const isFaIcon = (val?: string): boolean => {
  if (!val) return false;
  return val.startsWith('fa-') || val.startsWith('fas ') || val.startsWith('far ') || val.startsWith('fab ') || val.includes(' fa-');
};

const formatFaIcon = (val?: string): string => {
  if (!val) return '';
  if (val.startsWith('fa-')) return `fas ${val}`;
  return val;
};
</script>

<style scoped src="@worldwiki/resources/styles/features/chapters/ParticipantsPanel.css"></style>