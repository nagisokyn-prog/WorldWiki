<template>
  <div class="tool-section promises-section">
    <div class="section-header" @click="isCollapsed = !isCollapsed">
      <div class="flex items-center gap-2">
        <span class="collapse-icon">{{ isCollapsed ? '▶' : '▼' }}</span>
        <span class="font-bold text-sm">🎯 Сюжетные обещания</span>
        <span v-if="promises.length > 0" class="badge badge-subtle">
          {{ promises.length }}
        </span>
      </div>
      <button 
        class="btn-icon-subtle text-xs" 
        title="Обновить список" 
        @click.stop="loadPromises"
      >
        🔄
      </button>
    </div>

    <div v-show="!isCollapsed" class="section-content">
      
      <!-- Фильтры: Область видимости (Все / Текущая глава) -->
      <div class="promise-filters-bar">
        <div class="scope-tabs">
          <button 
            class="tab-pill" 
            :class="{ active: scopeFilter === 'all' }"
            @click="scopeFilter = 'all'"
          >
            Все ({{ promises.length }})
          </button>
          <button 
            class="tab-pill" 
            :class="{ active: scopeFilter === 'current' }"
            @click="scopeFilter = 'current'"
          >
            В этой главе ({{ chapterPromises.length }})
          </button>
        </div>

        <!-- Фильтр по статусу -->
        <div class="status-pills">
          <button 
            class="status-pill-btn" 
            :class="{ active: statusFilter === 'all' }"
            @click="statusFilter = 'all'"
          >
            Все
          </button>
          <button 
            v-for="st in PROMISE_STATUSES"
            :key="st.id"
            class="status-pill-btn" 
            :class="{ active: statusFilter === st.id }"
            @click="statusFilter = st.id as any"
          >
            {{ st.icon }} {{ st.label }}
          </button>
        </div>
      </div>

      <div v-if="loading" class="text-xs text-muted p-2 text-center">
        Загрузка обещаний...
      </div>

      <div v-else-if="filteredPromises.length === 0" class="empty-state">
        <div class="text-xs text-muted">
          {{ scopeFilter === 'current' ? 'В текущей главе нет сюжетных обещаний.' : 'В проекте пока нет сюжетных обещаний.' }}
          <br />
          Выделите текст и нажмите <kbd class="kbd-hint">ПКМ</kbd>, чтобы добавить или развить.
        </div>
      </div>

      <div v-else class="promises-list">
        <div 
          v-for="item in filteredPromises" 
          :key="item.id || item.quote"
          class="promise-card"
          :class="`status-${item.status}`"
        >
          <!-- Верхняя плашка: Иконка, тип, локация и кнопка удаления -->
          <div class="card-header">
            <div class="flex items-center gap-1.5 flex-1 min-w-0">
              <span class="kind-icon">{{ getKindInfo(item.kind).icon }}</span>
              <span class="kind-label font-semibold">{{ getKindInfo(item.kind).label }}</span>
            </div>
            <button 
              class="btn-delete" 
              title="Удалить обещание" 
              @click="removePromise(item)"
            >
              ✕
            </button>
          </div>

          <!-- ХРОНОЛОГИЯ ЖИЗНИ ОБЕЩАНИЯ (МИНИ-ТАЙМЛАЙН) -->
          <div class="promise-timeline">

            <!-- 1. 🌱 ТОЧКА ПОСАДКИ (PLANT) -->
            <div class="timeline-step step-plant">
              <div class="step-badge">
                <span class="step-icon">🌱</span>
                <span class="step-name">Посажено:</span>
                <span class="step-location">{{ getChapterTitle(item.chapter_id) }} · абз. {{ item.paragraph_index }}</span>
                <span v-if="isCurrentChapterPromise(item.chapter_id)" class="badge-current-chapter">текущая</span>
              </div>
              
              <blockquote class="card-quote">
                «{{ item.quote }}»
              </blockquote>

              <div class="step-actions">
                <button class="btn-locate-step" @click="locateSource(item)">
                  📍 Перейти к сцене
                </button>
              </div>
            </div>

            <!-- 2. 🌿 ТОЧКИ РАЗВИТИЯ (PROGRESSIONS) -->
            <div v-if="item.progressions && item.progressions.length > 0" class="timeline-group-progressions">
              <div class="group-header">
                <span class="step-icon">🌿</span>
                <span class="group-title">Развитие ({{ item.progressions.length }}):</span>
              </div>

              <div 
                v-for="prog in item.progressions" 
                :key="prog.id"
                class="timeline-step step-progression"
              >
                <div class="step-badge">
                  <span class="step-connector">├─</span>
                  <span class="step-location font-medium">{{ getChapterTitle(prog.chapter_id) }} · абз. {{ prog.paragraph_index }}</span>
                  <span v-if="isCurrentChapterPromise(prog.chapter_id)" class="badge-current-chapter">текущая</span>
                  <button 
                    class="btn-delete-step" 
                    title="Удалить это упоминание"
                    @click="removeMilestone(item, prog.id, 'progression')"
                  >
                    ✕
                  </button>
                </div>

                <blockquote class="card-quote quote-small">
                  «{{ prog.quote }}»
                </blockquote>

                <div class="step-actions">
                  <button class="btn-locate-step" @click="locateSource(prog)">
                    📍 Перейти
                  </button>
                </div>
              </div>
            </div>

            <!-- 3. 🎯 ТОЧКА ВЫСТРЕЛА / РАЗВЯЗКИ (RESOLUTION) -->
            <div v-if="item.resolution" class="timeline-step step-resolution">
              <div class="step-badge">
                <span class="step-icon">🎯</span>
                <span class="step-name font-bold text-success">Отстреляно:</span>
                <span class="step-location font-semibold">{{ getChapterTitle(item.resolution.chapter_id) }} · абз. {{ item.resolution.paragraph_index }}</span>
                <span v-if="isCurrentChapterPromise(item.resolution.chapter_id)" class="badge-current-chapter">текущая</span>
                <button 
                  class="btn-delete-step" 
                  title="Сбросить выстрел"
                  @click="removeMilestone(item, item.resolution.id, 'resolution')"
                >
                  ✕
                </button>
              </div>

              <blockquote class="card-quote quote-resolution">
                «{{ item.resolution.quote }}»
              </blockquote>

              <div class="step-actions">
                <button class="btn-locate-step" @click="locateSource(item.resolution)">
                  📍 Перейти к финалу
                </button>
              </div>
            </div>

          </div>

          <!-- Быстрые действия с карточкой -->
          <div class="card-quick-actions">
            <button 
              class="btn-quick btn-quick-progress" 
              title="Развить обещание выделенной фразой"
              @click="promptAttachMilestone(item, 'progression')"
            >
              🌿 + Развить
            </button>
            <button 
              v-if="!item.resolution"
              class="btn-quick btn-quick-resolve" 
              title="Отстрелять обещание в текущей главе"
              @click="promptAttachMilestone(item, 'resolution')"
            >
              🎯 Отстрелять
            </button>
          </div>

          <!-- Заметка -->
          <div class="card-note-section">
            <div v-if="editingNoteId === item.id" class="note-edit-box">
              <textarea 
                v-model="noteDraft" 
                placeholder="Заметка к обещанию..."
                class="note-textarea"
                rows="2"
                @keydown.enter.ctrl.prevent="saveNote(item)"
                @keydown.esc.prevent="cancelEditNote"
              ></textarea>
              <div class="note-actions">
                <button class="btn-xs btn-primary" @click="saveNote(item)">Сохранить</button>
                <button class="btn-xs btn-ghost" @click="cancelEditNote">Отмена</button>
              </div>
            </div>
            <div v-else-if="item.note" class="note-display" @click="startEditNote(item)">
              <span class="note-icon">📝</span>
              <span class="note-text">{{ item.note }}</span>
            </div>
            <button 
              v-else 
              class="btn-add-note" 
              @click="startEditNote(item)"
            >
              + Заметка
            </button>
          </div>

          <!-- Статус-радио переключатель -->
          <div class="card-status-section">
            <div class="status-options">
              <label 
                v-for="st in PROMISE_STATUSES" 
                :key="st.id"
                class="status-radio-label"
                :class="{ active: item.status === st.id }"
              >
                <input 
                  type="radio" 
                  :name="`status-${item.id}`" 
                  :value="st.id" 
                  :checked="item.status === st.id"
                  @change="updateStatus(item, st.id)"
                />
                <span class="radio-custom"></span>
                <span class="status-name">{{ st.label }}</span>
              </label>
            </div>
          </div>

        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { usePromisesPanel, PROMISE_STATUSES, type ChapterMetaItem } from './usePromisesPanel';
