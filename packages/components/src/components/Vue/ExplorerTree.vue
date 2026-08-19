<template>
  <div class="explorer-tree" tabindex="0" @keydown="onTreeKeydown" @click.self="clearSelection()">
    <!-- Header -->
    <div v-if="title" class="tree-header" style="display: flex; align-items: center;">
      <button v-if="showBack" class="tree-back-btn" title="Back" @click="$emit('back')">
        <i class="fas fa-arrow-left"></i>
      </button>
      <span class="tree-title">
        <i v-if="icon" :class="icon"></i>
        {{ title }}
      </span>
      <div class="tree-header-actions" style="margin-left: auto; display: flex; gap: 4px;">
        <slot name="header-actions"></slot>
      </div>
    </div>

    <!-- Body -->
    <div class="tree-body">
      <div v-for="sect in sections" :key="sect.id" class="tree-section">
        <!-- Section Header -->
        <div class="tree-section-header" @click="toggleSection(sect.id)">
          <i :class="expandedSections.has(sect.id) ? 'fas fa-chevron-down' : 'fas fa-chevron-right'"></i>
          <span>{{ sect.title.toUpperCase() }}</span>
          <div class="section-actions">
            <i v-if="sect.canEdit" class="fas fa-trash" style="margin-right: 8px; opacity: 0.7; font-size: 10px; color: #ff5555;" title="Удалить схему" @click.stop="$emit('delete-section', sect.id)"></i>
            <i v-if="sect.canEdit" class="fas fa-pen" style="margin-right: 8px; opacity: 0.7; font-size: 10px;" title="Настроить сущности" @click.stop="$emit('edit-section', sect.id)"></i>
            <i v-if="sect.canAdd" class="fas fa-plus" title="Добавить" @click.stop="$emit('create', { sectionId: sect.id })"></i>
          </div>
        </div>

        <!-- Section Content -->
        <div v-if="expandedSections.has(sect.id)" class="tree-section-content">
          <!-- Recursive Node Template -->
          <TreeNodes
            :nodes="sect.nodes"
            :expanded="expanded"
            :active-id="activeId"
            :selected-ids="selected"
            :renaming-id="renaming?.id"
            :renaming-value="renaming?.value"
            @toggle-expand="toggleExpand"
            @click-node="(e, n) => handleNodeClick(e, n, sect.id)"
            @dblclick-node="handleNodeDblClick"
            @ctx-node="(e, n) => handleCtxMenu(e, n, sect.id)"
            @create-in="node => { console.log('EXPLORERTREE: CAUGHT create-in FOR', node); $emit('create-inline', { sectionId: sect.id, parentId: node.id }); }"
            @update:renaming-value="val => { if (renaming) renaming.value = val; }"
            @commit-rename="commitRename"
            @cancel-rename="cancelRename"
            @drag-start="handleDragStart"
            @drag-over="handleDragOver"
            @drop-node="handleDrop"
          />

          <!-- Inline creation field -->
          <div v-if="creating?.sectionId === sect.id" class="tree-item creating">
             <div class="tree-item-row">
                <span class="tree-node-icon">{{ sect.icon || '📄' }}</span>
                <input
                  v-model="creating.name"
                  v-focus
                  class="tree-rename-input"
                  @keydown.enter="commitCreate"
                  @keydown.escape="creating = null"
                  @blur="commitCreate"
                />
             </div>
          </div>

          <div v-if="!sect.nodes?.length && !creating" class="tree-empty-small">Empty</div>

          <!-- Section Add Button -->
          <div v-if="sect.canAddInline" class="tree-add-inline" @click.stop="$emit('create-inline', { sectionId: sect.id })">
            <i class="fas fa-plus"></i> <span>Add {{ sect.itemLabel || 'Item' }}</span>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="!sections.length" class="tree-empty">
        <i class="fas fa-folder-open" style="font-size: 28px; opacity: 0.2; margin-bottom: 10px;"></i>
        <div>No structure</div>
        <slot name="empty-hint"></slot>
      </div>
    </div>

    <!-- Context Menu Overlay -->
    <Teleport to="body">
      <div v-if="ctx" class="tree-ctx-overlay" @click="ctx = null"></div>
      <transition name="ctx-pop">
        <div v-if="ctx" class="tree-ctx-menu" :style="ctxStyle">
          <!-- Inject context menu items via slot, passing the active node context -->
          <slot name="context-menu" :node="ctx.node" :section-id="ctx.sectionId" :close="() => ctx = null"></slot>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useTreeSelection } from '../../ts/composables/useTreeSelection';
