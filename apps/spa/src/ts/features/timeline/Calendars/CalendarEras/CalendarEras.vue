<template>
  <div class="calendar-section calendar-eras-card">
    <div class="eras-section-header" @click="isCollapsed = !isCollapsed">
      <h4>🏛️ Эпохи</h4>
      <span class="eras-collapse-icon">{{ isCollapsed ? '▶' : '▼' }}</span>
    </div>
    
    <div v-if="!isCollapsed" class="eras-content">
      <div class="item-list">
        <div v-for="(era, eIdx) in modelValue.эпохи" :key="eIdx" class="era-card">
          <div class="item-row">
            <input
              v-model="era.название"
              type="text"
              class="item-name interactive-el"
              placeholder="Название эпохи"
              @input="onNameInput(era, $event)"
            />
            <input
              v-model.number="era.год_начала"
              type="number"
              class="item-duration interactive-el"
              placeholder="Начало"
            />
            <input
              v-model.number="era.год_конца"
              type="number"
              class="item-duration interactive-el"
              placeholder="Конец"
            />
            <div class="item-actions">
              <button
                class="btn-icon interactive-el"
                :disabled="Number(eIdx) === 0"
                @click.prevent="moveItem(Number(eIdx), -1)"
              >
                ↑
              </button>
              <button
                class="btn-icon interactive-el"
                :disabled="Number(eIdx) === (modelValue.эпохи?.length || 0) - 1"
                @click.prevent="moveItem(Number(eIdx), 1)"
              >
                ↓
              </button>
              <button
                class="btn-icon interactive-el"
                @click.prevent="removeEra(Number(eIdx))"
              >
                🗑️
              </button>
            </div>
          </div>
          <div class="era-reverse-row flex gap-4 items-center flex-wrap">
            <label class="era-checkbox-label">
              <input v-model="era.обратный_отсчет" type="checkbox" />
              Считать назад (До нашей эры)
            </label>
            <label class="era-checkbox-label">
              <input
                type="checkbox"
                :checked="era.counting_mode === 'by_anniversary'"
                @change="(era as any).counting_mode = (($event.target as HTMLInputElement).checked ? 'by_anniversary' : 'by_calendar_year')"
              />
              👑 Эра коронации (годовщина)
            </label>
          </div>
        </div>
      </div>
      <button class="btn-add interactive-el" @click.prevent="addEra">➕ Добавить эпоху</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useCalendarEras } from './useCalendarEras';
import type { CalendarErasProps } from './useCalendarEras';

const props = defineProps<CalendarErasProps>();

const { isCollapsed, moveItem, addEra, removeEra, onNameInput } = useCalendarEras(props);
</script>

<style scoped src="@worldwiki/resources/styles/features/timeline/CalendarEras.css"></style>
