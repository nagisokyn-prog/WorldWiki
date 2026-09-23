<template>
  <div class="tool-section participants-section">
    <h4><i class="fas fa-users"></i> Участники</h4>
    
    <div class="participants-list">
      <div v-if="normalizedParticipants.length === 0" class="participants-empty">
        Упомяните сущность в тексте через Ctrl+Q чтобы она появилась здесь.
      </div>
      
      <div v-for="(p, idx) in normalizedParticipants" :key="idx" class="participant-item">
        <div class="participant-info">
          <i v-if="isFaIcon(getIcon(p.type))" :class="formatFaIcon(getIcon(p.type))"></i>
          <span v-else>{{ getIcon(p.type) }}</span>
          <span class="participant-name">{{ resolveEntityName(p.id, p.type, p.name) }}</span>
        </div>
        <button v-if="!p.autoParsed" class="participant-remove-btn" @click="removeParticipant(idx)">✕</button>
        <span v-else class="participant-auto-badge" title="Автоматически найдено в тексте">Авто</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useParticipantsPanel } from './useParticipantsPanel';
import type { ParticipantItem } from './useParticipantsPanel';

const props = withDefaults(defineProps<{
  project: string;
  participants?: (ParticipantItem | string)[] | null;
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