<template>
  <div id="planet-tab-moons" class="tab-pane active">
    <div class="section-card">
      <div class="section-header">
        <div class="section-title">🌕 Естественные спутники планеты (Физические орбиты)</div>
        <button
          v-if="!isReadOnly"
          type="button"
          class="btn-ghost-sm interactive-el"
          @click="$emit('add-moon')"
        >
          + Добавить луну
        </button>
      </div>

      <table class="items-table">
        <thead>
          <tr>
            <th>Имя спутника</th>
            <th class="w-48">Орбитальный период (суток)</th>
            <th class="w-48">Стартовая фаза (0-1)</th>
            <th class="w-12"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(moon, idx) in planet.moons" :key="idx">
            <td><input v-model="moon.name" type="text" class="table-input" :disabled="isReadOnly" /></td>
            <td><input v-model.number="moon.orbital_period" type="number" step="0.01" class="table-input" :disabled="isReadOnly" /></td>
            <td><input v-model.number="moon.start_phase" type="number" step="0.05" min="0" max="1" class="table-input" :disabled="isReadOnly" /></td>
            <td>
              <button
                v-if="!isReadOnly"
                type="button"
                class="btn-icon-table"
                title="Удалить луну"
                @click="$emit('remove-moon', idx)"
              >
                🗑️
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PlanetMoonsTabProps, PlanetMoonsTabEmits } from './PlanetMoonsTab.model';
import type { PlanetDto } from '../PlanetEditor.model';

defineProps<PlanetMoonsTabProps>>();

defineEmits<PlanetMoonsTabEmits>>();
</script>