import type { PlotPromise } from '@/types/generated/PlotPromise';

const props = defineProps<{
  project: string;
  chapterId?: string | null;
  chapterTitle?: string | null;
  currentVolumeId?: string | null;
  currentArcId?: string | null;
  allChapters?: ChapterMetaItem[];
}>();

const emit = defineEmits<{
  (e: 'locate', payload: { chapterId: string; paragraphIndex: number; quote: string; blockId?: string }): void;
  (e: 'change'): void;
}>();

const isCollapsed = ref(false);

const {
  promises,
  chapterPromises,
  filteredPromises,
  loading,
  editingNoteId,
  noteDraft,
  scopeFilter,
  statusFilter,
  loadPromises,
  addPromise,
  addMilestone,
  removeMilestone,
  updateStatus,
  startEditNote,
  saveNote,
  cancelEditNote,
  removePromise,
  locateSource,
  getKindInfo,
  getChapterTitle,
  isCurrentChapterPromise
} = usePromisesPanel(props, emit);

const promptAttachMilestone = (item: PlotPromise, stage: 'progression' | 'resolution') => {
  if (!item.id) return;
  const sel = window.getSelection()?.toString().trim();
  const quote = sel || prompt(stage === 'progression' ? 'Введите цитату/текст упоминания:' : 'Введите цитату кульминации/выстрела:');
  if (!quote) return;

  addMilestone({
    promiseId: item.id,
    stage,
    quote,
    paragraph_index: 1,
    chapterId: props.chapterId || undefined
  });
};

