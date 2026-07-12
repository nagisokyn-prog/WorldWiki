<template>
  <!--
    WorkspaceLayout.vue — VS Code-style multi-pane editor layout.

    Usage:
      <WorkspaceLayout>
        <template #explorer>
          <MyProjectTree />
        </template>
        <template #tab-content="{ tab }">
          <MyEntityEditor v-if="tab.tabType === 'entity'" :tab="tab" />
        </template>
      </WorkspaceLayout>
  -->
  <div class="workspace-root">
    <!-- Left Sidebar (Explorer) -->
    <aside v-if="sidebarVisible" class="workspace-sidebar" :style="{ width: sidebarWidth + 'px' }">
      <slot name="explorer" />
    </aside>

    <!-- Sidebar resize handle -->
    <div v-if="sidebarVisible" class="resize-handle resize-handle--sidebar" @mousedown="startSidebarResize" />

    <!-- Editor Groups (split panes) -->
    <div class="workspace-editor-area">
      <div
        v-for="(group, gIdx) in groups"
        :key="group.id"
        class="workspace-group"
        :class="{ 'workspace-group--active': gIdx === activeGroupIndex }"
        :style="{ flex: group.flex }"
        @click.capture="setActiveGroup(gIdx)"
      >
        <!-- Tab Bar -->
        <div class="workspace-tabbar">
          <div
            v-for="tab in group.tabs"
            :key="tab.id"
            class="workspace-tab"
            :class="{ 'workspace-tab--active': tab.id === group.activeTabId, 'workspace-tab--unsaved': tab.unsaved }"
            @click.stop="activateTab(gIdx, tab.id)"
          >
            <span class="workspace-tab__title">{{ tab.title }}</span>
            <span v-if="tab.unsaved" class="workspace-tab__dot" title="Unsaved changes" />
            <button class="workspace-tab__close" @click.stop="closeTab(gIdx, tab.id)">×</button>
          </div>

          <div class="workspace-tabbar__spacer" />

          <button v-if="groups.length > 1" class="workspace-btn" title="Close pane" @click="closeGroup(gIdx)">⊠</button>
          <button class="workspace-btn" title="Split right (Ctrl+\)" @click="splitGroup(gIdx)">⊞</button>
        </div>

        <!-- Active Tab Content -->
        <div class="workspace-content">
          <template v-if="activeTab(gIdx)">
            <slot name="tab-content" :tab="activeTab(gIdx)" :group-index="gIdx" />
          </template>
          <div v-else class="workspace-empty">
            <div class="workspace-empty__icon">⬡</div>
            <p>No tab open</p>
            <small>Open something from the explorer</small>
          </div>
        </div>
      </div>

      <!-- Group resize handles -->
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
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useEditorGroups } from '../../js/composables/useEditorGroups';

const {
  groups,
  activeGroupIndex,
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

// ── Helpers ────────────────────────────────────────────────────────────────
function activeTab(gIdx: number) {
  const g = groups[gIdx];
  return g?.tabs.find(t => t.id === g.activeTabId) || null;
}

function splitGroup(gIdx: number) {
  splitRight(gIdx);
}

// ── Keyboard shortcut: Ctrl+\ ──────────────────────────────────────────────
function onKeydown(e: KeyboardEvent) {
  if (e.ctrlKey && e.key === '\\') {
    e.preventDefault();
    splitGroup(activeGroupIndex.value);
  }
}
onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => window.removeEventListener('keydown', onKeydown));

// ── Sidebar resize ─────────────────────────────────────────────────────────
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

// ── Group resize ───────────────────────────────────────────────────────────
function startGroupResize(gIdx: number) {
  const onMove = (ev: MouseEvent) => {
    // simple delta-based flex redistribution
    const left = groups[gIdx];
    const right = groups[gIdx + 1];
    if (!left || !right) return;
    left.flex = Math.max(0.1, (left.flex || 1) + ev.movementX / 400);
    right.flex = Math.max(0.1, (right.flex || 1) - ev.movementX / 400);
  };
  const onUp = () => {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
  };
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
}

// Expose for parent
defineExpose({ openTab, closeTab, groups, activeGroupIndex });
</script>

<style scoped>
.workspace-root {
  display: flex;
  height: 100%;
  width: 100%;
  overflow: hidden;
  background: var(--ws-bg, #0a0a0f);
  color: var(--ws-text, #e2e8f0);
}

/* ── Sidebar ── */
.workspace-sidebar {
  flex-shrink: 0;
  height: 100%;
  overflow: hidden auto;
  background: var(--ws-sidebar-bg, #111127);
  border-right: 1px solid var(--ws-border, #1e1e2e);
}

/* ── Editor Area ── */
.workspace-editor-area {
  flex: 1;
  display: flex;
  position: relative;
  overflow: hidden;
  min-width: 0;
}

.workspace-group {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
  border-right: 1px solid var(--ws-border, #1e1e2e);
}
.workspace-group:last-child { border-right: none; }
.workspace-group--active .workspace-tabbar { border-bottom-color: #8b5cf6; }

/* ── Tab bar ── */
.workspace-tabbar {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  height: 36px;
  background: var(--ws-tabbar-bg, #0d0d1a);
  border-bottom: 1px solid var(--ws-border, #1e1e2e);
  overflow: hidden;
  padding-right: 4px;
}
.workspace-tab {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 0 10px;
  height: 100%;
  font-size: 12px;
  color: #64748b;
  cursor: pointer;
  white-space: nowrap;
  border-right: 1px solid var(--ws-border, #1e1e2e);
  position: relative;
  user-select: none;
  transition: background 0.15s;
}
.workspace-tab:hover { background: #1a1a2e; color: #94a3b8; }
.workspace-tab--active { background: #0a0a0f; color: #e2e8f0; }
.workspace-tab--active::after {
  content: '';
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 2px;
  background: linear-gradient(90deg, #8b5cf6, #06b6d4);
}
.workspace-tab__dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: #f59e0b;
  flex-shrink: 0;
}
.workspace-tab__close {
  background: none; border: none; color: inherit;
  font-size: 14px; cursor: pointer; padding: 0 2px;
  opacity: 0; transition: opacity 0.1s;
  line-height: 1;
}
.workspace-tab:hover .workspace-tab__close { opacity: 1; }

.workspace-tabbar__spacer { flex: 1; }
.workspace-btn {
  background: none; border: none; color: #475569;
  font-size: 14px; cursor: pointer; padding: 0 6px; height: 100%;
  transition: color 0.1s;
}
.workspace-btn:hover { color: #e2e8f0; }

/* ── Content ── */
.workspace-content {
  flex: 1;
  overflow: hidden;
  position: relative;
}
.workspace-empty {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #334155;
}
.workspace-empty__icon { font-size: 48px; }
.workspace-empty p { font-size: 14px; }
.workspace-empty small { font-size: 12px; }

/* ── Resize handles ── */
.resize-handle {
  flex-shrink: 0;
  background: transparent;
  transition: background 0.15s;
  z-index: 10;
}
.resize-handle:hover { background: #8b5cf640; }
.resize-handle--sidebar { width: 4px; cursor: col-resize; }
.resize-handle--group {
  width: 4px; cursor: col-resize;
  position: absolute;
  top: 0; height: 100%;
}
</style>
