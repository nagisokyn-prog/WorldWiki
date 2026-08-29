<template>
  <div class="workspace-root">
    <aside v-if="sidebarVisible" class="workspace-sidebar" :style="{ '--sidebar-w': sidebarWidth + 'px' }">
      <slot name="explorer" />
    </aside>

    <div v-if="sidebarVisible" class="resize-handle resize-handle--sidebar" @mousedown="startSidebarResize" />

    <div class="workspace-editor-area">
      <div
        v-for="(group, gIdx) in groups"
        :key="group.id"
        class="workspace-group"
        :class="{ 'workspace-group--active': group.id === activeGroupId }"
        :style="{ '--group-flex': group.flexBasis }"
        @click.capture="setActiveGroup(group.id)"
      >
        <div class="workspace-tabbar">
          <div
            v-for="tab in group.tabs"
            :key="tab.id"
            class="workspace-tab"
            :class="{ 'workspace-tab--active': tab.id === group.activeTabId, 'workspace-tab--unsaved': tab.unsaved }"
            @click.stop="activateTab(group.id, tab.id)"
          >
            <span class="workspace-tab__title">{{ tab.title }}</span>
            <span v-if="tab.unsaved" class="workspace-tab__dot" title="Unsaved changes" />
            <button class="workspace-tab__close" @click.stop="closeTab(tab.id)">×</button>
          </div>

          <div class="workspace-tabbar__spacer" />

          <button v-if="groups.length > 1" class="workspace-btn" title="Close pane" @click="closeGroup(group.id)">⊠</button>
          <button class="workspace-btn" title="Split right (Ctrl+\)" @click="splitGroup(group.id)">⊞</button>
        </div>

        <div class="workspace-content">
          <template v-if="activeTab(group.id)">
            <slot name="tab-content" :tab="activeTab(group.id)" :group-index="gIdx" />
          </template>
          <div v-else class="workspace-empty">
            <div class="workspace-empty__icon">⬡</div>
            <p>No tab open</p>
            <small>Open something from the explorer</small>
          </div>
        </div>
      </div>

      <div
        v-for="gIdx in groups.length - 1"
        :key="'r' + gIdx"
        class="resize-handle resize-handle--group"
        @mousedown="startGroupResize(gIdx - 1)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useEditorGroups } from '../../ts/composables/useEditorGroups';

const {
  groups,
  activeGroupId,
  setActiveGroup,
  openTab,
  closeTab,
  activateTab,
  splitRight,
  closeGroup,
} = useEditorGroups();

const props = withDefaults(defineProps<{
  defaultSidebarWidth?: number;
  sidebarVisible?: boolean;
}>(), {
  defaultSidebarWidth: 260,
  sidebarVisible: true,
});

const sidebarWidth = ref(props.defaultSidebarWidth);

function activeTab(groupId: string) {
  const g = groups.value.find(item => item.id === groupId);
  return g?.tabs.find(t => t.id === g.activeTabId) || null;
}

function splitGroup(groupId: string) {
  splitRight(groupId);
}

function onKeydown(e: KeyboardEvent) {
  if (e.ctrlKey && e.key === '\\') {
    e.preventDefault();
    splitGroup(activeGroupId.value);
  }
}
onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => window.removeEventListener('keydown', onKeydown));

function startSidebarResize(e: MouseEvent) {
  e.preventDefault();
  const startX = e.clientX;
  const startW = sidebarWidth.value;
  const onMove = (ev: MouseEvent) => {
    sidebarWidth.value = Math.max(140, Math.min(600, startW + ev.clientX - startX));
  };
  const onUp = () => {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
  };
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
}

function startGroupResize(gIdx: number) {
  const onMove = (ev: MouseEvent) => {
    const left = groups.value[gIdx];
    const right = groups.value[gIdx + 1];
    if (!left || !right) return;
    left.flexBasis = Math.max(0.1, (left.flexBasis || 1) + ev.movementX / 400);
    right.flexBasis = Math.max(0.1, (right.flexBasis || 1) - ev.movementX / 400);
  };
  const onUp = () => {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
  };
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
}

defineExpose({ openTab, closeTab, groups });
</script>

<style scoped src="@worldwiki/resources/styles/components/WorkspaceLayout.css"></style>