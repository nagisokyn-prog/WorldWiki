<template>
  <div class="tab2-astronomy">
    <!-- Секция: Физика планеты -->
    <section class="section-card">
      <header class="section-header">
        <div>
          <div class="section-title">🪐 Физика планеты и орбиты</div>
          <div class="section-desc">Орбитальный период и осевой наклон для смены времен года.</div>
        </div>
      </header>
      <div class="grid-3">
        <div class="form-group">
          <label class="form-label">Орбитальный период (суток)</label>
          <input
            type="number"
            step="0.0001"
            class="form-input"
            :value="physics.орбитальный_период"
            :disabled="isReadOnly"
            @input="updatePhysics({ орбитальный_период: parseFloat(($event.target as HTMLInputElement).value) || 365.2422 })"
          />
        </div>
        <div class="form-group">
          <label class="form-label">Наклон оси (°)</label>
          <input
            type="number"
            step="0.01"
            class="form-input"
            :value="physics.наклон_оси"
            :disabled="isReadOnly"
            @input="updatePhysics({ наклон_оси: parseFloat(($event.target as HTMLInputElement).value) || 0 })"
          />
        </div>
      </div>
    </section>

    <!-- Секция: Сезоны -->
    <section class="section-card">
      <header class="section-header">
        <div>
          <div class="section-title">🌸 Сезоны года</div>
          <div class="section-desc">Времена года с цветовой дифференциацией.</div>
        </div>
        <button v-if="!isReadOnly" type="button" class="btn-ghost-sm" @click="addSeason">+ Сезон</button>
      </header>

      <table class="items-table">
        <thead>
          <tr>
            <th style="width: 40px;">#</th>
            <th>Название</th>
            <th style="width: 50px;"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(season, idx) in seasons" :key="idx">
            <td>{{ idx + 1 }}</td>
            <td>
              <input
                type="text"
                class="table-input"
                :value="season.название"
                :disabled="isReadOnly"
                @input="season.название = ($event.target as HTMLInputElement).value; updateSeasons([...seasons])"
              />
            </td>
            <td>
              <button
                v-if="!isReadOnly"
                type="button"
                class="btn-icon-table"
                title="Удалить сезон"
                @click="removeSeason(idx)"
              >
                🗑️
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { Tab2AstronomyProps, Tab2AstronomyEmits } from './Tab2Astronomy.model';
import { useTab2Astronomy } from './useTab2Astronomy';

const props = defineProps<Tab2AstronomyProps>();
const emit = defineEmits<Tab2AstronomyEmits>();

const {
  seasons,
  physics,
  updatePhysics,
  updateSeasons,
  addSeason,
  removeSeason,
} = useTab2Astronomy(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/timeline/Tab2Astronomy.css"></style>
