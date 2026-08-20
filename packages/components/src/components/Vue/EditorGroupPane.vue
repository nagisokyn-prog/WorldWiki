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
      <div v-if="isSandbox" style="flex:1; display:flex; overflow:hidden;">
        <slot name="sandbox" />
      </div>

      <!-- Chapter editor -->
      <div
        v-else-if="activeTab?.tabType === 'chapter'"
        style="flex:1; display:flex; overflow:hidden;"
      >
        <slot name="chapter" :tab="activeTab" :group-id="group.id" />
      </div>

      <!-- Entity editor -->
      <div
        v-else-if="activeTab?.tabType === 'entity'"
        style="display:flex; flex-direction:column; flex:1; min-height:0;"
      >
        <slot name="entity" :tab="activeTab" :group-id="group.id" />
      </div>

      <!-- Schema editor -->
      <div
        v-else-if="activeTab?.tabType === 'schema-editor'"
        style="display:flex; flex-direction:column; flex:1; min-height:0;"
      >
        <slot name="schema-editor" :tab="activeTab" :group-id="group.id" />
      </div>

      <!-- Empty state -->
      <div v-else class="editor-group-empty">
        <div style="font-size:40px; opacity:0.15;">📋</div>
        <div style="font-size:13px; margin-top:8px; opacity:0.4;">{{ t('common.dropTabOrOpenElement') }}</div>
        <div style="font-size:11px; margin-top:4px; opacity:0.25;">{{ t('common.splitPaneHint') }}</div>
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
