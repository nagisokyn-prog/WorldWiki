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
          @click="$emit('click-node', $event, node)" 
          @dblclick="$emit('dblclick-node', node)"
          @contextmenu.prevent="$emit('ctx-node', $event, node)"
        >
          <span v-if="node.children?.length || node.isGroup" class="tree-expand-btn" @click.stop="$emit('toggle-expand', node.id)">
            <i :class="expanded.has(node.id) ? 'fas fa-chevron-down' : 'fas fa-chevron-right'"></i>
          </span>
          <span v-else class="tree-expand-btn spacer"></span>

          <span class="tree-node-icon" v-if="node.emoji || node.icon">
            <template v-if="node.emoji">{{ node.emoji }}</template>
            <i v-else :class="node.icon"></i>
          </span>
          
          <template v-if="renamingId === node.id">
            <input 
              class="tree-rename-input" 
              :value="renamingValue"
              @input="$emit('update:renaming-value', ($event.target as HTMLInputElement).value)"
              @keydown.enter="$emit('commit-rename')" 
              @keydown.escape="$emit('cancel-rename')"
              @blur="$emit('commit-rename')" 
              v-focus 
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
            @click-node="$emit('click-node', $event[0] || $event, $event[1])"
            @dblclick-node="$emit('dblclick-node', $event)"
            @ctx-node="$emit('ctx-node', $event[0] || $event, $event[1])"
            @create-in="$emit('create-in', $event)"
            @update:renaming-value="$emit('update:renaming-value', $event)"
            @commit-rename="$emit('commit-rename')"
            @cancel-rename="$emit('cancel-rename')"
          />
        </div>

        <!-- Add Button -->
        <div v-if="node.canAdd && expanded.has(node.id)" class="tree-add-inline group-add" @click.stop="$emit('create-in', node)">
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
  'create-in', 'update:renaming-value', 'commit-rename', 'cancel-rename'
]);

const vFocus = {
  mounted: (el: HTMLInputElement) => el.focus()
};
</script>

<style scoped>
/* Rely on global explorer-tree.css */
.spacer { display: inline-block; width: 16px; height: 16px; margin-right: 4px; }
</style>
