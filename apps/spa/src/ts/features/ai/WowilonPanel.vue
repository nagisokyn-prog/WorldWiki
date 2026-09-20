<template>
  <div class="wowilon-panel" :class="{ 'is-open': isOpen }" :style="{ '--panel-w': panelWidth + 'px' }">
    <div class="wowilon-resize-handle" @mousedown.prevent="startResize"></div>
    
    <!-- SETTINGS VIEW -->
    <AiSettingsView 
      v-if="isSettingsOpen" 
      @close="isSettingsOpen = false" 
    />
    
    <!-- MAIN CHAT VIEW -->
    <AiMainChatView
      v-else
      :panel="panel"
      @open-settings="isSettingsOpen = true"
    />

    <!-- Всплывающий тулбар при выделении текста в сообщениях -->
    <AiSelectionToolbar
      @ask-wowilon="handleAskWoWiLon"
      @add-to-lore="handleAddToLore"
    />

    <!-- MANUAL TOOL INSPECTOR -->
    <AiToolInspector
      :is-open="isToolInspectorOpen"
      :current-project="currentProject"
      @close="isToolInspectorOpen = false"
      @insert-context="handleInsertContext"
    />
  </div>
</template>

<script setup lang="ts">
import {
  AiMainChatView,
  AiToolInspector,
  AiSelectionToolbar
} from './components';
import AiSettingsView from './settings/AiSettingsView.vue';
import { useWowilonPanel, type WowilonPanelProps, type WowilonPanelEmits } from './useWowilonPanel';

const props = defineProps<WowilonPanelProps>();
const emit = defineEmits<WowilonPanelEmits>();

const panel = useWowilonPanel(props, emit);

const {
  panelWidth,
  isSettingsOpen,
  isToolInspectorOpen,
  currentProject,
  startResize,
  handleAskWoWiLon,
  handleAddToLore,
  handleInsertContext
} = panel;
</script>
