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
                :class="{ active: activeTab === 'world_time' }"
                @click="activeTab = 'world_time'"
              >
                <i class="fas fa-globe-americas"></i> Срез Мира
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
            <!-- ЗАКРЕПЛЕННЫЙ СВЕРХУ КАЛЕНДАРЬ МИРА (MASTER CLOCK) -->
            <div v-if="masterCalendarRecord" class="master-pinned-section">
              <div class="section-label">
                <span>🌍 КАЛЕНДАРЬ МИРА (ГЛОБАЛЬНЫЙ ЭТАЛОН ВРЕМЕНИ)</span>
              </div>
              <div class="calendar-sync-card glass-panel is-master pinned-card">
                <div class="card-top">
                  <div class="cal-badge-row">
                    <span class="badge-master">🌍 Календарь Мира</span>
                    <span class="cal-name">{{ (masterCalendarRecord.data as any)?.название }}</span>
                  </div>
                  <span class="badge-pinned-tag">📌 Закреплен эталон</span>
                </div>

                <div class="controls-row">
                  <div class="control-group">
                    <label class="control-label">Год</label>
                    <input
                      :value="getLocalDateForCal(masterCalendarRecord.data as any).year"
                      type="number"
                      class="interactive-el glass-input"
                      @input="updateFromLocalDate(masterCalendarRecord.data as any, {
                        ...getLocalDateForCal(masterCalendarRecord.data as any),
                        year: Number(($event.target as HTMLInputElement).value)
                      })"
                    >
                  </div>

                  <div class="control-group flex-1">
                    <label class="control-label">Месяц</label>
                    <select
                      :value="getLocalDateForCal(masterCalendarRecord.data as any).month"
                      class="interactive-el glass-select"
                      @change="updateFromLocalDate(masterCalendarRecord.data as any, {
                        ...getLocalDateForCal(masterCalendarRecord.data as any),
                        month: Number(($event.target as HTMLSelectElement).value)
                      })"
                    >
                      <option
                        v-for="(m, mIdx) in (masterCalendarRecord.data as any)?.месяцы || []"
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
                      :value="getLocalDateForCal(masterCalendarRecord.data as any).day"
                      type="number"
                      min="1"
                      class="interactive-el glass-input day-input"
                      @input="updateFromLocalDate(masterCalendarRecord.data as any, {
                        ...getLocalDateForCal(masterCalendarRecord.data as any),
                        day: Number(($event.target as HTMLInputElement).value)
                      })"
                    >
                  </div>
                </div>

                <div class="card-meta">
                  <div class="meta-row">
                    <span class="meta-pill season-pill">
                      🌱 {{ getDateMeta(masterCalendarRecord.data as any, getLocalDateForCal(masterCalendarRecord.data as any)).season }}
                    </span>
                    <span
                      v-if="getDateMeta(masterCalendarRecord.data as any, getLocalDateForCal(masterCalendarRecord.data as any)).holiday"
                      class="meta-pill holiday-pill"
                    >
                      🎉 {{ getDateMeta(masterCalendarRecord.data as any, getLocalDateForCal(masterCalendarRecord.data as any)).holiday }}
                    </span>
                  </div>

                  <div
                    v-if="getDateMeta(masterCalendarRecord.data as any, getLocalDateForCal(masterCalendarRecord.data as any)).moons.length > 0"
                    class="moons-row"
                  >
                    <span
                      v-for="(m, mIdx) in getDateMeta(masterCalendarRecord.data as any, getLocalDateForCal(masterCalendarRecord.data as any)).moons"
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

            <!-- ЛОКАЛЬНЫЕ КАЛЕНДАРИ (ПОДЧИНЕННЫЕ) -->
            <div class="local-calendars-section mt-4">
              <div class="section-label">
                <span>🏛️ ЛОКАЛЬНЫЕ КАЛЕНДАРИ НАРОДОВ И ПЛЕМЁН (СИНХРОНИЗАЦИЯ)</span>
              </div>

              <div v-if="localCalendarRecords.length > 0" class="converter-grid">
                <div
                  v-for="calRec in localCalendarRecords"
                  :key="calRec.id"
                  class="calendar-sync-card glass-panel"
                >
                  <div class="card-top">
                    <div class="cal-badge-row">
                      <span class="badge-local">🏛️ Локальный</span>
                      <span class="cal-name">{{ (calRec.data as any)?.название }}</span>
                    </div>
                  </div>

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

              <div v-else class="no-locals-box glass-panel">
                <span>Нет локальных календарей. Создайте календарь племени или народа в настройках проекта, чтобы сопоставлять даты с Календарём Мира.</span>
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

          <!-- ВКЛАДКА: Срез Мира и Часовые Пояса -->
          <div v-if="activeTab === 'world_time'" class="tab-pane">
            <div class="world-time-intro">
              <p>Синхронный срез физического времени и астрономического солнца по всем регионам планеты в этот момент:</p>
            </div>

            <!-- Сетка регионов мира -->
            <div class="world-regions-grid">
              <div
                v-for="item in worldTimeSnapshot"
                :key="item.region.id"
                class="region-card glass-panel"
              >
                <div class="region-card-header">
                  <div class="region-info">
                    <span class="region-name">{{ item.region.name }}</span>
                    <span class="region-tz-badge">
                      {{ item.timezone?.name || 'Пояс' }} ({{ item.offsetHours >= 0 ? '+' : '' }}{{ item.offsetHours }} ч)
                    </span>
                  </div>
                  <span class="phase-pill" :class="item.sunStatus.phase">
                    {{ item.sunStatus.phase_label }}
                  </span>
                </div>

                <div class="region-time-display">
                  <span class="time-value">{{ item.localTimeStr }}</span>
                  <span class="date-value">{{ item.localDateFormatted }}</span>
                </div>

                <div class="region-card-footer">
                  <div class="sun-detail-row">
                    <span>☀️ Восход: <strong>{{ item.sunStatus.sunrise_time }}</strong></span>
                    <span>Закат: <strong>{{ item.sunStatus.sunset_time }}</strong></span>
                  </div>
                  <div class="sun-detail-row text-muted">
                    <span>Свет: {{ item.sunStatus.daylight_text }}</span>
                    <span>{{ item.sunStatus.note }}</span>
                  </div>
                </div>
              </div>

              <div v-if="worldTimeSnapshot.length === 0" class="empty-world-panel glass-panel">
                <i class="fas fa-compass fa-2x mb-2 text-muted"></i>
                <p>В мире ещё не настроены регионы и часовые пояса.</p>
                <p class="text-sm text-muted">Перейдите в настройки Календаря Мира, чтобы добавить города, пояса, широту и долготу.</p>
              </div>
            </div>

            <!-- Художественная лор-панорама -->
            <div class="world-panorama-card glass-panel mt-4">
              <div class="panorama-header">
                <span class="panorama-title"><i class="fas fa-feather-alt"></i> Литературная панорама для рукописи:</span>
                <button
                  class="copy-btn interactive-el"
                  :class="{ copied: isWorldTimeCopied }"
                  @click="copyWorldTimeSnippet"
                >
                  <i :class="isWorldTimeCopied ? 'fas fa-check' : 'fas fa-copy'"></i>
                  {{ isWorldTimeCopied ? 'Скопировано!' : 'Скопировать сводку' }}
                </button>
              </div>
              <div class="panorama-quote">«{{ worldTimeSnippet }}»</div>
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
  masterCalendarRecord,
  localCalendarRecords,
  currentWorldMinute,
  worldTimeSnapshot,
  worldTimeSnippet,
  isWorldTimeCopied,
  copyWorldTimeSnippet,
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
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(var(--glass-blur-sm, 8px));
  -webkit-backdrop-filter: blur(var(--glass-blur-sm, 8px));
  z-index: 10000;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
}

