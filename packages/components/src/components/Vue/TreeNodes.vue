<template>
  <div class="tree-nodes-container">
    <template v-for="node in nodes" :key="node.id">
      <div 
        class="tree-item" 
        :class="{ 
          'tree-group': node.isGroup,
          active: activeId === node.id, 
          selected: selectedIds.has(node.id) 
        }"
      >
        <div 
          class="tree-item-row" 
          :draggable="true"
          @click="$emit('click-node', $event, node)" 
          @dblclick="$emit('dblclick-node', node)"
          @contextmenu.prevent="$emit('ctx-node', $event, node)"
          @dragstart.stop="$emit('drag-start', $event, node)"
          @dragenter.prevent.stop="$emit('drag-enter', $event, node)"
          @dragover.prevent.stop="$emit('drag-over', $event, node)"
          @dragleave.prevent.stop="$emit('drag-leave', $event, node)"
          @drop.prevent.stop="$emit('drop-node', $event, node)"
        >
          <span v-if="node.children?.length || node.isGroup" class="tree-expand-btn" @click.stop="$emit('toggle-expand', node.id)">
            <i :class="expanded.has(node.id) ? 'fas fa-chevron-down' : 'fas fa-chevron-right'"></i>
          </span>
          <span v-else class="tree-expand-btn spacer"></span>

          <span v-if="node.emoji || node.icon" class="tree-node-icon">
            <template v-if="node.emoji">{{ node.emoji }}</template>
            <i v-else :class="node.icon"></i>
          </span>
          
          <template v-if="renamingId === node.id">
            <input 
              v-focus 
              class="tree-rename-input"
              :value="renamingValue"
              @input="$emit('update:renaming-value', ($event.target as HTMLInputElement).value)" 
              @keydown.enter="$emit('commit-rename')"
              @keydown.escape="$emit('cancel-rename')" 
              @blur="$emit('commit-rename')" 
              @click.stop 
            />
          </template>
          <template v-else>
            <span class="tree-item-label">{{ node.label || 'Unnamed' }}</span>
          </template>
        </div>

        <!-- Children -->
        <div v-if="node.children?.length && expanded.has(node.id)" class="tree-children">
          <TreeNodes
            :nodes="node.children"
            :expanded="expanded"
            :active-id="activeId"
            :selected-ids="selectedIds"
            :renaming-id="renamingId"
            :renaming-value="renamingValue"
            @toggle-expand="$emit('toggle-expand', $event)"
            @click-node="(e, n) => $emit('click-node', e, n)"
            @dblclick-node="n => $emit('dblclick-node', n)"
            @ctx-node="(e, n) => $emit('ctx-node', e, n)"
            @create-in="n => $emit('create-in', n)"
            @update:renaming-value="$emit('update:renaming-value', $event)"
            @commit-rename="$emit('commit-rename')"
            @cancel-rename="$emit('cancel-rename')"
            @drag-start="(e, n) => $emit('drag-start', e, n)"
            @drag-enter="(e, n) => $emit('drag-enter', e, n)"
            @drag-over="(e, n) => $emit('drag-over', e, n)"
            @drag-leave="(e, n) => $emit('drag-leave', e, n)"
            @drop-node="(e, n) => $emit('drop-node', e, n)"
          />
        </div>

        <!-- Add Button -->
        <div v-if="node.canAdd && expanded.has(node.id)" class="tree-add-inline group-add" @click.stop="() => { console.log('TREENODES: CLICKED ADD BUTTON for node', node); $emit('create-in', node); }">
          <i class="fas fa-plus"></i> <span>{{ node.addLabel || 'Add' }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { TreeNodeData } from './ExplorerTree.vue';

defineProps<{
  nodes: TreeNodeData[];
  expanded: Set<string>;
  activeId?: string;
  selectedIds: Set<string>;
  renamingId?: string;
  renamingValue?: string;
}>();

const emit = defineEmits([
  'toggle-expand', 'click-node', 'dblclick-node', 'ctx-node', 
  'create-in', 'update:renaming-value', 'commit-rename', 'cancel-rename',
  'drag-start', 'drag-enter', 'drag-over', 'drag-leave', 'drop-node'
]);

const vFocus = {
  mounted: (el: HTMLInputElement) => el.focus()
};
</script>

<style scoped>
/* Rely on global explorer-tree.css */
.spacer { display: inline-block; width: 16px; height: 16px; margin-right: 4px; }
</style>
