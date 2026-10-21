<template>
  <div id="planet-tab-astrophysics" class="tab-pane active">
    <div class="section-card">
      <div class="section-header">
        <div class="section-title">🪐 Фундаментальные физические параметры планеты</div>
        <span class="status-chip success">
          {{ planet.rotation_direction === 'direct' ? 'Прямое вращение' : 'Ретроградное вращение' }}
        </span>
      </div>

      <div class="grid-4">
        <div class="form-group">
          <label class="form-label">Длительность суток (часы / мин / сек)</label>
          <div class="flex gap-1 items-center">
            <input
              :value="planet.day_hours"
              type="number"
              class="form-input w-16"
              min="0"
              :disabled="isReadOnly"
              @input="$emit('update:day-hours', Number(($event.target as HTMLInputElement).value))"
            /> ч
            <input
              :value="planet.day_minutes"
              type="number"
              class="form-input w-14"
              min="0"
              max="59"
              :disabled="isReadOnly"
              @input="$emit('update:day-minutes', Number(($event.target as HTMLInputElement).value))"
            /> м
            <input
              :value="planet.day_seconds"
              type="number"
              class="form-input w-14"
              min="0"
              max="59"
              :disabled="isReadOnly"
              @input="$emit('update:day-seconds', Number(($event.target as HTMLInputElement).value))"
            /> с
          </div>
          <span class="text-xs text-muted mt-1 block">Квант суток: {{ planet.ticks_per_day }} тиков</span>
        </div>

        <div class="form-group">
          <label class="form-label">Тропический год (орбита в сутках)</label>
          <input
            :value="planet.orbit_days"
            type="number"
            step="0.0001"
            class="form-input"
            :disabled="isReadOnly"
            @input="$emit('update:orbit-days', parseFloat(($event.target as HTMLInputElement).value) || 365.2422)"
          />
          <span class="text-xs text-muted mt-1 block">Орбита: {{ planet.orbit_days }} суток</span>
        </div>

        <div class="form-group">
          <label class="form-label">Наклон оси вращения (°)</label>
          <input
            :value="decimalAxialTilt"
            type="number"
            step="0.01"
            class="form-input"
            :disabled="isReadOnly"
            @input="$emit('update:axial-tilt', Number(($event.target as HTMLInputElement).value))"
          />
          <span class="text-xs text-muted mt-1 block">{{ planet.axial_tilt_mdeg }} миллиградусов</span>
        </div>

        <div class="form-group">
          <label class="form-label">Направление вращения</label>
          <select
            :value="planet.rotation_direction"
            class="form-select"
            :disabled="isReadOnly"
            @change="$emit('update:rotation-direction', ($event.target as HTMLSelectElement).value as 'direct' | 'retrograde')"
          >
            <option value="direct">Прямое (Восход на востоке)</option>
            <option value="retrograde">Ретроградное (Восход на западе)</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Астрономические точки года -->
    <div class="section-card">
      <div class="section-header">
        <div>
          <div class="section-title">❄️☀️ Астрономические точки года и солнцестояния</div>
          <div class="section-desc">
            Рассчитываются автоматически по орбите планеты. Наклон оси: {{ decimalAxialTilt }}°
          </div>
        </div>
        <button
          type="button"
          class="btn-ghost-sm interactive-el"
          @click="$emit('recalculate-astro-points')"
        >
          🧮 Рассчитать из календаря
        </button>
      </div>

      <div class="astro-cards-grid">
        <div class="astro-card">
          <span class="astro-label">❄️ Зимнее солнцестояние</span>
          <span class="astro-val">{{ planet.solstices.winter }} сут.</span>
        </div>
        <div class="astro-card">
          <span class="astro-label">🌸 Весеннее равноденствие</span>
          <span class="astro-val">{{ planet.solstices.spring }} сут.</span>
        </div>
        <div class="astro-card">
          <span class="astro-label">☀️ Летнее солнцестояние</span>
          <span class="astro-val">{{ planet.solstices.summer }} сут.</span>
        </div>
        <div class="astro-card">
          <span class="astro-label">🍂 Осеннее равноденствие</span>
          <span class="astro-val">{{ planet.solstices.autumn }} сут.</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PlanetDto } from '../PlanetEditor.model';

defineProps<{
  planet: PlanetDto;
  decimalAxialTilt: number;
  isReadOnly?: boolean;
}>();

defineEmits<{
  (e: 'update:day-hours', val: number): void;
  (e: 'update:day-minutes', val: number): void;
  (e: 'update:day-seconds', val: number): void;
  (e: 'update:orbit-days', val: number): void;
  (e: 'update:axial-tilt', val: number): void;
  (e: 'update:rotation-direction', val: 'direct' | 'retrograde'): void;
  (e: 'recalculate-astro-points'): void;
}>();
</script>
