<template>
  <div class="tab-pane">
    <!-- Опорный мастер-календарь -->
    <div v-if="masterCalData" class="master-pinned-section">
      <div class="section-label">
        <i class="fas fa-anchor"></i> Опорное летоисчисление (Календарь Мира)
      </div>
      <div class="calendar-sync-card is-master pinned-card">
        <div class="cal-badge-row">
          <span class="badge-master">Мастер</span>
          <span class="cal-name">{{ masterCalData.название || 'Календарь Мира' }}</span>
          <span class="badge-pinned-tag">Опорная ось</span>
        </div>

        <div class="controls-row">
          <div v-if="masterCalData.эпохи && masterCalData.эпохи.length > 0" class="control-group">
            <label class="control-label">Эпоха</label>
            <select
              :value="getLocalDateForCal(masterCalData).era_index"
              class="interactive-el glass-select"
              @change="onEraChange(masterCalData, $event)"
            >
              <option
                v-for="(era, eIdx) in masterCalData.эпохи"
                :key="eIdx"
                :value="eIdx"
              >
                {{ era.название || `Эпоха ${eIdx + 1}` }}
              </option>
            </select>
          </div>

          <div class="control-group">
            <label class="control-label">Год</label>
            <input
              :value="getLocalDateForCal(masterCalData).year"
              type="number"
              class="interactive-el glass-input"
              @input="onYearChange(masterCalData, $event)"
            >
          </div>

          <div class="control-group flex-1">
            <label class="control-label">Месяц</label>
            <select
              :value="getLocalDateForCal(masterCalData).month"
              class="interactive-el glass-select"
              @change="onMonthChange(masterCalData, $event)"
            >
              <option
                v-for="(m, mIdx) in masterCalData.месяцы || []"
                :key="mIdx"
                :value="mIdx"
              >
                {{ m.название }}
              </option>
            </select>
          </div>

          <div class="control-group">
            <label class="control-label">День</label>
            <input
              :value="getLocalDateForCal(masterCalData).day"
              type="number"
              min="1"
              class="interactive-el glass-input day-input"
              @input="onDayChange(masterCalData, $event)"
            >
          </div>
        </div>

        <div class="card-meta">
          <div class="meta-row">
            <span class="meta-pill season-pill">
              🌱 {{ getDateMeta(masterCalData, getLocalDateForCal(masterCalData)).season }}
            </span>
            <span
              v-if="getDateMeta(masterCalData, getLocalDateForCal(masterCalData)).holiday"
              class="meta-pill holiday-pill"
            >
              🎉 {{ getDateMeta(masterCalData, getLocalDateForCal(masterCalData)).holiday }}
            </span>
          </div>

          <div
            v-if="getDateMeta(masterCalData, getLocalDateForCal(masterCalData)).moons.length > 0"
            class="moons-row"
          >
            <span
              v-for="(m, mIdx) in getDateMeta(masterCalData, getLocalDateForCal(masterCalData)).moons"
              :key="mIdx"
              class="moon-badge"
              :title="`${m.moon.name}: ${m.name}`"
            >
              {{ m.emoji }} {{ m.moon.name }}: {{ m.name }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Список локальных летоисчислений культур -->
    <div class="section-label">
      <i class="fas fa-layer-group"></i> Календари культур и рас
    </div>

    <div v-if="localCalsWithData.length === 0" class="no-locals-box glass-panel">
      В проекте пока нет других календарей. Создайте региональный календарь в боковой панели, чтобы сопоставлять его с Календарем Мира.
    </div>

    <div v-else class="converter-grid">
      <div
        v-for="item in localCalsWithData"
        :key="item.id"
        class="calendar-sync-card glass-panel"
      >
        <div class="cal-badge-row">
          <span class="badge-local">Культура</span>
          <span class="cal-name">{{ item.name }}</span>
        </div>

        <div class="controls-row">
          <div v-if="item.data.эпохи && item.data.эпохи.length > 0" class="control-group">
            <label class="control-label">Эпоха</label>
            <select
              :value="getLocalDateForCal(item.data).era_index"
              class="interactive-el glass-select"
              @change="onEraChange(item.data, $event)"
            >
              <option
                v-for="(era, eIdx) in item.data.эпохи"
                :key="eIdx"
                :value="eIdx"
              >
                {{ era.название || `Эпоха ${eIdx + 1}` }}
              </option>
            </select>
          </div>

          <div class="control-group">
            <label class="control-label">Год</label>
            <input
              :value="getLocalDateForCal(item.data).year"
              type="number"
              class="interactive-el glass-input"
              @input="onYearChange(item.data, $event)"
            >
          </div>

          <div class="control-group flex-1">
            <label class="control-label">Месяц</label>
            <select
              :value="getLocalDateForCal(item.data).month"
              class="interactive-el glass-select"
              @change="onMonthChange(item.data, $event)"
            >
              <option
                v-for="(m, mIdx) in item.data.месяцы || []"
                :key="mIdx"
                :value="mIdx"
              >
                {{ m.название }}
              </option>
            </select>
          </div>

          <div class="control-group">
            <label class="control-label">День</label>
            <input
              :value="getLocalDateForCal(item.data).day"
              type="number"
              min="1"
              class="interactive-el glass-input day-input"
              @input="onDayChange(item.data, $event)"
            >
          </div>
        </div>

        <div class="card-meta">
          <div class="meta-row">
            <span class="meta-pill season-pill">
              🌱 {{ getDateMeta(item.data, getLocalDateForCal(item.data)).season }}
            </span>
            <span
              v-if="getDateMeta(item.data, getLocalDateForCal(item.data)).holiday"
              class="meta-pill holiday-pill"
            >
              🎉 {{ getDateMeta(item.data, getLocalDateForCal(item.data)).holiday }}
            </span>
          </div>

          <div
            v-if="getDateMeta(item.data, getLocalDateForCal(item.data)).moons.length > 0"
            class="moons-row"
          >
            <span
              v-for="(m, mIdx) in getDateMeta(item.data, getLocalDateForCal(item.data)).moons"
              :key="mIdx"
              class="moon-badge"
              :title="`${m.moon.name}: ${m.name}`"
            >
              {{ m.emoji }} {{ m.moon.name }}: {{ m.name }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { 
  useTimeAtlasBridgeTab, 
  type TimeAtlasBridgeTabProps 
} from './useTimeAtlasBridgeTab';

const props = defineProps<TimeAtlasBridgeTabProps>();

const {
  masterCalData,
  localCalsWithData,
  onEraChange,
  onYearChange,
  onMonthChange,
  onDayChange
} = useTimeAtlasBridgeTab(props);
</script>
