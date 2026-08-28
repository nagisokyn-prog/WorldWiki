<template>
  <Teleport to="body">
    <div v-if="isOpen" class="time-atlas-overlay" @click.self="$emit('close')">
      <div class="time-atlas-modal glass-panel">
        <!-- Шапка модалки -->
        <div class="atlas-header">
          <div class="header-left">
            <div class="atlas-badge"><i class="fas fa-compass"></i> Атлас Времени</div>
            <h2 class="atlas-title">Наложение и синхронизация летоисчислений</h2>
          </div>
          <div class="header-actions">
            <div class="atlas-tabs">
              <button
                class="atlas-tab-btn"
                :class="{ active: activeTab === 'converter' }"
                @click="activeTab = 'converter'"
              >
                <i class="fas fa-exchange-alt"></i> Мост Времени
              </button>
              <button
                class="atlas-tab-btn"
                :class="{ active: activeTab === 'matrix' }"
                @click="activeTab = 'matrix'"
              >
                <i class="fas fa-th"></i> Наложенная Сетка
              </button>
              <button
                class="atlas-tab-btn"
                :class="{ active: activeTab === 'snippets' }"
                @click="activeTab = 'snippets'"
              >
                <i class="fas fa-feather-alt"></i> Датировки в Текст
              </button>
            </div>
            <button class="atlas-close-btn interactive-el" title="Закрыть" @click="$emit('close')">×</button>
          </div>
        </div>

        <!-- Контент модалки -->
        <div class="atlas-body custom-scrollbar">
          <!-- Детектор совпадений / Сообщение дня -->
          <div v-if="activeAlignments.length > 0" class="alignment-banner">
            <div class="alignment-icon">✨</div>
            <div class="alignment-content">
              <div class="alignment-title">Культурные и астрономические маркеры этого момента:</div>
              <div class="alignment-tags">
                <span
                  v-for="(align, aIdx) in activeAlignments"
                  :key="aIdx"
                  class="alignment-tag"
                  :class="align.type"
                >
                  <strong>{{ align.calName }}:</strong> {{ align.text }}
                </span>
              </div>
            </div>
          </div>

          <!-- ВКЛАДКА 1: Мост Времени -->
          <div v-if="activeTab === 'converter'" class="tab-pane">
            <div class="converter-grid">
              <div
                v-for="calRec in allCalendars"
                :key="calRec.id"
                class="calendar-sync-card glass-panel"
                :class="{ 'is-master': calRec.is_master }"
              >
                <div class="card-top">
                  <div class="cal-badge-row">
                    <span v-if="calRec.is_master" class="badge-master">🌍 Календарь Мира</span>
                    <span v-else class="badge-local">🏛️ Локальный</span>
                    <span class="cal-name">{{ (calRec.data as any)?.название }}</span>
                  </div>
                </div>

                <!-- Контролы даты -->
                <div class="controls-row">
                  <div class="control-group">
                    <label class="control-label">Год</label>
                    <input
                      :value="getLocalDateForCal(calRec.data as any).year"
                      type="number"
                      class="interactive-el glass-input"
                      @input="updateFromLocalDate(calRec.data as any, {
                        ...getLocalDateForCal(calRec.data as any),
                        year: Number(($event.target as HTMLInputElement).value)
                      })"
                    >
                  </div>

                  <div class="control-group flex-1">
                    <label class="control-label">Месяц</label>
                    <select
                      :value="getLocalDateForCal(calRec.data as any).month"
                      class="interactive-el glass-select"
                      @change="updateFromLocalDate(calRec.data as any, {
                        ...getLocalDateForCal(calRec.data as any),
                        month: Number(($event.target as HTMLSelectElement).value)
                      })"
                    >
                      <option
                        v-for="(m, mIdx) in (calRec.data as any)?.месяцы || []"
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
                      :value="getLocalDateForCal(calRec.data as any).day"
                      type="number"
                      min="1"
                      class="interactive-el glass-input day-input"
                      @input="updateFromLocalDate(calRec.data as any, {
                        ...getLocalDateForCal(calRec.data as any),
                        day: Number(($event.target as HTMLInputElement).value)
                      })"
                    >
                  </div>
                </div>

                <!-- Мета-информация (Сезон, Праздник, Луны) -->
                <div class="card-meta">
                  <div class="meta-row">
                    <span class="meta-pill season-pill">
                      🌱 {{ getDateMeta(calRec.data as any, getLocalDateForCal(calRec.data as any)).season }}
                    </span>
                    <span
                      v-if="getDateMeta(calRec.data as any, getLocalDateForCal(calRec.data as any)).holiday"
                      class="meta-pill holiday-pill"
                    >
                      🎉 {{ getDateMeta(calRec.data as any, getLocalDateForCal(calRec.data as any)).holiday }}
                    </span>
                  </div>

                  <!-- Фазы лун -->
                  <div
                    v-if="getDateMeta(calRec.data as any, getLocalDateForCal(calRec.data as any)).moons.length > 0"
                    class="moons-row"
                  >
                    <span
                      v-for="(m, mIdx) in getDateMeta(calRec.data as any, getLocalDateForCal(calRec.data as any)).moons"
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

          <!-- ВКЛАДКА 2: Наложенная Сетка Месяца -->
          <div v-if="activeTab === 'matrix'" class="tab-pane">
            <div class="matrix-toolbar glass-panel">
              <div class="matrix-selector-group">
                <label>Базовый календарь (сетка):</label>
                <select v-model="matrixBaseCalId" class="interactive-el glass-select">
                  <option v-for="c in allCalendars" :key="c.id" :value="c.id">
                    {{ (c.data as any)?.название }}
                  </option>
                </select>
              </div>

              <div class="matrix-selector-group">
                <label>Сравнительный (в углах ячеек):</label>
                <select v-model="matrixCompareCalId" class="interactive-el glass-select">
                  <option v-for="c in allCalendars" :key="c.id" :value="c.id">
                    {{ (c.data as any)?.название }}
                  </option>
                </select>
              </div>

              <div class="matrix-nav-group">
                <button class="matrix-btn interactive-el" @click="prevMatrixMonth">◀</button>
                <span class="matrix-cur-month">
                  {{ matrixBaseCal?.месяцы?.[matrixMonth]?.название }} {{ matrixYear }} г.
                </span>
                <button class="matrix-btn interactive-el" @click="nextMatrixMonth">▶</button>
              </div>
            </div>

            <!-- Сетка дней -->
            <div class="matrix-grid">
              <div
                v-for="d in matrixGridDays"
                :key="d.day"
                class="matrix-day-cell interactive-el"
                :class="{
                  'is-active': d.isCurrent,
                  'has-holiday': d.baseMeta.holiday || d.compHoliday
                }"
                @click="selectMatrixDay(d.baseMin)"
              >
                <div class="cell-top">
                  <span class="base-day-num">{{ d.day }}</span>
                  <span v-if="d.compDateStr" class="comp-day-tag" :title="`В сравнительном календаре: ${d.compDateStr}`">
                    {{ d.compDateStr }}
                  </span>
                </div>

                <div class="cell-body">
                  <div v-if="d.baseMeta.holiday" class="cell-holiday-tag base-holiday" :title="`Праздник: ${d.baseMeta.holiday}`">
                    {{ d.baseMeta.holiday }}
                  </div>
                  <div v-if="d.compHoliday" class="cell-holiday-tag comp-holiday" :title="`Праздник (соседний календарь): ${d.compHoliday}`">
                    ⚡ {{ d.compHoliday }}
                  </div>
                </div>

                <div v-if="d.baseMeta.moons.length > 0" class="cell-moons">
                  <span v-for="(m, mIdx) in d.baseMeta.moons" :key="mIdx" :title="`${m.moon.name}: ${m.name}`">
                    {{ m.emoji }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- ВКЛАДКА 3: Датировки для Рукописи -->
          <div v-if="activeTab === 'snippets'" class="tab-pane">
            <div class="snippets-intro">
              <p>Готовые стилизованные формулировки текущего момента времени для быстрой вставки в текст глав или сносок летописей:</p>
            </div>

            <div class="snippets-list">
              <div
                v-for="(snip, sIdx) in snippetFormats"
                :key="sIdx"
                class="snippet-card glass-panel"
              >
                <div class="snippet-header">
                  <span class="snippet-title">{{ snip.title }}</span>
                  <button
                    class="copy-btn interactive-el"
                    :class="{ copied: copiedIdx === sIdx }"
                    @click="copySnippet(snip.text, sIdx)"
                  >
                    <i :class="copiedIdx === sIdx ? 'fas fa-check' : 'fas fa-copy'"></i>
                    {{ copiedIdx === sIdx ? 'Скопировано!' : 'Копировать' }}
                  </button>
                </div>
                <div class="snippet-text">«{{ snip.text }}»</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useTimeAtlasModal } from './useTimeAtlasModal';

