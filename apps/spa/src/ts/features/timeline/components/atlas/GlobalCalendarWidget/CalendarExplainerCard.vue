<template>
  <div class="gc-explainer-card mt-2">
    <div class="gc-explainer-header">
      <span class="gc-explainer-title">🔮 Сводка для рукописи</span>
      <button class="gc-explainer-close-btn" @click="$emit('close')">×</button>
    </div>

    <div class="gc-explainer-body">
      <div class="gc-explainer-item">
        <span class="gc-explainer-dim">🌍 Мир: </span>
        <span class="gc-explainer-val">{{ dateExplanation.masterDateFormatted }}</span>
      </div>

      <div v-for="(cd, idx) in dateExplanation.crossDates" :key="idx" class="gc-explainer-item">
        <span class="gc-explainer-dim">🏛️ {{ cd.calendarName }}: </span>
        <span class="gc-explainer-val">{{ cd.formatted }}</span>
      </div>

      <div v-if="dateExplanation.moons.length > 0" class="gc-explainer-item">
        <span class="gc-explainer-dim">🌙 Небо: </span>
        <span class="gc-explainer-val">
          <span v-for="(m, mIdx) in dateExplanation.moons" :key="mIdx" class="mr-2">
            {{ m.emoji }} {{ m.moon.name }}: {{ m.name }}
          </span>
        </span>
      </div>

      <div v-if="dateExplanation.daylightText" class="gc-explainer-item">
        <span class="gc-explainer-dim">☀️ День: </span>
        <span class="gc-explainer-val">
          {{ dateExplanation.daylightText }}
          <small class="gc-explainer-dim">({{ dateExplanation.sunriseText }}, {{ dateExplanation.sunsetText }})</small>
        </span>
      </div>

      <div v-if="dateExplanation.holidays.length > 0" class="gc-explainer-item">
        <span class="gc-explainer-dim">🎉 Праздники: </span>
        <span class="gc-explainer-accent">{{ dateExplanation.holidays.join(', ') }}</span>
      </div>

      <div class="gc-snippet-container">
        <div class="gc-snippet-quote">
          "{{ dateExplanation.snippet }}"
        </div>
        <button
          type="button"
          class="glass-btn gc-snippet-btn interactive-el"
          @click="$emit('copy-snippet')"
        >
          <span>{{ isCopied ? '✓ Скопировано' : '📋 Скопировать фразу' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CalendarExplainerCardProps, CalendarExplainerCardEmits } from './GlobalCalendarWidget.model';

defineProps<CalendarExplainerCardProps>();
defineEmits<CalendarExplainerCardEmits>();
</script>
