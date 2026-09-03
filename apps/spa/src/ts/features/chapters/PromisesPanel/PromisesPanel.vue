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
import { usePromisesPanel, PROMISE_STATUSES, type ChapterMetaItem, type PromisesPanelProps } from './usePromisesPanel';

export type { ChapterMetaItem };

const props = defineProps<PromisesPanelProps>();

const emit = defineEmits<{
  (e: 'locate', payload: { chapterId: string; paragraphIndex: number; quote: string; blockId?: string }): void;
  (e: 'change'): void;
}>();

const {
  isCollapsed,
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
  isCurrentChapterPromise,
  promptAttachMilestone
} = usePromisesPanel(props, emit);

defineExpose({
  promises,
  addPromise,
  addMilestone,
  loadPromises
});
</script>

<style scoped src="@worldwiki/resources/styles/features/chapters/PromisesPanel.css"></style>

