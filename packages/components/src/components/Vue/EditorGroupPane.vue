<template>
  <!-- Одна колонка редактора (группа) -->
  <div
    class="editor-group-pane"
    :class="{ 'is-active': isActive }"
    @mousedown.capture="handleFocus"
  >
    <!-- Tab bar для этой группы -->
    <EditorTabBar
      :group-id="group.id"
      :tabs="group.tabs"
      :active-tab-id="group.activeTabId"
      :is-active-group="isActive"
      :can-close="canClose"
      @activate="id => handleActivateTab(id)"
      @close="id => handleCloseTab(id)"
      @split="handleSplit"
      @close-group="handleCloseGroup"
      @move-tab="handleMoveTab"
      @reorder-tab="handleReorderTab"
    />

    <!-- Content area -->
    <div class="editor-group-content">
      <!-- Sandbox -->
      <div v-if="isSandbox" class="pane-slot-container">
        <slot name="sandbox" />
      </div>

      <!-- Chapter editor -->
      <div
        v-else-if="activeTab?.tabType === 'chapter'"
        class="pane-slot-container"
      >
        <slot name="chapter" :tab="activeTab" :group-id="group.id" />
      </div>

      <!-- Entity editor -->
      <div
        v-else-if="activeTab?.tabType === 'entity'"
        class="pane-slot-column"
      >
        <slot name="entity" :tab="activeTab" :group-id="group.id" />
      </div>

      <!-- Schema editor -->
      <div
        v-else-if="activeTab?.tabType === 'schema-editor'"
        class="pane-slot-column"
      >
        <slot name="schema-editor" :tab="activeTab" :group-id="group.id" />
      </div>

      <!-- Empty state -->
      <div v-else class="editor-group-empty">
        <div class="empty-icon">📋</div>
        <div class="empty-primary-text">{{ t('common.dropTabOrOpenElement') }}</div>
        <div class="empty-sub-text">{{ t('common.splitPaneHint') }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import EditorTabBar from './EditorTabBar.vue';
import type { EditorGroupPaneProps, EditorGroupPaneEmits } from './EditorGroupPane.model';
import { useEditorGroupPane } from './useEditorGroupPane';

const props = defineProps<EditorGroupPaneProps>();
const emit = defineEmits<EditorGroupPaneEmits>();

const {
  t,
  activeTab,
  handleFocus,
  handleActivateTab,
  handleCloseTab,
  handleSplit,
  handleCloseGroup,
  handleMoveTab,
  handleReorderTab
} = useEditorGroupPane(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/components/EditorGroupPane.css"></style>
