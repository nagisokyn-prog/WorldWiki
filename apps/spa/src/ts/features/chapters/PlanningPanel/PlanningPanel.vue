<template>
  <div class="planning-panel flex flex-col h-full min-h-0 overflow-hidden">
    <div class="planning-panel-topbar flex items-center justify-between px-3 py-2 border-b border-border bg-base shrink-0">
      <div class="flex items-center gap-2">
        <span class="text-sm font-bold text-main flex items-center gap-1.5"><span>🧵</span> Ткань сюжета</span>
        <span v-if="totalStats.total > 0" class="text-xs text-muted">({{ totalStats.done }}/{{ totalStats.total }} задач)</span>
      </div>
      <div class="flex items-center gap-2">
        <button type="button" class="btn-help-guide" title="Справка по работе с Тканью сюжета" @click="toggleHelp">
          <span>?</span><span>Справка</span>
        </button>
      </div>
    </div>

    <div v-if="isHelpOpen" class="volume-help-card shrink-0">
      <div class="volume-help-header">
        <div class="volume-help-header-title"><span>💡</span><span>Как устроена «Ткань сюжета» и планирование</span></div>
        <button type="button" class="volume-help-close-btn" title="Закрыть справку" @click="toggleHelp">✕</button>
      </div>
      <div class="volume-help-grid grid grid-cols-1 gap-2 mt-2 text-xs text-main">
        <div class="volume-help-item flex items-start gap-2">
          <span>📚</span>
          <div><strong>Все тома перед глазами:</strong> Каждый том представлен отдельным блоком со своим прогрессом, главами и идеями. Блоки можно независимо сворачивать и разворачивать.</div>
        </div>
        <div class="volume-help-item flex items-start gap-2">
          <span>⚡</span>
          <div><strong>Сюжетные арки:</strong> Сквозные линии истории. Нажмите <code>＋ Арка</code> внутри главы, чтобы привязать линию и запланировать её шаги.</div>
        </div>
        <div class="volume-help-item flex items-start gap-2">
          <span>🔗</span>
          <div><strong>Причинно-следственные связи:</strong> Нажмите <code>🔗</code> у любой задачи, чтобы связать её с предшествующим событием. Задача заблокируется замком 🔒. Когда предшественник будет завершён (🟢), замок снимется, и система предложит взять сцену в работу!</div>
        </div>
        <div class="volume-help-item flex items-start gap-2">
          <span>💡</span>
          <div><strong>Бэклог тома:</strong> Записывайте мысли и идеи внизу каждого тома. Кнопка <code>В главу ➔</code> позволяет в любой момент переместить задумку в нужную главу.</div>
        </div>
        <div class="volume-help-item flex items-start gap-2">
          <span>⚪🟢🟡</span>
          <div><strong>Статусы задач:</strong> ЛКМ переключает статус по кругу (В планах ➔ В работе ➔ Готово). ПКМ открывает выбор конкретного статуса.</div>
        </div>
      </div>
    </div>

    <div class="tapestry-stream flex-1 overflow-y-auto px-2 py-3 flex flex-col gap-4 min-h-0">
      <div v-if="loading && volumeBlocks.length === 0" class="text-xs text-muted text-center py-6">
        Загрузка ткани сюжета...
      </div>

      <div v-for="vol in volumeBlocks" :key="vol.volumeId" class="tapestry-volume-block">
        <PlanVolumeHeader
          :title="vol.title"
          :stats="vol.stats"
          :is-collapsed="vol.isCollapsed"
          @toggle-collapse="toggleVolumeCollapse(vol.volumeId)"
        />

        <div v-show="!vol.isCollapsed" class="volume-stream-content flex flex-col gap-3 pl-1 pt-1">
          <TapestryChapterCard
            v-for="chapter in vol.chapters"
            :key="chapter.chapterId"
            :chapter="chapter"
            :all-project-arcs="allProjectArcs"
            :all-todos="allVolumeTodos"
            @toggle="toggleTodoStatus"
            @cycle-status="cycleStatus"
            @set-status="setTodoSpecificStatus"
            @save="saveTodo"
            @delete="deleteTodo"
            @navigate="handleNavigate"
            @toggle-collapse="toggleCollapse"
            @add-todo="addTodo"
            @attach-arc="attachArc"
            @set-dependency="setDependency"
          />

          <div class="tapestry-add-chapter-box">
            <div v-if="addingChapterVolumeId === vol.volumeId" class="plan-inline-add-row">
              <input
                ref="chapterInputRef"
                v-model="newChapterTitle"
                class="plan-inline-add-input flex-1"
                :placeholder="`Название новой главы в «${vol.title}»...`"
                @keydown.enter.prevent="submitAddChapter(vol.volumeId)"
                @keydown.esc="cancelAddChapter"
              />
              <button type="button" class="btn-subtle" @click="submitAddChapter(vol.volumeId)">Создать</button>
              <button type="button" class="btn-subtle text-muted" @click="cancelAddChapter">✕</button>
            </div>
            <button v-else type="button" class="btn-add-chapter-stream" @click="startAddingChapter(vol.volumeId)">
              <span>＋</span> Запланировать следующую главу в томе
            </button>
          </div>

          <VolumeBacklogSection
            :items="vol.backlogTodos"
            :volume-id="vol.volumeId"
            :current-chapter-id="currentChapterId"
            :chapters="vol.chapters"
            @move-to-chapter="moveBacklogToChapter"
            @delete="deleteTodo"
            @add-backlog="addBacklogToVolume(vol.volumeId, $event)"
          />
        </div>
      </div>

      <div class="tapestry-add-volume-box py-3 border-t border-border mt-2">
        <div v-if="isAddingVolume" class="plan-inline-add-row">
          <input
            ref="volumeInputRef"
            v-model="newVolumeTitle"
            class="plan-inline-add-input flex-1"
            placeholder="Название нового тома (например, Том 3: Возрождение)..."
            @keydown.enter.prevent="submitAddVolume"
            @keydown.esc="cancelAddVolume"
          />
          <button type="button" class="btn-subtle" @click="submitAddVolume">Создать том</button>
          <button type="button" class="btn-subtle text-muted" @click="cancelAddVolume">✕</button>
        </div>
        <button v-else type="button" class="btn-add-volume-stream" @click="startAddVolume">
          <span>📚＋</span> Запланировать новый том
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PlanningPanelProps, PlanningPanelEmits } from './PlanningPanel.model';
import { usePlanningPanel } from './usePlanningPanel';
import PlanVolumeHeader from './components/PlanVolumeHeader.vue';
import TapestryChapterCard from './components/TapestryChapterCard.vue';
import VolumeBacklogSection from './components/VolumeBacklogSection.vue';

const props = withDefaults(defineProps<PlanningPanelProps>(), {
  project: undefined, volumeId: null, volumeTitle: '', currentChapterId: null,
  currentChapterTitle: '', arcsList: () => [], selectedArcFilter: null
});
const emit = defineEmits<PlanningPanelEmits>();

const {
  loading, volumeBlocks, totalStats, allProjectArcs, allVolumeTodos, handleNavigate,
  addingChapterVolumeId, newChapterTitle, chapterInputRef, isAddingVolume, newVolumeTitle,
  volumeInputRef, isHelpOpen, toggleHelp, startAddVolume, cancelAddVolume, submitAddVolume,
  toggleCollapse, toggleVolumeCollapse, toggleTodoStatus, cycleStatus, setTodoSpecificStatus,
  saveTodo, setDependency, addTodo, addBacklogToVolume, deleteTodo, startAddingChapter,
  cancelAddChapter, submitAddChapter, moveBacklogToChapter, attachArc
} = usePlanningPanel(props, emit);
</script>

<style src="@worldwiki/resources/styles/features/chapters/PlanningPanel.css"></style>
