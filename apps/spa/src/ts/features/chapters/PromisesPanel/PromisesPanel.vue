<template>
  <div class="tool-section promises-section">
    <div class="section-header" @click="isCollapsed = !isCollapsed">
      <div class="flex items-center gap-2">
        <span class="collapse-icon">{{ isCollapsed ? '▶' : '▼' }}</span>
        <span class="font-bold text-sm">🎯 Сюжетные обещания</span>
        <span v-if="chapterPromises.length > 0" class="badge badge-subtle">
          {{ chapterPromises.length }}
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
      <div v-if="loading" class="text-xs text-muted p-2 text-center">
        Загрузка обещаний...
      </div>

      <div v-else-if="chapterPromises.length === 0" class="empty-state">
        <div class="text-xs text-muted">
          Выделите текст в редакторе и нажмите <kbd class="kbd-hint">ПКМ</kbd>, чтобы создать чеховское ружьё или тайну.
        </div>
      </div>

      <div v-else class="promises-list">
        <div 
          v-for="item in chapterPromises" 
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

          <div class="card-location">
            {{ chapterTitle ? `${chapterTitle} · ` : '' }}абзац {{ item.paragraph_index }}
          </div>

          <!-- Цитата -->
          <blockquote class="card-quote">
            «{{ item.quote }}»
          </blockquote>

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
              + Добавить заметку
            </button>
          </div>

          <!-- Статус -->
          <div class="card-status-section">
            <div class="status-title">Статус</div>
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

          <!-- Кнопка перехода к источнику -->
          <button class="btn-locate" @click="locateSource(item)">
            📍 Открыть источник
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { usePromisesPanel, PROMISE_STATUSES } from './usePromisesPanel';

const props = defineProps<{
  project: string;
  chapterId?: string | null;
  chapterTitle?: string | null;
  currentVolumeId?: string | null;
  currentArcId?: string | null;
}>();

const emit = defineEmits<{
  (e: 'locate', payload: { paragraphIndex: number; quote: string; blockId?: string }): void;
  (e: 'change'): void;
}>();

const isCollapsed = ref(false);

const {
  chapterPromises,
  loading,
  editingNoteId,
  noteDraft,
  loadPromises,
  addPromise,
  updateStatus,
  startEditNote,
  saveNote,
  cancelEditNote,
  removePromise,
  locateSource,
  getKindInfo
} = usePromisesPanel(props, emit);

defineExpose({
  addPromise,
  loadPromises
});
</script>

<style scoped>
.promises-section {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  overflow: hidden;
  margin-bottom: 12px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  cursor: pointer;
  user-select: none;
  background: rgba(255, 255, 255, 0.02);
  transition: background var(--anim-speed, 0.2s) ease;
}

.section-header:hover {
  background: var(--bg-hover);
}

.collapse-icon {
  font-size: var(--font-size-xs, 11px);
  color: var(--text-muted);
}

.badge-subtle {
  font-size: var(--font-size-xs, 11px);
  padding: 1px 6px;
  background: var(--bg-selected);
  color: var(--accent-light);
  border-radius: var(--radius-round, 9999px);
}

.btn-icon-subtle {
  background: none;
  border: none;
  cursor: pointer;
  opacity: 0.6;
  padding: 2px 4px;
  border-radius: var(--radius-xs, 4px);
  color: var(--text-main);
  transition: opacity var(--anim-speed, 0.2s) ease;
}
.btn-icon-subtle:hover {
  opacity: 1;
  background: var(--bg-hover);
}

.section-content {
  padding: 10px;
  max-height: 320px;
  overflow-y: auto;
  overflow-x: hidden;
}

.section-content::-webkit-scrollbar {
  width: 5px;
}

.section-content::-webkit-scrollbar-track {
  background: transparent;
}

.section-content::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: var(--radius-round, 9999px);
}

.section-content::-webkit-scrollbar-thumb:hover {
  background: var(--border-hover, rgba(255, 255, 255, 0.2));
}

.empty-state {
  padding: 12px 8px;
  text-align: center;
}

.kbd-hint {
  background: var(--bg-hover);
  padding: 1px 4px;
  border-radius: var(--radius-xs, 4px);
  font-size: var(--font-size-xs, 11px);
  border: 1px solid var(--border-color);
  color: var(--text-muted);
}

.promises-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.promise-card {
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  border-left: 3px solid var(--accent);
  border-radius: var(--radius-xs, 6px);
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: border-color var(--anim-speed, 0.2s) ease;
}

