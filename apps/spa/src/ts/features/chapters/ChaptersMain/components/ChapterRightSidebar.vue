<template>
  <div
    v-if="isVisible"
    class="chapter-right-panel flex-shrink-0"
    :style="{ '--panel-w': width + 'px' }"
  >
    <!-- Том или Арка выбрана: показываем только план -->
    <div v-if="activeTreeNode?.node && activeTreeNode?.type !== 'chapter'" class="flex-1 flex flex-col min-h-0 overflow-hidden">
      <PlanningPanel
        :project="project"
        :parent-type="activeTreeNode.type || 'volume'"
        :parent-id="activeTreeNode.node?.id || ''"
        :parent-title="activeTreeNode.node?.title || ''"
      />
    </div>

    <!-- Глава открыта: Единый Сценарный Хаб с табами -->
    <div v-else-if="currentChapter" class="flex-1 flex flex-col min-h-0 overflow-hidden">
      <!-- 1. Верхний переключатель режимов (Segmented Control) -->
      <div class="sidebar-tab-bar flex-shrink-0 flex p-1.5 gap-1 border-b border-border bg-card">
        <button
          class="sidebar-tab-btn flex-1 py-1 px-2 text-xs rounded font-medium transition-colors flex items-center justify-center gap-1"
          :class="activeTab === 'promises' ? 'bg-primary text-white shadow-sm' : 'text-muted hover:text-main hover:bg-hover'"
          title="Сцены, чеховские ружья, конфликты и обещания"
          @click="setSidebarTab('promises')"
        >
          <span>🎯</span>
          <span>Сцены & Блоки</span>
          <span v-if="promises.length > 0" class="badge badge-subtle ml-1 text-[10px] py-0 px-1">
            {{ promises.length }}
          </span>
        </button>
        <button
          class="sidebar-tab-btn flex-1 py-1 px-2 text-xs rounded font-medium transition-colors flex items-center justify-center gap-1"
          :class="activeTab === 'plans' ? 'bg-primary text-white shadow-sm' : 'text-muted hover:text-main hover:bg-hover'"
          title="Матрица планов: том, арка, глава"
          @click="setSidebarTab('plans')"
        >
          <span>📋</span>
          <span>Планы</span>
        </button>
      </div>

      <!-- 2. Контентная область вкладок -->
      <div class="flex-1 flex flex-col min-h-0 overflow-hidden">
        <!-- ТАБ 1: СЦЕНЫ И СЮЖЕТНЫЕ БЛОКИ -->
        <div v-if="activeTab === 'promises'" class="flex-1 flex flex-col min-h-0 overflow-hidden p-2">
          <PromisesPanel
            ref="promisesPanelRef"
            :project="project"
            :chapter-id="currentChapter.id"
            :chapter-title="currentChapter.title"
            :current-volume-id="currentVolume?.id"
            :all-chapters="chapters"
            :chapter-data="currentChapter"
            @locate="$emit('locatePromise', $event)"
            @change="$emit('markUnsaved')"
            @open-journey="$emit('openJourney')"
          />
        </div>

        <!-- ТАБ 2: ПЛАНЫ (Том / Арка / Глава) -->
        <PlanningMatrixTab
          v-else-if="activeTab === 'plans'"
          :project="project"
          :active-plan-scope="activePlanScope"
          :selected-arc-id="selectedArcId"
          :arcs-list="arcsList"
          :current-arc-title="currentArcTitle"
          :current-volume="currentVolume"
          :current-chapter="currentChapter"
          :current-chapter-id="currentChapterId"
          @update:plan-scope="setPlanScope"
          @select-arc="selectArc"
        />
      </div>
    </div>

    <!-- Ничего не выбрано -->
    <div v-else class="flex-1 flex-col flex-center text-muted text-sm p-4 text-center gap-2">
      <i class="fas fa-hand-pointer text-2xl icon-dim"></i>
      Выберите главу, арку или том
    </div>
  </div>
</template>

<script setup lang="ts">
import PromisesPanel from '../../PromisesPanel/PromisesPanel.vue';
import PlanningPanel from '../../PlanningPanel/PlanningPanel.vue';
import PlanningMatrixTab from './tabs/PlanningMatrixTab.vue';
import type { ChapterRightSidebarProps, ChapterRightSidebarEmits } from './ChapterRightSidebar.model';
import { useChapterRightSidebar } from './useChapterRightSidebar';

const props = defineProps<ChapterRightSidebarProps>();
defineEmits<ChapterRightSidebarEmits>();

const {
  promisesPanelRef,
  volumePlanRef,
  arcPlanRef,
  chapterPlanRef,
  activeTab,
  activePlanScope,
  selectedArcId,
  arcsList,
  currentArcTitle,
  setSidebarTab,
  setPlanScope,
  selectArc,
  addPromise,
  addMilestone,
  loadPromises,
  promises
} = useChapterRightSidebar(props);

defineExpose({
  promisesPanelRef,
  volumePlanRef,
  arcPlanRef,
  chapterPlanRef,
  activeTab,
  setSidebarTab,
  addPromise,
  addMilestone,
  loadPromises,
  promises
});
</script>

<style scoped src="@worldwiki/resources/styles/features/chapters/ChaptersMain.css"></style>
