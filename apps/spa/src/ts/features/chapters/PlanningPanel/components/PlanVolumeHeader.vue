<template>
  <div class="plan-volume-header">
    <!-- Clickable Header with Collapse Toggle & Progress -->
    <div
      class="volume-header-row"
      title="Нажмите, чтобы скрыть или развернуть главы тома"
      @click="handleToggle"
    >
      <div class="volume-header-left">
        <span class="volume-collapse-icon">
          {{ isCollapsed ? '▸' : '▼' }}
        </span>
        <span class="volume-header-icon">📚</span>
        <span class="volume-header-title" :title="title">
          {{ title }}
        </span>
      </div>
      <div class="volume-header-right flex items-center gap-2">
        <button
          type="button"
          class="btn-help-guide text-[11px] px-1.5 py-0.5 rounded text-muted hover:text-accent flex items-center gap-1 cursor-pointer bg-transparent border border-border"
          title="Справка по работе с Тканью сюжета"
          @click.stop="toggleHelp"
        >
          <span>❓</span>
          <span>Справка</span>
        </button>
        <div class="volume-header-pct">
          {{ progressPct }}%
        </div>
      </div>
    </div>

    <!-- Collapsible Help Guide Card -->
    <div v-if="isHelpOpen" class="volume-help-card mt-2 p-2.5 rounded bg-secondary border border-border text-xs flex flex-col gap-2">
      <div class="flex items-center justify-between font-semibold text-accent border-b border-border pb-1.5">
        <div class="flex items-center gap-1.5">
          <span>💡</span>
          <span>Как устроена «Ткань сюжета» и планирование тома</span>
        </div>
        <button
          type="button"
          class="text-muted hover:text-danger cursor-pointer bg-transparent border-none text-xs px-1"
          title="Закрыть справку"
          @click="toggleHelp"
        >
          ✕
        </button>
      </div>

      <div class="help-grid flex flex-col gap-1.5 text-main">
        <div class="help-item flex items-start gap-2">
          <span class="text-sm shrink-0">📚</span>
          <div>
            <strong>Единый свиток тома:</strong> Все главы перед глазами в хронологическом порядке. Текущая глава развернута, остальные компактно свернуты.
          </div>
        </div>

        <div class="help-item flex items-start gap-2">
          <span class="text-sm shrink-0">⚡</span>
          <div>
            <strong>Сюжетные арки:</strong> Сквозные линии истории. Нажмите <code>＋ Арка</code> внутри главы, чтобы привязать линию и запланировать её шаги.
          </div>
        </div>

        <div class="help-item flex items-start gap-2">
          <span class="text-sm shrink-0">🔗</span>
          <div>
            <strong>Причинно-следственные связи:</strong> Нажмите <code>🔗</code> у любой задачи, чтобы связать её с предшествующим событием. Задача заблокируется замком <code>🔒</code>. Когда предшественник будет завершён (<code>🟢</code>), замок снимется, и система предложит взять сцену в работу!
          </div>
        </div>

        <div class="help-item flex items-start gap-2">
          <span class="text-sm shrink-0">💡</span>
          <div>
            <strong>Бэклог тома:</strong> Записывайте мысли и идеи внизу страницы. Кнопка <code>В главу ➔</code> позволяет в любой момент переместить задумку в нужную главу.
          </div>
        </div>

        <div class="help-item flex items-start gap-2">
          <span class="text-sm shrink-0">⚪ 🟡 🟢 🔒</span>
          <div>
            <strong>Статусы задач:</strong> ЛКМ переключает статус по кругу (В планах ➔ В работе ➔ Готово). ПКМ открывает выбор конкретного статуса.
          </div>
        </div>
      </div>
    </div>

    <!-- Continuous Progress Bar -->
    <div class="volume-progress-bar">
      <div
        class="volume-progress-fill"
        :style="{ width: progressPct + '%' }"
      ></div>
    </div>

    <!-- Status Badges -->
    <div class="volume-status-chips">
      <span v-if="stats.inProgress > 0" class="chip-status chip-warning" title="Задач в работе">
        🟡 {{ stats.inProgress }} в работе
      </span>
      <span v-if="stats.done > 0" class="chip-status chip-success" title="Завершенных задач">
        🟢 {{ stats.done }} готово
      </span>
      <span v-if="stats.planned > 0" class="chip-status chip-neutral" title="Задач в планах">
        ⚪ {{ stats.planned }} в планах
      </span>
      <span v-if="stats.blocked > 0" class="chip-status chip-blocked" title="Заблокированных задач">
        🔒 {{ stats.blocked }} ждёт
      </span>
      <span v-if="stats.total === 0" class="chip-status-empty">
        Нет задач
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PlanVolumeHeaderProps, PlanVolumeHeaderEmits } from './PlanVolumeHeader.model';
import { usePlanVolumeHeader } from './usePlanVolumeHeader';

const props = withDefaults(defineProps<PlanVolumeHeaderProps>(), {
  isCollapsed: false,
});
const emit = defineEmits<PlanVolumeHeaderEmits>();

const {
  isHelpOpen,
  progressPct,
  handleToggle,
  toggleHelp
} = usePlanVolumeHeader(props, emit);
</script>
