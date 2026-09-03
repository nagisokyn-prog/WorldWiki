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
import { 
  useEditorTabBar, 
  type EditorTabBarProps, 
  type EditorTabBarEmits, 
  type EditorTab 
} from './useEditorTabBar';

export type { EditorTab };

const props = defineProps<EditorTabBarProps>();
const emit = defineEmits<EditorTabBarEmits>();

const {
  t,
  draggingTabId,
  dragOverIdx,
  dropSide,
  onDragStart,
  onDragEnd,
  onTabDragOver,
  onTabDragLeave,
  onTabDrop,
  onBarDragOver,
  onBarDrop
} = useEditorTabBar(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/components/EditorTabBar.css"></style>
