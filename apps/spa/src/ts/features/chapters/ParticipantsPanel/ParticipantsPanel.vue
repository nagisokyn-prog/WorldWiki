<template>
  <div class="tool-section participants-section">
    <h4><i class="fas fa-users"></i> Участники</h4>
    
    <div class="participants-list" style="display: flex; flex-direction: column; gap: 8px;">
      <div v-if="participants.length === 0" style="color: var(--text-muted); font-size: 12px; padding: 10px;">
        Упомяните сущность в тексте (через @ или [Имя]), чтобы она появилась здесь.
      </div>
      
      <div v-for="(p, idx) in (participants as any[])" :key="idx" class="participant-item" style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-input); padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color);">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span>{{ getIcon(p.type) }}</span>
          <span style="font-size: 13px; font-weight: 500;">{{ p.name || resolveEntityName(p.id, p.type) }}</span>
        </div>
        <button v-if="!p.autoParsed" style="background: transparent; border: none; color: #ef4444; cursor: pointer; opacity: 0.7;" @click="removeParticipant(idx)">✕</button>
        <span v-else style="font-size: 10px; color: var(--accent); opacity: 0.7;" title="Автоматически найдено в тексте">Авто</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useParticipantsPanel } from './useParticipantsPanel';

const props = withDefaults(defineProps<{
  project: string;
  participants?: any[];
}>(), {
  participants: () => []
});

const emit = defineEmits<{
  (e: 'update:participants', val: any[]): void;
  (e: 'change'): void;
}>();

const {
  getIcon,
  resolveEntityName,
  removeParticipant
} = useParticipantsPanel(props, emit);
</script>

<style scoped src="./ParticipantsPanel.vue.css"></style>