.time-atlas-modal {
  width: 90vw;
  max-width: 1100px;
  height: 85vh;
  background: var(--bg-panel);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-card, 16px);
  box-shadow: var(--shadow-lg), var(--shadow-glow);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.atlas-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  border-bottom: 1px solid var(--border-color);
}

.atlas-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--accent);
  font-weight: 700;
}

.atlas-title {
  margin: 4px 0 0 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-main);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.atlas-tabs {
  display: flex;
  background: var(--bg-input);
  padding: 3px;
  border-radius: var(--radius-sm, 8px);
  border: 1px solid var(--border-color);
  gap: 2px;
}

.atlas-tab-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  padding: 6px 14px;
  border-radius: var(--radius-xs, 6px);
  font-size: 13px;
  cursor: pointer;
  transition: all var(--anim-speed-fast, 0.15s) var(--anim-ease, ease);
  display: flex;
  align-items: center;
  gap: 6px;
}

.atlas-tab-btn.active {
  background: var(--accent);
  color: #fff;
  box-shadow: var(--shadow-glow);
}

.atlas-close-btn {
  background: transparent;
  border: none;
  font-size: 24px;
  color: var(--text-muted);
  cursor: pointer;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-xs, 6px);
  transition: all var(--anim-speed-fast, 0.15s) var(--anim-ease, ease);
}