defineExpose({
  promises,
  addPromise,
  addMilestone,
  loadPromises
});
</script>

<style scoped>
.promises-section {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  overflow: hidden;
  margin-bottom: 8px;
  display: flex;
  flex-direction: column;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--bg-card-header, rgba(255, 255, 255, 0.02));
  cursor: pointer;
  user-select: none;
  border-bottom: 1px solid var(--border-color);
  transition: background var(--anim-speed-fast) ease;
}

.section-header:hover {
  background: var(--bg-hover);
}

.collapse-icon {
  font-size: 10px;
  color: var(--text-muted);
}

.badge-subtle {
  background: var(--bg-selected);
  color: var(--text-main);
  padding: 2px 6px;
  border-radius: var(--radius-full);
  font-size: 10px;
  font-weight: 600;
}

.section-content {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 480px;
  overflow-y: auto;
}

.section-content::-webkit-scrollbar {
  width: 4px;
}
.section-content::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 4px;
}

.promise-filters-bar {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border-color);
}

.scope-tabs {
  display: flex;
  gap: 4px;
  background: var(--bg-input);
  padding: 2px;
  border-radius: var(--radius-xs);
}

.tab-pill {
  flex: 1;
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 11px;
  padding: 4px 6px;
  border-radius: var(--radius-xs);
  cursor: pointer;
  transition: all var(--anim-speed-fast) ease;
  font-family: inherit;
  white-space: nowrap;
}

.tab-pill:hover {
  color: var(--text-main);
}

.tab-pill.active {
  background: var(--accent);
  color: #fff;
  font-weight: 600;
}

.status-pills {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  padding-bottom: 2px;
}

.status-pills::-webkit-scrollbar {
  height: 2px;
}
.status-pills::-webkit-scrollbar-thumb {
  background: var(--border-color);
}

.status-pill-btn {
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  color: var(--text-muted);
  font-size: 10px;
  padding: 2px 6px;
  border-radius: var(--radius-xs);
  cursor: pointer;
  transition: all var(--anim-speed-fast) ease;
  white-space: nowrap;
  font-family: inherit;
}

.status-pill-btn:hover {
  border-color: var(--border-active);
  color: var(--text-main);
}

.status-pill-btn.active {
  background: var(--bg-selected);
  border-color: var(--accent);
  color: var(--accent-light);
  font-weight: 600;
}

.empty-state {
  text-align: center;
  padding: 16px 8px;
  line-height: 1.5;
}

.kbd-hint {
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  padding: 1px 4px;
  border-radius: 3px;
  font-family: inherit;
  color: var(--accent-light);
}

.promises-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.promise-card {
  background: var(--bg-panel);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  box-shadow: var(--shadow-sm);
  transition: border-color var(--anim-speed-fast) ease;
  position: relative;
}