const props = defineProps<{
  project: string;
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const {
  activeTab,
  allCalendars,
  currentWorldMinute,
  matrixBaseCalId,
  matrixCompareCalId,
  matrixYear,
  matrixMonth,
  matrixBaseCal,
  matrixGridDays,
  activeAlignments,
  snippetFormats,
  copiedIdx,
  getLocalDateForCal,
  updateFromLocalDate,
  getDateMeta,
  selectMatrixDay,
  prevMatrixMonth,
  nextMatrixMonth,
  copySnippet
} = useTimeAtlasModal(props, emit);
</script>

<style scoped>
.time-atlas-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  z-index: 9999;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
}

.time-atlas-modal {
  width: 90vw;
  max-width: 1100px;
  height: 85vh;
  background: rgba(18, 18, 26, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(100, 108, 255, 0.1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.atlas-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.atlas-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--accent, #646cff);
  font-weight: 700;
}

.atlas-title {
  margin: 4px 0 0 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-main, #fff);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.atlas-tabs {
  display: flex;
  background: rgba(255, 255, 255, 0.05);
  padding: 3px;
  border-radius: 8px;
  gap: 2px;
}

.atlas-tab-btn {
  background: transparent;
  border: none;
  color: var(--text-muted, #aaa);
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 6px;
}

.atlas-tab-btn.active {
  background: var(--accent, #646cff);
  color: #fff;
  box-shadow: 0 2px 8px rgba(100, 108, 255, 0.4);
}

.atlas-close-btn {
  background: transparent;
  border: none;
  font-size: 24px;
  color: var(--text-muted, #aaa);
  cursor: pointer;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: 0.2s;
}

.atlas-close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.atlas-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.alignment-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: linear-gradient(90deg, rgba(245, 158, 11, 0.15), rgba(139, 92, 246, 0.15));
  border: 1px solid rgba(245, 158, 11, 0.3);
  border-radius: 10px;
  margin-bottom: 20px;
}

.alignment-icon {
  font-size: 20px;
}

.alignment-title {
  font-size: 11px;
  color: var(--text-muted, #aaa);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}

.alignment-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.alignment-tag {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.alignment-tag.holiday {
  background: rgba(239, 68, 68, 0.25);
  border: 1px solid rgba(239, 68, 68, 0.4);
}

.alignment-tag.moon {
  background: rgba(139, 92, 246, 0.25);
  border: 1px solid rgba(139, 92, 246, 0.4);
}

.converter-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 16px;
}

.calendar-sync-card {
  padding: 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.calendar-sync-card.is-master {
  border-color: rgba(100, 108, 255, 0.3);
  background: rgba(100, 108, 255, 0.03);
}

.cal-badge-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.badge-master {
  font-size: 10px;
  background: rgba(100, 108, 255, 0.2);
  color: #818cf8;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 600;
}

.badge-local {
  font-size: 10px;
  background: rgba(255, 255, 255, 0.1);
  color: #ccc;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 600;
}

.cal-name {
  font-weight: 600;
  font-size: 14px;
  color: #fff;
}

.controls-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.control-label {
  font-size: 10px;
  color: var(--text-muted, #888);
}

.day-input {
  width: 55px;
}

.card-meta {
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  padding-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.meta-pill {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
}

.season-pill {
  background: rgba(34, 197, 94, 0.15);
  color: #4ade80;
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.holiday-pill {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.3);
  font-weight: 600;
}

.moons-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.moon-badge {
  font-size: 10px;
  background: rgba(255, 255, 255, 0.05);
  color: #bbb;
  padding: 2px 6px;
  border-radius: 4px;
}

/* Сетка */
.matrix-toolbar {
  display: flex;
  gap: 16px;
  align-items: center;
  flex-wrap: wrap;
  padding: 12px 16px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  margin-bottom: 16px;
}

.matrix-selector-group {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-muted, #aaa);
}

.matrix-nav-group {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
}

.matrix-btn {
  background: rgba(255, 255, 255, 0.08);
  border: none;
  color: #fff;
  padding: 4px 10px;
  border-radius: 4px;
  cursor: pointer;
}

.matrix-cur-month {
  font-weight: 600;
  font-size: 14px;
  color: #fff;
}

.matrix-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
}

.matrix-day-cell {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  padding: 8px;
  min-height: 80px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  cursor: pointer;
  transition: 0.15s;
}

.matrix-day-cell:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.2);
}

.matrix-day-cell.is-active {
  border-color: var(--accent, #646cff);
  background: rgba(100, 108, 255, 0.1);
  box-shadow: 0 0 10px rgba(100, 108, 255, 0.3);
}

.cell-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.base-day-num {
  font-weight: 700;
  font-size: 15px;
  color: #fff;
}

.comp-day-tag {
  font-size: 10px;
  color: var(--accent, #818cf8);
  background: rgba(100, 108, 255, 0.15);
  padding: 1px 4px;
  border-radius: 3px;
}

.cell-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 4px 0;
}

.cell-holiday-tag {
  font-size: 9px;
  padding: 1px 4px;
  border-radius: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.base-holiday {
  background: rgba(239, 68, 68, 0.2);
  color: #fca5a5;
}

.comp-holiday {
  background: rgba(245, 158, 11, 0.2);
  color: #fcd34d;
}

.cell-moons {
  font-size: 10px;
}

/* Сниппеты */
.snippets-intro {
  color: var(--text-muted, #aaa);
  font-size: 13px;
  margin-bottom: 16px;
}

.snippets-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.snippet-card {
  padding: 14px 18px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
}

.snippet-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.snippet-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted, #aaa);
}

.copy-btn {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #fff;
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: 0.2s;
}

.copy-btn:hover {
  background: var(--accent, #646cff);
  border-color: var(--accent, #646cff);
}

.copy-btn.copied {
  background: #10b981;
  border-color: #10b981;
}

.snippet-text {
  font-size: 14px;
  color: #fff;
  font-family: Georgia, serif;
  font-style: italic;
}
</style>