.atlas-close-btn:hover {
  background: var(--bg-hover);
  color: var(--error, #ef4444);
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
  background: var(--bg-selected);
  border: 1px solid var(--border-active);
  border-radius: var(--radius-md, 10px);
  margin-bottom: 20px;
}

.alignment-icon {
  font-size: 20px;
  color: var(--accent);
}

.alignment-title {
  font-size: 11px;
  color: var(--text-muted);
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
  border-radius: var(--radius-xs, 4px);
  background: var(--bg-hover);
  border: 1px solid var(--border-color);
  color: var(--text-main);
}

.alignment-tag.holiday {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.4);
  color: var(--error, #ef4444);
}

.alignment-tag.moon {
  background: var(--bg-selected);
  border-color: var(--border-active);
  color: var(--accent-light, var(--text-main));
}

.alignment-tag.sun {
  background: var(--bg-hover);
  border-color: var(--border-active);
  color: var(--accent);
}

.master-pinned-section {
  margin-bottom: 20px;
}

.section-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted);
  letter-spacing: 0.8px;
  margin-bottom: 8px;
  text-transform: uppercase;
}

.pinned-card {
  box-shadow: 0 4px 20px var(--accent-glow);
  border: 1px solid var(--border-active) !important;
}

.badge-pinned-tag {
  font-size: 10px;
  color: var(--accent);
  background: var(--bg-hover);
  border: 1px solid var(--border-color);
  padding: 2px 6px;
  border-radius: var(--radius-xs, 4px);
  margin-left: auto;
}

.no-locals-box {
  padding: 20px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
  border-radius: var(--radius-md, 10px);
  border: 1px dashed var(--border-color);
}

.converter-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 16px;
}

.calendar-sync-card {
  padding: 16px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md, 12px);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.calendar-sync-card.is-master {
  border-color: var(--border-active);
  background: var(--bg-selected);
}

.cal-badge-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.badge-master {
  font-size: 10px;
  background: var(--bg-selected);
  color: var(--accent-light, var(--text-main));
  border: 1px solid var(--border-active);
  padding: 2px 6px;
  border-radius: var(--radius-xs, 4px);
  font-weight: 600;
}

.badge-local {
  font-size: 10px;
  background: var(--bg-hover);
  color: var(--text-muted);
  border: 1px solid var(--border-color);
  padding: 2px 6px;
  border-radius: var(--radius-xs, 4px);
  font-weight: 600;
}

.cal-name {
  font-weight: 600;
  font-size: 14px;
  color: var(--text-main);
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
  color: var(--text-muted);
}

.day-input {
  width: 55px;
}

.glass-input,
.glass-select {
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  color: var(--text-main);
  border-radius: var(--radius-xs, 4px);
  padding: 6px 8px;
  font-size: 12px;
  outline: none;
  transition: border-color var(--anim-speed-fast, 0.15s) var(--anim-ease, ease);
}

.glass-input:focus,
.glass-select:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-glow);
}

.card-meta {
  border-top: 1px solid var(--border-color);
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
  border-radius: var(--radius-xs, 4px);
}

.season-pill {
  background: rgba(16, 185, 129, 0.15);
  color: var(--success, #10b981);
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.holiday-pill {
  background: rgba(239, 68, 68, 0.15);
  color: var(--error, #ef4444);
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
  background: var(--bg-hover);
  border: 1px solid var(--border-color);
  color: var(--text-muted);
  padding: 2px 6px;
  border-radius: var(--radius-xs, 4px);
}

/* Сетка */
.matrix-toolbar {
  display: flex;
  gap: 16px;
  align-items: center;
  flex-wrap: wrap;
  padding: 12px 16px;
  border-radius: var(--radius-md, 10px);
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  margin-bottom: 16px;
}

.matrix-selector-group {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-muted);
}

.matrix-nav-group {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
}

.matrix-btn {
  background: var(--bg-hover);
  border: 1px solid var(--border-color);
  color: var(--text-main);
  padding: 4px 10px;
  border-radius: var(--radius-xs, 4px);
  cursor: pointer;
}

.matrix-btn:hover {
  background: var(--bg-active);
  border-color: var(--border-hover);
}

.matrix-cur-month {
  font-weight: 600;
  font-size: 14px;
  color: var(--text-main);
}

.matrix-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
}

.matrix-day-cell {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm, 8px);
  padding: 8px;
  min-height: 80px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  cursor: pointer;
  transition: all var(--anim-speed-fast, 0.15s) var(--anim-ease, ease);
}

.matrix-day-cell:hover {
  background: var(--bg-hover);
  border-color: var(--border-hover);
}

