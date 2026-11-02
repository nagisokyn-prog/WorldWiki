<template>
  <div class="flex-1 flex flex-col min-h-0 overflow-hidden p-2 gap-2">
    <!-- Переключатель области / проекции плана -->
    <div class="plan-scope-selector flex p-1 gap-1 rounded bg-secondary text-xs">
      <button
        class="flex-1 py-1 px-2 rounded transition-colors text-center"
        :class="activePlanScope === 'chapter' ? 'bg-card text-main font-semibold shadow-xs' : 'text-muted hover:text-main'"
        @click="$emit('update:plan-scope', 'chapter')"
      >
        📄 Глава
      </button>
      <button
        class="flex-1 py-1 px-2 rounded transition-colors text-center"
        :class="activePlanScope === 'arc' ? 'bg-card text-main font-semibold shadow-xs' : 'text-muted hover:text-main'"
        @click="$emit('update:plan-scope', 'arc')"
      >
        ⚡ Арка
      </button>
      <button
        class="flex-1 py-1 px-2 rounded transition-colors text-center"
        :class="activePlanScope === 'volume' ? 'bg-card text-main font-semibold shadow-xs' : 'text-muted hover:text-main'"
        @click="$emit('update:plan-scope', 'volume')"
      >
        📖 Том
      </button>
    </div>

    <!-- ТАБ: ПЛАН ГЛАВЫ (Ткань сюжета главы + арки) -->
    <div v-if="activePlanScope === 'chapter'" class="flex-1 flex flex-col min-h-0 overflow-hidden">
      <PlanningPanel
        v-if="currentChapterId"
        ref="chapterPlanRef"
        :project="project"
        parent-type="chapter"
        :parent-id="currentChapterId"
        :parent-title="currentChapter?.title"
        :arcs-list="arcsList"
        :selected-arc-filter="selectedArcId"
        @select-arc="$emit('select-arc', $event)"
      />
    </div>

    <!-- ТАБ: ПЛАН АРКИ (Сквозная сюжетная линия) -->
    <div v-else-if="activePlanScope === 'arc'" class="flex-1 flex flex-col min-h-0 overflow-hidden gap-2">
      <div class="flex items-center gap-2 px-1">
        <label class="text-xs text-muted">Арка:</label>
        <select
          :value="selectedArcId"
          class="flex-1 bg-input border border-border text-xs rounded p-1 text-main"
          @change="$emit('select-arc', ($event.target as HTMLSelectElement).value || null)"
        >
          <option :value="null">-- Все сюжетные арки --</option>
          <option v-for="arc in arcsList" :key="arc.id || ''" :value="arc.id">
            {{ arc.title }}
          </option>
        </select>
      </div>
      <PlanningPanel
        v-if="selectedArcId"
        ref="arcPlanRef"
        :project="project"
        parent-type="arc"
        :parent-id="selectedArcId"
        :parent-title="currentArcTitle"
        :arcs-list="arcsList"
        @select-arc="$emit('select-arc', $event)"
      />
      <div v-else class="text-xs text-muted text-center p-4">
        Выберите сюжетную арку для просмотра её сквозного плана через все главы.
      </div>
    </div>

    <!-- ТАБ: ПЛАН ТОМА (Макро-цели и бэклог идей) -->
    <div v-else-if="activePlanScope === 'volume'" class="flex-1 flex flex-col min-h-0 overflow-hidden">
      <PlanningPanel
        v-if="currentVolume"
        ref="volumePlanRef"
        :project="project"
        parent-type="volume"
        :parent-id="currentVolume.id"
        :parent-title="currentVolume.title"
        :arcs-list="arcsList"
        @select-arc="$emit('select-arc', $event)"
      />
      <div v-else class="text-xs text-muted text-center p-4">
        Глава не привязана к тому
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PlanningMatrixTabProps, PlanningMatrixTabEmits } from './PlanningMatrixTab.model';
import { ref } from 'vue';
import PlanningPanel from '../../../PlanningPanel/PlanningPanel.vue';

defineProps<PlanningMatrixTabProps>();

defineEmits<PlanningMatrixTabEmits>();

const volumePlanRef = ref<InstanceType<typeof PlanningPanel> | null>(null);
const arcPlanRef = ref<InstanceType<typeof PlanningPanel> | null>(null);
const chapterPlanRef = ref<InstanceType<typeof PlanningPanel> | null>(null);

defineExpose({
  volumePlanRef,
  arcPlanRef,
  chapterPlanRef
});
</script>
