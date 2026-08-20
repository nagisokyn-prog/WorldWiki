<template>
  <div
    class="editor-tab-bar"
    :class="{ 'is-active-group': isActiveGroup && tabs.length > 0 }"
    @dragover.prevent="onBarDragOver"
    @drop.prevent="onBarDrop"
  >
    <!-- Tabs -->
    <div
      v-for="(tab, idx) in tabs"
      :key="tab.id"
      class="editor-tab"
      :class="{
        active: tab.id === activeTabId,
        'drag-over': dragOverIdx === idx,
        'drag-source': draggingTabId === tab.id,
      }"
      draggable="true"
      @click="$emit('activate', tab.id)"
      @dragstart="onDragStart($event, tab.id, idx)"
      @dragend="onDragEnd"
      @dragover.prevent="onTabDragOver($event, idx)"
      @dragleave="onTabDragLeave(idx)"
      @drop.prevent="onTabDrop($event, idx)"
    >
      <span class="tab-icon">{{ tab.tabType === 'chapter' ? '📖' : '🗂️' }}</span>
      <span class="tab-title">{{ tab.title }}</span>
      <span v-if="tab.unsaved" class="tab-dot">●</span>
      <button class="tab-close" tabindex="-1" @click.stop="$emit('close', tab.id)">×</button>

      <!-- Drop indicator line -->
      <div v-if="dragOverIdx === idx && dropSide === 'left'"  class="tab-drop-line tab-drop-line--left" />
      <div v-if="dragOverIdx === idx && dropSide === 'right'" class="tab-drop-line tab-drop-line--right" />
    </div>

    <!-- "Drop here" zone when bar is empty -->
    <div
      v-if="tabs.length === 0"
      class="tab-bar-empty-drop"
      @dragover.prevent="onBarDragOver"
      @drop.prevent="onBarDrop"
    >
      {{ t('common.dragTabHere') }}
    </div>

    <!-- Spacer -->
    <div class="tab-bar-spacer" @dragover.prevent="onBarDragOver" @drop.prevent="onBarDrop" />

    <!-- Split button -->
    <button
      class="tab-bar-action"
      :title="t('common.splitPane')"
      @click="$emit('split')"
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <rect x="1" y="1" width="5" height="12" rx="1" stroke="currentColor" stroke-width="1.3"/>
        <rect x="8" y="1" width="5" height="12" rx="1" stroke="currentColor" stroke-width="1.3"/>
      </svg>
    </button>

    <!-- Close group button (only if > 1 group) -->
    <button
      v-if="canClose"
      class="tab-bar-action tab-bar-close-group"
      :title="t('common.closePane')"
      @click="$emit('close-group')"
    >×</button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

interface EditorTab {
  id: string;
  rawId: string;
  title: string;
  entityType: string;
  tabType: 'entity' | 'chapter' | 'schema-editor';
  data: Record<string, unknown>;
  unsaved: boolean;
}

const props = defineProps<{
  groupId: string;
  tabs: EditorTab[];
  activeTabId: string | null;
  isActiveGroup: boolean;
  canClose: boolean;
}>();

const emit = defineEmits<{
  activate: [tabId: string];
  close: [tabId: string];
  split: [];
  'close-group': [];
  'move-tab': [payload: { tabId: string; fromGroupId: string; toGroupId: string; toIndex: number }];
  'reorder-tab': [payload: { groupId: string; fromIdx: number; toIdx: number }];
}>();

const { t } = useI18n();

// ─── Drag state ────────────────────────────────────────────────────────────
const DRAG_TAB_KEY = 'ww-drag-tab-id';
const DRAG_GROUP_KEY = 'ww-drag-group-id';

const draggingTabId = ref<string | null>(null);
const dragOverIdx = ref<number | null>(null);
const dropSide = ref<'left' | 'right'>('right');

const onDragStart = (e: DragEvent, tabId: string, _idx: number) => {
  draggingTabId.value = tabId;
  e.dataTransfer!.effectAllowed = 'move';
  e.dataTransfer!.setData(DRAG_TAB_KEY, tabId);
  e.dataTransfer!.setData(DRAG_GROUP_KEY, props.groupId);
};

const onDragEnd = () => {
  draggingTabId.value = null;
  dragOverIdx.value = null;
};

const getDropIndex = (e: DragEvent, idx: number): { idx: number; side: 'left' | 'right' } => {
  const el = (e.currentTarget as HTMLElement);
  const rect = el.getBoundingClientRect();
  const mid = rect.left + rect.width / 2;
  if (e.clientX < mid) return { idx, side: 'left' };
  return { idx, side: 'right' };
};

const onTabDragOver = (e: DragEvent, idx: number) => {
  const { idx: di, side } = getDropIndex(e, idx);
  dragOverIdx.value = di;
  dropSide.value = side;
  e.dataTransfer!.dropEffect = 'move';
};

const onTabDragLeave = (idx: number) => {
  if (dragOverIdx.value === idx) dragOverIdx.value = null;
};

const onTabDrop = (e: DragEvent, idx: number) => {
  const tabId = e.dataTransfer!.getData(DRAG_TAB_KEY);
  const fromGroupId = e.dataTransfer!.getData(DRAG_GROUP_KEY);
  if (!tabId) return;

  const { idx: di, side } = getDropIndex(e, idx);
  const toIndex = side === 'right' ? di + 1 : di;

  if (fromGroupId === props.groupId) {
    // Reorder within same group
    const fromIdx = props.tabs.findIndex(t => t.id === tabId);
    if (fromIdx >= 0 && fromIdx !== toIndex) {
      emit('reorder-tab', { groupId: props.groupId, fromIdx, toIdx: toIndex });
    }
  } else {
    // Move between groups
    emit('move-tab', { tabId, fromGroupId, toGroupId: props.groupId, toIndex });
  }

  dragOverIdx.value = null;
  draggingTabId.value = null;
};

const onBarDragOver = (e: DragEvent) => {
  e.dataTransfer!.dropEffect = 'move';
};

const onBarDrop = (e: DragEvent) => {
  const tabId = e.dataTransfer!.getData(DRAG_TAB_KEY);
  const fromGroupId = e.dataTransfer!.getData(DRAG_GROUP_KEY);
  if (!tabId) return;

  if (fromGroupId !== props.groupId) {
    // Drop to end of this group
    emit('move-tab', { tabId, fromGroupId, toGroupId: props.groupId, toIndex: props.tabs.length });
  }
  dragOverIdx.value = null;
};
</script>

<style scoped src="@worldwiki/resources/styles/components/EditorTabBar.css"></style>