.matrix-day-cell.is-active {
  border-color: var(--border-active);
  background: var(--bg-selected);
  box-shadow: var(--shadow-glow);
}

.cell-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.base-day-num {
  font-weight: 700;
  font-size: 15px;
  color: var(--text-main);
}

.comp-day-tag {
  font-size: 10px;
  color: var(--accent);
  background: var(--bg-selected);
  border: 1px solid var(--border-active);
  padding: 1px 4px;
  border-radius: var(--radius-xs, 3px);
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
  border-radius: var(--radius-xs, 2px);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.base-holiday {
  background: rgba(239, 68, 68, 0.2);
  color: var(--error, #ef4444);
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.comp-holiday {
  background: rgba(245, 158, 11, 0.2);
  color: var(--warning, #f59e0b);
  border: 1px solid rgba(245, 158, 11, 0.3);
}

.cell-moons {
  font-size: 10px;
}

/* Сниппеты */
.snippets-intro {
  color: var(--text-muted);
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
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md, 10px);
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
  color: var(--text-muted);
}

.copy-btn {
  background: var(--bg-hover);
  border: 1px solid var(--border-color);
  color: var(--text-main);
  font-size: 12px;
  padding: 4px 10px;
  border-radius: var(--radius-xs, 6px);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all var(--anim-speed-fast, 0.15s) var(--anim-ease, ease);
}

.copy-btn:hover {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
  box-shadow: var(--shadow-glow);
}

.copy-btn.copied {
  background: var(--success, #10b981);
  border-color: var(--success, #10b981);
  color: #fff;
}

.snippet-text {
  font-size: 14px;
  color: var(--text-main);
  font-family: Georgia, serif;
  font-style: italic;
}

/* Стили вкладки «Срез Мира» */
.world-time-intro {
  margin-bottom: 16px;
  font-size: 13px;
  color: var(--text-muted);
}

.world-regions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.region-card {
  padding: 16px;
  border-radius: var(--radius-sm, 8px);
  background: var(--bg-panel, rgba(30, 30, 47, 0.6));
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition: transform var(--anim-speed-fast) ease, box-shadow var(--anim-speed-fast) ease;
}

.region-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg, 0 8px 24px rgba(0, 0, 0, 0.3));
  border-color: var(--accent, #6366f1);
}

.region-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}

.region-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.region-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-main, #fff);
}

.region-tz-badge {
  font-size: 11px;
  color: var(--text-muted, #94a3b8);
}

.phase-pill {
  padding: 3px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.phase-pill.dawn {
  background: rgba(245, 158, 11, 0.2);
  color: #f59e0b;
  border: 1px solid rgba(245, 158, 11, 0.4);
}

.phase-pill.day {
  background: rgba(234, 179, 8, 0.2);
  color: #eab308;
  border: 1px solid rgba(234, 179, 8, 0.4);
}

.phase-pill.dusk {
  background: rgba(236, 72, 153, 0.2);
  color: #ec4899;
  border: 1px solid rgba(236, 72, 153, 0.4);
}

.phase-pill.night {
  background: rgba(99, 102, 241, 0.2);
  color: #818cf8;
  border: 1px solid rgba(99, 102, 241, 0.4);
}

.region-time-display {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.25);
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.time-value {
  font-size: 26px;
  font-weight: 700;
  color: var(--text-main, #fff);
  font-variant-numeric: tabular-nums;
  letter-spacing: 1px;
}

.date-value {
  font-size: 12px;
  color: var(--text-muted, #94a3b8);
}

.region-card-footer {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
}

.sun-detail-row {
  display: flex;
  justify-content: space-between;
  color: var(--text-main, #e2e8f0);
}

.sun-detail-row.text-muted {
  color: var(--text-muted, #94a3b8);
}

.empty-world-panel {
  grid-column: 1 / -1;
  text-align: center;
  padding: 40px 20px;
  border-radius: var(--radius-sm, 8px);
}

.world-panorama-card {
  padding: 16px 20px;
  border-radius: var(--radius-sm, 8px);
  background: var(--bg-panel, rgba(30, 30, 47, 0.6));
  border: 1px solid var(--border-color);
}

.panorama-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.panorama-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--accent, #6366f1);
  display: flex;
  align-items: center;
  gap: 8px;
}

.panorama-quote {
  font-size: 14px;
  line-height: 1.6;
  font-style: italic;
  font-family: Georgia, serif;
  color: var(--text-main, #fff);
  background: rgba(0, 0, 0, 0.2);
  padding: 12px 16px;
  border-left: 3px solid var(--accent, #6366f1);
  border-radius: 0 6px 6px 0;
}
</style>
