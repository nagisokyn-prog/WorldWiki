<template>
  <!-- Одна колонка редактора (группа) -->
  <div
    class="editor-group-pane"
    :class="{ 'is-active': isActive }"
    @mousedown.capture="$emit('focus')"
  >
    <!-- Tab bar для этой группы -->
    <EditorTabBar
      :group-id="group.id"
      :tabs="group.tabs"
      :active-tab-id="group.activeTabId"
      :is-active-group="isActive"
      :can-close="canClose"
      @activate="id => $emit('activate-tab', group.id, id)"
      @close="id => $emit('close-tab', group.id, id)"
      @split="$emit('split', group.id)"
      @close-group="$emit('close-group', group.id)"
      @move-tab="$emit('move-tab', $event)"
      @reorder-tab="$emit('reorder-tab', $event)"
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
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import EditorTabBar from './EditorTabBar.vue';

interface EditorTab {
  id: string;
  rawId: string;
  title: string;
  entityType: string;
  tabType: 'entity' | 'chapter' | 'schema-editor';
  data: Record<string, unknown>;
  unsaved: boolean;
  scrollPos?: number;
  activeSection?: string;
}

interface EditorGroup {
  id: string;
  tabs: EditorTab[];
  activeTabId: string | null;
  flexBasis: number;
}

const props = defineProps<{
  group: EditorGroup;
  isActive: boolean;
  canClose: boolean;
  isSandbox?: boolean;
}>();

defineEmits<{
  focus: [];
  'activate-tab': [groupId: string, tabId: string];
  'close-tab': [groupId: string, tabId: string];
  split: [groupId: string];
  'close-group': [groupId: string];
  'move-tab': [payload: { tabId: string; toGroupId: string; toIndex: number }];
  'reorder-tab': [payload: { groupId: string; fromIdx: number; toIdx: number }];
}>();

const { t } = useI18n();

const activeTab = computed(() =>
  props.group.tabs.find(t => t.id === props.group.activeTabId) ?? null
);
</script>

<style scoped src="@worldwiki/resources/styles/components/EditorGroupPane.css"></style>
