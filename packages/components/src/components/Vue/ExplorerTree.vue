<template>
  <div class="explorer-tree" tabindex="0" @keydown="onTreeKeydown" @click.self="clearSelection()">
    <!-- Header -->
    <div v-if="title" class="tree-header flex items-center">
      <button v-if="showBack" class="tree-back-btn" title="Back" @click="$emit('back')">
        <i class="fas fa-arrow-left"></i>
      </button>
      <span class="tree-title">
        <i v-if="icon" :class="icon"></i>
        {{ title }}
      </span>
      <div class="tree-header-actions tree-header-actions-end">
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
            <i v-if="sect.canEdit" class="fas fa-trash btn-action-danger" title="Удалить схему" @click.stop="$emit('delete-section', sect.id)"></i>
            <i v-if="sect.canEdit" class="fas fa-pen btn-action-dim" title="Настроить сущности" @click.stop="$emit('edit-section', sect.id)"></i>
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
                <span class="tree-node-icon">
                  <i v-if="isFaIcon(sect.icon)" :class="formatFaIcon(sect.icon)"></i>
                  <template v-else>{{ sect.icon || '📄' }}</template>
                </span>
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

          <div v-if="!sect.nodes?.length && !creating" class="tree-empty-small">Пусто</div>

          <!-- Section Add Button -->
          <div v-if="sect.canAddInline" class="tree-add-inline" @click.stop="$emit('create-inline', { sectionId: sect.id })">
            <i class="fas fa-plus"></i> <span>{{ sect.itemLabel || 'Элемент' }}</span>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="!sections.length" class="tree-empty">
        <i class="fas fa-folder-open empty-tree-icon"></i>
        <div>Нет структуры</div>
        <slot name="empty-hint"></slot>
      </div>
    </div>

    <!-- Context Menu Overlay -->
    <Teleport to="body">
      <div v-if="ctx" class="tree-ctx-overlay" @click="ctx = null"></div>
      <transition name="ctx-pop">
        <div v-if="ctx" class="tree-ctx-menu" :style="{ '--ctx-top': ctxStyle.top, '--ctx-left': ctxStyle.left }">
          <!-- Inject context menu items via slot, passing the active node context -->
          <slot name="context-menu" :node="ctx.node" :section-id="ctx.sectionId" :close="() => ctx = null"></slot>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import TreeNodes from './TreeNodes.vue';
import { 
  useExplorerTree, 
  type ExplorerTreeProps, 
  type ExplorerTreeEmits,
  type TreeNodeData,
  type TreeSectionData
} from './useExplorerTree';

export type { TreeNodeData, TreeSectionData };

const props = defineProps<ExplorerTreeProps>();
const emit = defineEmits<ExplorerTreeEmits>();

// Custom directive to focus input on mount
const vFocus = {
  mounted: (el: HTMLInputElement) => el.focus()
};

const {
  expandedSections,
  expanded,
  selected,
  renaming,
  creating,
  ctx,
  ctxStyle,
  handleDragStart,
  handleDragOver,
  handleDrop,
  toggleSection,
  toggleExpand,
  onTreeKeydown,
  handleNodeClick,
  handleNodeDblClick,
  commitRename,
  cancelRename,
  commitCreate,
  handleCtxMenu,
  startRename,
  startCreate,
  deleteSelected,
  clearSelection,
  expandNode,
  isFaIcon,
  formatFaIcon
} = useExplorerTree(props, emit);

defineExpose({
  startRename,
  startCreate,
  deleteSelected,
  clearSelection,
  expandNode
});
</script>

<style scoped src="@worldwiki/resources/styles/components/ExplorerTree.css"></style>
