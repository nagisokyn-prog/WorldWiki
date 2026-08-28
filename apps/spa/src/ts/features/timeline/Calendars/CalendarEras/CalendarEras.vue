<template>
  <div class="calendar-section">
    <div class="section-header" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center; user-select: none;" @click="isCollapsed = !isCollapsed">
      <h4 style="margin: 0;">🏛️ Эпохи</h4>
      <span style="font-size: 10px; color: var(--text-muted); opacity: 0.7;">{{ isCollapsed ? '▶' : '▼' }}</span>
    </div>
    
    <div v-show="!isCollapsed" style="margin-top: 12px;">
      <div v-auto-animate class="item-list">
        <div v-for="(era, eIdx) in modelValue.эпохи" :key="eIdx" style="margin-bottom: 10px" class="item-row">
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
          <div style="display: flex; align-items: center; margin-top: 5px">
            <label
              style="
                font-size: 11px;
                color: var(--text-muted);
                display: flex;
                align-items: center;
                gap: 5px;
                cursor: pointer;
              "
            >
              <input v-model="era.обратный_отсчет" type="checkbox" />
              Считать назад (До нашей эры)
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
