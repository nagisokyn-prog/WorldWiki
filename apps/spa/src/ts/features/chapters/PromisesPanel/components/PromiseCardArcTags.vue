<template>
  <div class="promise-card-arc-tags">
    <!-- Header with Section Title & Add Button -->
    <div class="meta-section-header">
      <div class="section-title-group">
        <span class="section-icon">🎭</span>
        <span class="section-title">Сюжетные арки</span>
        <span v-if="boundArcs.length" class="section-count">({{ boundArcs.length }})</span>
      </div>

      <!-- Add Arc Button / Popover trigger -->
      <div class="popover-anchor">
        <button
          type="button"
          class="btn-add-arc"
          title="Привязать сюжетную арку к сцене"
          @click="isPickerOpen = !isPickerOpen"
        >
          <span class="plus-sign">＋</span>
          <span>Привязать арку</span>
        </button>

        <!-- Solid Dropdown Popover -->
        <div
          v-if="isPickerOpen"
          class="arc-picker-popover"
          @click.stop
        >
          <div class="popover-header">
            <span class="popover-title">Сюжетные арки проекта:</span>
            <button
              type="button"
              class="popover-close-btn"
              title="Закрыть"
              @click="isPickerOpen = false"
            >
              ✕
            </button>
          </div>

          <div v-if="selectableArcs.length > 0" class="popover-list">
            <button
              v-for="a in selectableArcs"
              :key="a.id || a.title"
              type="button"
              class="popover-item"
              @click="a.id && attachArc(a.id)"
            >
              <span class="popover-item-title">⚡ {{ a.title }}</span>
              <span class="popover-item-type">{{ a.arc_type }}</span>
            </button>
          </div>
          <div v-else class="popover-empty">
            Все доступные арки уже добавлены
          </div>

          <!-- Quick Create New Arc -->
          <div class="popover-create-box">
            <input
              v-model="newArcTitle"
              type="text"
              placeholder="Новая арка..."
              class="popover-input"
              @keydown.enter.prevent="createAndAttachArc"
            />
            <button
              type="button"
              class="popover-submit-btn"
              :disabled="!newArcTitle.trim() || isCreating"
              title="Создать и привязать"
              @click="createAndAttachArc"
            >
              ✓
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 2-Column Symmetrical Arc Rows -->
    <div v-if="boundArcs.length > 0" class="arc-bindings-list">
      <div
        v-for="arc in boundArcs"
        :key="arc.arcId"
        class="arc-binding-row"
      >
        <!-- Column 1: Arc Title Plate -->
        <div
          class="arc-title-plate"
          :style="arc.color ? { borderLeft: `3px solid ${arc.color}` } : {}"
        >
          <div class="arc-info-left">
            <span class="arc-icon">⚡</span>
            <span class="arc-name" :title="arc.title">{{ arc.title }}</span>
            <span v-if="arc.arcType" class="arc-type-badge">{{ arc.arcType }}</span>
          </div>
          <button
            type="button"
            class="arc-remove-btn"
            title="Отвязать арку от сцены"
            @click.stop="detachArc(arc.arcId)"
          >
            ×
          </button>
        </div>

        <!-- Column 2: Phase Select Plate -->
        <div class="arc-phase-plate">
          <select
            :value="arc.phase"
            class="arc-phase-select"
            title="Фаза сюжетной арки"
            @change="updateArcPhase(arc.arcId, ($event.target as HTMLSelectElement).value)"
          >
            <option value="setup">🌱 Завязка</option>
            <option value="escalation">⚡ Эскалация</option>
            <option value="climax">🔥 Кульминация</option>
            <option value="resolution">✅ Развязка</option>
          </select>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { usePromiseCardArcTags } from './usePromiseCardArcTags';
import type { PromiseCardArcTagsProps, PromiseCardArcTagsEmits } from './PromiseCardArcTags.model';

const props = defineProps<PromiseCardArcTagsProps>();
const emit = defineEmits<PromiseCardArcTagsEmits>();

const {
  isPickerOpen,
  newArcTitle,
  isCreating,
  boundArcs,
  selectableArcs,
  attachArc,
  detachArc,
  updateArcPhase,
  createAndAttachArc
} = usePromiseCardArcTags(props, emit);
</script>
<style scoped src="@worldwiki/resources/styles/features/chapters/PromiseCardArcTags.css"></style>

