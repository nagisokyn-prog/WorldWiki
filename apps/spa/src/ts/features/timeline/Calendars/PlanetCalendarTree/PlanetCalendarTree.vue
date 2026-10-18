<template>
  <div class="planet-calendar-tree-card">
    <div class="tree-header flex justify-between items-center mb-3">
      <h4 class="m-0 text-sm font-semibold flex items-center gap-2">
        <span>📁 Календари</span>
      </h4>
      <button
        type="button"
        class="btn-add-planet interactive-el"
        title="Создать новую планету"
        @click.prevent="addPlanet"
      >
        ➕ Планета
      </button>
    </div>

    <div class="tree-nodes-list">
      <div v-for="group in treeGroups" :key="group.planet.id" class="planet-tree-node mb-2">
        <!-- Узел планеты -->
        <div
          class="planet-node-row flex justify-between items-center cursor-pointer"
          :class="{ 'is-selected': selectedId === `planet:${group.planet.id}` }"
          @click="selectPlanet(group.planet)"
        >
          <div class="flex items-center gap-2">
            <span
              class="expand-icon text-xs opacity-70"
              @click.stop="togglePlanet(group.planet.id)"
            >
              {{ group.isExpanded ? '▼' : '▶' }}
            </span>
            <span class="planet-icon">🪐</span>
            <span class="planet-name font-medium">{{ group.planet.name }}</span>
            <span class="planet-orbit-badge text-xs opacity-60">
              ({{ group.planet.orbit_days }} дн)
            </span>
          </div>

          <div class="flex items-center gap-1">
            <button
              type="button"
              class="btn-icon-tiny interactive-el"
              title="Добавить календарь на этой планете"
              @click.stop="addCalendar(group.planet.id)"
            >
              ➕
            </button>
            <button
              type="button"
              class="btn-icon-tiny interactive-el"
              title="Настройки планеты"
              @click.stop="selectPlanet(group.planet)"
            >
              ⚙️
            </button>
          </div>
        </div>

        <!-- Дочерние календари культуры -->
        <div v-if="group.isExpanded" class="calendar-children-list pl-4 mt-1">
          <div
            v-if="group.calendars.length === 0"
            class="text-xs text-muted py-1 pl-2"
          >
            Нет календарей на этой планете.
          </div>

          <div
            v-for="cal in group.calendars"
            :key="cal.idx"
            class="calendar-node-row flex justify-between items-center cursor-pointer py-1 pl-2 rounded"
            :class="{ 'is-selected': selectedId === `cal:${cal.idx}` }"
            @click="selectCalendar(cal.idx)"
          >
            <div class="flex items-center gap-2">
              <span class="cal-icon text-xs">📄</span>
              <span class="cal-name text-sm">{{ cal.name }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { usePlanetCalendarTree } from './usePlanetCalendarTree';
import type {
  PlanetCalendarTreeProps,
  PlanetCalendarTreeEmits,
} from './PlanetCalendarTree.model';

const props = defineProps<PlanetCalendarTreeProps>();
const emit = defineEmits<PlanetCalendarTreeEmits>();

const {
  treeGroups,
  togglePlanet,
  selectPlanet,
  selectCalendar,
  addCalendar,
  addPlanet,
} = usePlanetCalendarTree(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/timeline/PlanetCalendarTree.css"></style>
