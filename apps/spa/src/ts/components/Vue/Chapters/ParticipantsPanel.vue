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
import { ref, onMounted, watch } from 'vue';
import { apiService } from '../../../services/api.service';

const props = defineProps({
  project: { type: String, required: true },
  participants: { type: Array, required: true }
});

const emit = defineEmits(['update:participants', 'change']);

const newType = ref('character');
const newId = ref('');
const entities = ref<any[]>([]);
const entityCache = ref<Record<string, any[]>>({});

const loadEntitiesForType = async () => {
  newId.value = '';
  if (!entityCache.value[newType.value]) {
    try {
      const list = await apiService.getEntityList(props.project, newType.value);
      entityCache.value[newType.value] = list;
    } catch (e) {
      console.warn(`Failed to load ${newType.value}`, e);
      entityCache.value[newType.value] = [];
    }
  }
  entities.value = entityCache.value[newType.value] || [];
};

onMounted(() => {
  loadEntitiesForType();
});

const getIcon = (type: string) => {
  if (type === 'character') return '👤';
  if (type === 'organization') return '🛡️';
  if (type === 'location') return '🌍';
  return '📌';
};

const resolveEntityName = (id: string, type: string) => {
  const list = entityCache.value[type] || [];
  const ent = list.find((e: any) => String(e.id) === String(id));
  
  if (!ent) return `ID: ${String(id).substring(0,8)}`;

  const nameKeywords = ['name', 'title', 'fio', 'display', 'short', 'full', 'имя', 'название', 'фио'];

  const searchByNameKey = (obj: any): string | null => {
    if (!obj || typeof obj !== 'object') return null;
    for (const key of Object.keys(obj)) {
      if (nameKeywords.some(keyword => key.toLowerCase().includes(keyword))) {
        if (typeof obj[key] === 'string' && obj[key].trim()) return obj[key].trim();
      }
    }
    for (const key of Object.keys(obj)) {
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        const nested = searchByNameKey(obj[key]);
        if (nested) return nested;
      }
    }
    return null;
  };

  const name = searchByNameKey(ent);
  return name || 'Без названия';
};

const addParticipant = () => {
  if (!newId.value || !newType.value) return;
  const existing = props.participants.find((p: any) => p.id === newId.value && p.type === newType.value);
  if (!existing) {
    const newParts = [...props.participants];
    newParts.push({
      id: newId.value,
      type: newType.value,
      name: resolveEntityName(newId.value, newType.value),
      autoParsed: false
    });
    emit('update:participants', newParts);
    emit('change');
  }
  newId.value = '';
};

const removeParticipant = (idx: number) => {
  const newParts = [...props.participants];
  newParts.splice(idx, 1);
  emit('update:participants', newParts);
  emit('change');
};
</script>

<style scoped>
.tool-section { margin-bottom: 24px; }
.tool-section h4 { margin: 0 0 12px 0; font-size: 13px; text-transform: uppercase; color: var(--text-muted); display: flex; align-items: center; gap: 8px; }
</style>