.promise-card.status-planted {
  border-left-color: var(--success, #10b981);
}
.promise-card.status-developed {
  border-left-color: var(--warning, #f59e0b);
}
.promise-card.status-resolved {
  border-left-color: var(--text-disabled, rgba(255, 255, 255, 0.35));
  opacity: 0.85;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.kind-icon {
  font-size: 1rem;
}

.kind-label {
  font-size: var(--font-size-sm, 13px);
  color: var(--text-main);
}

.btn-delete {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: var(--font-size-xs, 11px);
  cursor: pointer;
  padding: 2px 5px;
  border-radius: var(--radius-xs, 4px);
  transition: all var(--anim-speed, 0.2s) ease;
}
.btn-delete:hover {
  color: var(--error, #ef4444);
  background: rgba(239, 68, 68, 0.15);
}

.card-location {
  font-size: var(--font-size-xs, 11px);
  color: var(--text-muted);
}

.card-quote {
  margin: 0;
  padding: 6px 8px;
  background: rgba(0, 0, 0, 0.25);
  border-radius: var(--radius-xs, 4px);
  font-style: italic;
  font-size: var(--font-size-sm, 13px);
  color: var(--text-main);
  line-height: 1.4;
  border-left: 2px solid var(--border-hover, rgba(255, 255, 255, 0.2));
}

.card-note-section {
  display: flex;
  flex-direction: column;
}

.btn-add-note {
  background: none;
  border: 1px dashed var(--border-color);
  color: var(--text-muted);
  font-size: var(--font-size-xs, 11px);
  padding: 4px 8px;
  border-radius: var(--radius-xs, 4px);
  cursor: pointer;
  text-align: left;
  transition: all var(--anim-speed, 0.2s) ease;
}
.btn-add-note:hover {
  border-color: var(--accent);
  color: var(--text-main);
  background: var(--bg-hover);
}

.note-display {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 4px 6px;
  background: var(--bg-hover);
  border-radius: var(--radius-xs, 4px);
  cursor: pointer;
  font-size: var(--font-size-xs, 12px);
  color: var(--text-muted);
  transition: background var(--anim-speed, 0.2s) ease;
}
.note-display:hover {
  background: var(--bg-active);
  color: var(--text-main);
}

.note-edit-box {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.note-textarea {
  width: 100%;
  box-sizing: border-box;
  background: var(--bg-base);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-xs, 4px);
  color: var(--text-main);
  padding: 6px;
  font-size: var(--font-size-xs, 12px);
  font-family: inherit;
  resize: vertical;
}
.note-textarea:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-glow);
  outline: none;
}

.note-actions {
  display: flex;
  gap: 6px;
  justify-content: flex-end;
}

.btn-xs {
  font-size: var(--font-size-xs, 11px);
  padding: 2px 8px;
  border-radius: var(--radius-xs, 4px);
  cursor: pointer;
  border: none;
  font-family: inherit;
  transition: background var(--anim-speed, 0.2s) ease;
}
.btn-primary {
  background: var(--accent);
  color: #fff;
}
.btn-primary:hover {
  background: var(--accent-hover);
}
.btn-ghost {
  background: none;
  color: var(--text-muted);
}
.btn-ghost:hover {
  background: var(--bg-hover);
  color: var(--text-main);
}

.card-status-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.status-title {
  font-size: var(--font-size-xs, 11px);
  font-weight: var(--font-weight-bold, 600);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
}

.status-options {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.status-radio-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--font-size-xs, 12px);
  cursor: pointer;
  color: var(--text-muted);
  user-select: none;
  transition: color var(--anim-speed, 0.2s) ease;
}
.status-radio-label:hover {
  color: var(--text-main);
}
.status-radio-label.active {
  color: var(--text-main);
  font-weight: var(--font-weight-medium, 500);
}

.status-radio-label input {
  cursor: pointer;
  accent-color: var(--accent);
}

.btn-locate {
  background: var(--bg-selected);
  border: 1px solid var(--border-active);
  color: var(--accent-light);
  font-size: var(--font-size-xs, 12px);
  font-weight: var(--font-weight-medium, 500);
  padding: 5px 8px;
  border-radius: var(--radius-xs, 4px);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  transition: all var(--anim-speed, 0.2s) ease;
}
.btn-locate:hover {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
  box-shadow: 0 0 10px var(--accent-glow);
}
</style>
