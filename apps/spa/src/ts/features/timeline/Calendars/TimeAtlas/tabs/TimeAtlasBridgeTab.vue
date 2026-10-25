<template>
  <div class="atlas-tab-pane tab-pane">
    <!-- Опорный мастер-календарь -->
    <div v-if="masterCalData" class="master-pinned-section">
      <div class="section-label">
        <i class="fas fa-anchor"></i> Опорное летоисчисление (Календарь Мира)
      </div>
      <BridgeMappingCard
        :cal-data="masterCalData"
        :local-date="getLocalDateForCal(masterCalData)"
        :date-meta="getDateMeta(masterCalData, getLocalDateForCal(masterCalData))"
        :is-master="true"
        @era-change="onEraChange"
        @year-change="onYearChange"
        @month-change="onMonthChange"
        @day-change="onDayChange"
      />
    </div>
    <div v-else class="no-locals-box glass-panel">
      Опорный календарь Мира еще не создан или загружается...
    </div>

    <!-- Список локальных летоисчислений культур -->
    <div class="section-label">
      <i class="fas fa-layer-group"></i> Календари культур и рас
    </div>

    <div v-if="localCalsWithData.length === 0" class="no-locals-box glass-panel">
      В проекте пока нет других календарей. Создайте региональный календарь в боковой панели, чтобы сопоставлять его с Календарем Мира.
    </div>

    <div v-else class="converter-grid">
      <BridgeMappingCard
        v-for="item in localCalsWithData"
        :key="item.id"
        :cal-data="item.data"
        :local-date="getLocalDateForCal(item.data)"
        :date-meta="getDateMeta(item.data, getLocalDateForCal(item.data))"
        :is-master="false"
        @era-change="onEraChange"
        @year-change="onYearChange"
        @month-change="onMonthChange"
        @day-change="onDayChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { 
  useTimeAtlasBridgeTab, 
  type TimeAtlasBridgeTabProps 
} from './useTimeAtlasBridgeTab';
import BridgeMappingCard from './BridgeMappingCard.vue';

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