import TreeNodes from './TreeNodes.vue'; // Recursive component

export interface TreeNodeData {
  id: string;
  label: string;
  icon?: string;
  emoji?: string;
  isGroup?: boolean;
  canAdd?: boolean;
  addLabel?: string;
  children?: TreeNodeData[];
  data?: unknown;
}

export interface TreeSectionData {
  id: string;
  title: string;
  icon?: string;
  canAdd?: boolean;
  canEdit?: boolean;
  canAddInline?: boolean;
  itemLabel?: string;
  nodes: TreeNodeData[];
}

const props = defineProps<{
  title?: string;
  icon?: string;
  showBack?: boolean;
  sections: TreeSectionData[];
  activeId?: string;
  storageKey?: string;
}>();

const emit = defineEmits<{
  (e: 'back'): void;
  (e: 'select', nodes: TreeNodeData[], event: MouseEvent): void;
  (e: 'open', node: TreeNodeData): void;
  (e: 'create', parent: { sectionId: string; parentId?: string; name?: string }): void;
  (e: 'create-inline', parent: { sectionId: string; parentId?: string }): void;
  (e: 'rename', node: TreeNodeData, newName: string): void;
  (e: 'cancel-rename', node: TreeNodeData): void;
  (e: 'delete', ids: string[]): void;
  (e: 'edit-section', sectionId: string): void;
  (e: 'delete-section', sectionId: string): void;
  (e: 'move-node', payload: { nodeId: string; newParentId: string }): void;
}>();

// Custom directive to focus input on mount
const vFocus = {
  mounted: (el: HTMLInputElement) => el.focus()
};

// ─── State ──────────────────────────────────────────────────────────────────
const expandedSections = ref<Set<string>>(new Set(props.sections.map(s => s.id)));

// Drag and drop state
const draggedNode = ref<TreeNodeData | null>(null);

const handleDragStart = (e: DragEvent, node: TreeNodeData) => {
  draggedNode.value = node;
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', node.id);
  }
};

const handleDragOver = (e: DragEvent, node: TreeNodeData) => {
  if (draggedNode.value && draggedNode.value.id !== node.id) {
    e.preventDefault(); // Allow drop
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
  }
};

const handleDrop = (e: DragEvent, targetNode: TreeNodeData) => {
  if (draggedNode.value && draggedNode.value.id !== targetNode.id) {
    emit('move-node', { 
      nodeId: draggedNode.value.id, 
      newParentId: targetNode.id 
    });
  }
  draggedNode.value = null;
};

const expanded = ref<Set<string>>(new Set());

// Expand all sections by default
watch(() => props.sections, (newSections) => {
  if (expandedSections.value.size === 0 && newSections.length > 0) {
    newSections.forEach(s => expandedSections.value.add(s.id));
  }
}, { immediate: true });

// ─── Persistence ────────────────────────────────────────────────────────────
onMounted(() => {
  if (props.storageKey) {
    try {
      const exp = localStorage.getItem(`${props.storageKey}:expanded`);
      const sec = localStorage.getItem(`${props.storageKey}:sections`);
      if (exp) expanded.value = new Set(JSON.parse(exp));
      if (sec) expandedSections.value = new Set(JSON.parse(sec));
    } catch {
      /* ignore */
    }
  }
});
const saveState = () => {
  if (props.storageKey) {
    localStorage.setItem(`${props.storageKey}:expanded`, JSON.stringify([...expanded.value]));
    localStorage.setItem(`${props.storageKey}:sections`, JSON.stringify([...expandedSections.value]));
  }
};

// ─── Toggles ────────────────────────────────────────────────────────────────
const toggleSection = (id: string) => {
  if (expandedSections.value.has(id)) expandedSections.value.delete(id);
  else expandedSections.value.add(id);
  saveState();
};
const toggleExpand = (id: string) => {
  if (expanded.value.has(id)) expanded.value.delete(id);
  else expanded.value.add(id);
  saveState();
};

