<template>
  <div class="flex-1 flex flex-col min-h-0 overflow-hidden p-2 gap-2">
    <!-- Подпереключатель области плана -->
    <div class="plan-scope-selector flex p-1 gap-1 rounded bg-secondary text-xs">
      <button
        class="flex-1 py-1 px-2 rounded transition-colors text-center"
        :class="activePlanScope === 'volume' ? 'bg-card text-main font-semibold shadow-xs' : 'text-muted hover:text-main'"
        @click="$emit('update:plan-scope', 'volume')"
      >
        📖 Том
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
        :class="activePlanScope === 'chapter' ? 'bg-card text-main font-semibold shadow-xs' : 'text-muted hover:text-main'"
        @click="$emit('update:plan-scope', 'chapter')"
      >
        📄 Глава
      </button>
    </div>

    <!-- Контент плана Тома -->
    <div v-if="activePlanScope === 'volume'" class="flex-1 flex flex-col min-h-0 overflow-hidden">
      <PlanningPanel
        v-if="currentVolume"
        ref="volumePlanRef"
        :project="project"
        parent-type="volume"
        :parent-id="currentVolume.id"
        :parent-title="currentVolume.title"
      />
      <div v-else class="text-xs text-muted text-center p-4">
        Глава не привязана к тому
      </div>
    </div>

    <!-- Контент плана Арки -->
    <div v-else-if="activePlanScope === 'arc'" class="flex-1 flex flex-col min-h-0 overflow-hidden gap-2">
      <div class="flex items-center gap-2 px-1">
        <label class="text-xs text-muted">Арка:</label>
        <select
          :value="selectedArcId"
          class="flex-1 bg-input border border-border text-xs rounded p-1 text-main"
          @change="$emit('select-arc', ($event.target as HTMLSelectElement).value || null)"
        >
          <option :value="null">-- Выберите арку --</option>
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
      />
      <div v-else class="text-xs text-muted text-center p-4">
        Выберите сюжетную арку из списка выше для просмотра и редактирования её плана.
      </div>
    </div>

    <!-- Контент плана Главы -->
    <div v-else-if="activePlanScope === 'chapter'" class="flex-1 flex flex-col min-h-0 overflow-hidden">
      <PlanningPanel
        v-if="currentChapterId"
        ref="chapterPlanRef"
        :project="project"
        parent-type="chapter"
        :parent-id="currentChapterId"
        :parent-title="currentChapter?.title"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import PlanningPanel from '../../../PlanningPanel/PlanningPanel.vue';
import type { ChapterWithHierarchy, HierarchyVolume } from '@/stores/chapter.store';
import type { StoryArc } from '@/stores/story_arcs.store';
import type { PlanScopeType } from '../ChapterRightSidebar.model';

defineProps<{
  project: string;
  activePlanScope: PlanScopeType;
  selectedArcId: string | null;
  arcsList: StoryArc[];
  currentArcTitle: string;
  currentVolume?: HierarchyVolume | null;
  currentChapter?: ChapterWithHierarchy | null;
  currentChapterId?: string | null;
}>();

defineEmits<{
  (e: 'update:plan-scope', val: PlanScopeType): void;
  (e: 'select-arc', val: string | null): void;
}>();

const volumePlanRef = ref<InstanceType<typeof PlanningPanel> | null>(null);
const arcPlanRef = ref<InstanceType<typeof PlanningPanel> | null>(null);
const chapterPlanRef = ref<InstanceType<typeof PlanningPanel> | null>(null);

defineExpose({
  volumePlanRef,
  arcPlanRef,
  chapterPlanRef
});
</script>

<style scoped src="@worldwiki/resources/styles/features/chapters/ChaptersMain.css"></style>
