<template>
  <div class="calendar-section calendar-anchor-events-card">
    <div class="anchor-events-header" @click="isCollapsed = !isCollapsed">
      <h4 class="m-0">🌟 Опорные исторические события (Вехи мира)</h4>
      <span class="text-xs text-muted opacity-70">{{ isCollapsed ? '▶' : '▼' }}</span>
    </div>

    <div v-if="!isCollapsed" class="anchor-events-content">
      <p class="text-xs text-muted mb-2">
        Ключевые события истории (например, «Рождество Христово = 0 год», «Падение Империи = 1000 год»), к которым могут привязываться другие календари.
      </p>

      <div class="item-list">
        <div
          v-for="(evt, idx) in anchorEvents"
          :key="evt.id || idx"
          class="anchor-event-row"
        >
          <input
            v-model="evt.name"
            type="text"
            class="anchor-event-name-input interactive-el"
            placeholder="Название события"
          />
          <div class="flex items-center gap-1">
            <span class="text-xs text-muted">Год:</span>
            <input
              v-model.number="evt.year"
              type="number"
              class="anchor-event-year-input interactive-el"
              placeholder="0"
            />
          </div>
          <div class="flex items-center gap-1">
            <span class="text-xs text-muted">День:</span>
            <input
              v-model.number="evt.day"
              type="number"
              min="1"
              max="31"
              class="anchor-event-year-input interactive-el"
              placeholder="1"
            />
          </div>
          <div class="item-actions">
            <button
              type="button"
              class="btn-icon interactive-el"
              :disabled="idx === 0"
              @click.prevent="moveItem(idx, -1)"
            >
              ↑
            </button>
            <button
              type="button"
              class="btn-icon interactive-el"
              :disabled="idx === anchorEvents.length - 1"
              @click.prevent="moveItem(idx, 1)"
            >
              ↓
            </button>
            <button
              type="button"
              class="btn-icon interactive-el"
              title="Удалить опорное событие"
              @click.prevent="removeEvent(idx)"
            >
              🗑️
            </button>
          </div>
        </div>
      </div>

      <button type="button" class="btn-add interactive-el mt-2" @click.prevent="addEvent">
        ➕ Добавить опорное событие
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useCalendarAnchorEvents } from './useCalendarAnchorEvents';
import type { CalendarAnchorEventsProps, CalendarAnchorEventsEmits } from './CalendarAnchorEvents.model';

const props = defineProps<CalendarAnchorEventsProps>();
const emit = defineEmits<CalendarAnchorEventsEmits>();

const { isCollapsed, anchorEvents, addEvent, removeEvent, moveItem } = useCalendarAnchorEvents(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/timeline/CalendarAnchorEvents.css"></style>