// ─── Flat map for Selection ─────────────────────────────────────────────────
const flattenNodes = (nodes: TreeNodeData[]): TreeNodeData[] => {
  let flat: TreeNodeData[] = [];
  for (const n of nodes) {
    flat.push(n);
    if (n.children && expanded.value.has(n.id)) {
      flat = flat.concat(flattenNodes(n.children));
    }
  }
  return flat;
};
const flatItems = computed(() => {
  let all: TreeNodeData[] = [];
  for (const s of props.sections) {
    if (expandedSections.value.has(s.id)) {
      all = all.concat(flattenNodes(s.nodes));
    }
  }
  return all;
});

// ─── Selection ──────────────────────────────────────────────────────────────
const {
  selected,
  handleClick, clearSelection, deleteSelected, handleKeydown
} = useTreeSelection({
  onDelete: async (ids: string[]) => {
    emit('delete', ids);
  }
});

const onTreeKeydown = (e: KeyboardEvent) => {
  if (renaming.value || creating.value) return;
  
  if (e.key === 'F2') {
    if (selected.value.size === 1) {
      e.preventDefault();
      const id = [...selected.value][0];
      const node = flatItems.value.find((n: TreeNodeData) => n.id === id);
      if (node) startRename(node);
    }
    return;
  }

  handleKeydown(e, flatItems.value);
};

// ─── Actions ────────────────────────────────────────────────────────────────
const handleNodeClick = (e: MouseEvent, node: TreeNodeData, _sectionId: string) => {
  handleClick(e, node, flatItems.value);
  const selectedNodes = flatItems.value.filter((n: TreeNodeData) => selected.value.has(n.id));
  emit('select', selectedNodes, e);
  
  if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
    emit('open', node);
  }
};

const handleNodeDblClick = (node: TreeNodeData) => {
  startRename(node);
};


const renaming = ref<{ id: string; value: string; node: TreeNodeData } | null>(null);
const creating = ref<{ sectionId: string; name: string } | null>(null);

const startRename = (node: TreeNodeData) => {
  renaming.value = { id: node.id, value: node.label, node };
};
const commitRename = () => {
  if (renaming.value) {
    if (renaming.value.value.trim() !== renaming.value.node.label || renaming.value.node.id.toString().startsWith('__new_')) {
      emit('rename', renaming.value.node, renaming.value.value.trim());
    } else {
      emit('cancel-rename', renaming.value.node);
    }
  }
  renaming.value = null;
};

const cancelRename = () => {
  if (renaming.value) {
    emit('cancel-rename', renaming.value.node);
    renaming.value = null;
  }
};

const startCreate = (sectionId: string) => {
  creating.value = { sectionId, name: '' };
};
const commitCreate = () => {
  if (creating.value && creating.value.name.trim()) {
    emit('create', { sectionId: creating.value.sectionId, name: creating.value.name.trim() });
  }
  creating.value = null;
};

// ─── Context Menu ───────────────────────────────────────────────────────────
const ctx = ref<{ x: number; y: number; node: TreeNodeData; sectionId: string } | null>(null);
const ctxStyle = computed(() => {
  if (!ctx.value) return {};
  const x = ctx.value.x + 220 > window.innerWidth ? ctx.value.x - 220 : ctx.value.x;
  const y = ctx.value.y + 160 > window.innerHeight ? ctx.value.y - 160 : ctx.value.y;
  return { top: y + 'px', left: x + 'px' };
});

const handleCtxMenu = (e: MouseEvent, node: TreeNodeData, sectionId: string) => {
  if (!selected.value.has(node.id)) {
    handleClick(new MouseEvent('click'), node, flatItems.value);
  }
  ctx.value = { x: e.clientX, y: e.clientY, node, sectionId };
};

const expandNode = (id: string) => {
  expanded.value.add(id);
};

// Expose methods for parent
defineExpose({
  startRename,
  startCreate,
  deleteSelected,
  clearSelection,
  expandNode
});
</script>

<style scoped>
/* See explorer-tree.css for core styling, this is minimal structure */
</style>