.promise-card.status-planted {
  border-left: 3px solid var(--warning, #f59e0b);
}

.promise-card.status-developed {
  border-left: 3px solid var(--info, #3b82f6);
}

.promise-card.status-resolved {
  border-left: 3px solid var(--success, #10b981);
  opacity: 0.92;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.kind-icon {
  font-size: 15px;
}

.kind-label {
  font-size: 12px;
  color: var(--text-main);
}

.btn-delete {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 11px;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: var(--radius-xs);
  transition: all var(--anim-speed-fast) ease;
}

.btn-delete:hover {
  background: rgba(239, 68, 68, 0.2);
  color: var(--error, #ef4444);
}

.promise-timeline {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-xs);
  padding: 8px;
}

.timeline-step {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.step-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
}

.step-icon {
  font-size: 12px;
}

.step-name {
  font-weight: 600;
  color: var(--text-main);
}

.step-location {
  color: var(--text-muted);
  font-size: 10px;
}

.step-connector {
  color: var(--text-muted);
  font-family: monospace;
}

.badge-current-chapter {
  background: rgba(16, 185, 129, 0.15);
  color: var(--success, #10b981);
  font-size: 9px;
  padding: 1px 4px;
  border-radius: 3px;
  font-weight: 600;
}

.btn-delete-step {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 10px;
  cursor: pointer;
  margin-left: auto;
  padding: 0 4px;
}
.btn-delete-step:hover {
  color: var(--error, #ef4444);
}

.card-quote {
  margin: 0;
  padding: 4px 8px;
  font-size: 11px;
  font-style: italic;
  color: var(--text-main);
  background: var(--bg-card);
  border-left: 2px solid var(--accent);
  border-radius: 0 var(--radius-xs) var(--radius-xs) 0;
  line-height: 1.4;
  word-break: break-word;
}

.quote-small {
  font-size: 10.5px;
  border-left-color: var(--info, #3b82f6);
}

.quote-resolution {
  border-left-color: var(--success, #10b981);
  background: rgba(16, 185, 129, 0.05);
}

.step-actions {
  display: flex;
}

.btn-locate-step {
  background: none;
  border: none;
  color: var(--accent-light);
  font-size: 10px;
  font-weight: 500;
  cursor: pointer;
  padding: 1px 4px;
  border-radius: var(--radius-xs);
  transition: all var(--anim-speed-fast) ease;
}

.btn-locate-step:hover {
  background: var(--bg-hover);
  text-decoration: underline;
}

.timeline-group-progressions {
  display: flex;
  flex-direction: column;
  gap: 6px;
  border-top: 1px dashed var(--border-color);
  padding-top: 6px;
}

.group-header {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  font-weight: 600;
  color: var(--warning, #f59e0b);
}

.step-resolution {
  border-top: 1px solid var(--border-color);
  padding-top: 6px;
}

.card-quick-actions {
  display: flex;
  gap: 6px;
}

.btn-quick {
  flex: 1;
  font-size: 10px;
  font-weight: 600;
  padding: 3px 6px;
  border-radius: var(--radius-xs);
  border: 1px solid transparent;
  cursor: pointer;
  transition: all var(--anim-speed-fast) ease;
  font-family: inherit;
}

.btn-quick-progress {
  background: rgba(245, 158, 11, 0.15);
  color: var(--warning, #f59e0b);
  border-color: rgba(245, 158, 11, 0.3);
}
.btn-quick-progress:hover {
  background: var(--warning, #f59e0b);
  color: #000;
}

.btn-quick-resolve {
  background: rgba(16, 185, 129, 0.15);
  color: var(--success, #10b981);
  border-color: rgba(16, 185, 129, 0.3);
}
.btn-quick-resolve:hover {
  background: var(--success, #10b981);
  color: #fff;
}

.card-note-section {
  display: flex;
  flex-direction: column;
}

.note-display {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  background: var(--bg-hover);
  padding: 4px 6px;
  border-radius: var(--radius-xs);
  cursor: pointer;
  font-size: 10.5px;
  color: var(--text-muted);
}

.note-display:hover {
  color: var(--text-main);
}

.btn-add-note {
  background: none;
  border: 1px dashed var(--border-color);
  color: var(--text-muted);
  font-size: 10px;
  padding: 2px 6px;
  border-radius: var(--radius-xs);
  cursor: pointer;
  text-align: left;
  transition: all var(--anim-speed-fast) ease;
  font-family: inherit;
}

.btn-add-note:hover {
  border-color: var(--border-active);
  color: var(--text-main);
}

.note-edit-box {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.note-textarea {
  width: 100%;
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-xs);
  padding: 4px;
  font-size: 11px;
  color: var(--text-main);
  font-family: inherit;
  resize: vertical;
}

.note-actions {
  display: flex;
  gap: 4px;
}

.btn-xs {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: var(--radius-xs);
  border: none;
  cursor: pointer;
  font-family: inherit;
}

.btn-primary {
  background: var(--accent);
  color: #fff;
}

.btn-ghost {
  background: none;
  color: var(--text-muted);
}

.card-status-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 4px;
  border-top: 1px solid var(--border-color);
}

.status-options {
  display: flex;
  gap: 8px;
  width: 100%;
  justify-content: space-between;
}

.status-radio-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: var(--text-muted);
  cursor: pointer;
  user-select: none;
}

.status-radio-label input[type="radio"] {
  display: none;
}

.radio-custom {
  width: 10px;
  height: 10px;
  border: 1px solid var(--border-color);
  border-radius: 50%;
  display: inline-block;
  position: relative;
  transition: all var(--anim-speed-fast) ease;
}

.status-radio-label.active {
  color: var(--text-main);
  font-weight: 500;
}

.status-radio-label.active .radio-custom {
  border-color: var(--accent);
  background: var(--accent);
  box-shadow: 0 0 4px var(--accent-glow);
}
</style>
