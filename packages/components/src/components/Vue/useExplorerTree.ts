import { ref, computed, watch, onMounted } from 'vue';
import { useTreeSelection } from '../../ts/composables/useTreeSelection';

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

export interface ExplorerTreeProps {
  title?: string;
  icon?: string;
  showBack?: boolean;
  sections: TreeSectionData[];
  activeId?: string;
  storageKey?: string;
}

export interface ExplorerTreeEmits {
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
}

export function useExplorerTree(
  props: ExplorerTreeProps,
  emit: ExplorerTreeEmits
) {
  const expandedSections = ref<Set<string>>(new Set(props.sections.map(s => s.id)));
  const draggedNode = ref<TreeNodeData | null>(null);
  const expanded = ref<Set<string>>(new Set());

  const handleDragStart = (e: DragEvent, node: TreeNodeData) => {
    draggedNode.value = node;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', node.id);
    }
  };

  const handleDragOver = (e: DragEvent, node: TreeNodeData) => {
    if (draggedNode.value && draggedNode.value.id !== node.id) {
      e.preventDefault();
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

  watch(() => props.sections, (newSections) => {
    if (expandedSections.value.size === 0 && newSections.length > 0) {
      newSections.forEach(s => expandedSections.value.add(s.id));
    }
  }, { immediate: true });

  onMounted(() => {
    if (props.storageKey) {
      try {
        const exp = localStorage.getItem(`${props.storageKey}:expanded`);
        const sec = localStorage.getItem(`${props.storageKey}:sections`);
        if (exp) expanded.value = new Set(JSON.parse(exp));
        if (sec) expandedSections.value = new Set(JSON.parse(sec));
      } catch (err) {
        console.warn('[useExplorerTree] Failed to restore tree expanded state from localStorage:', err);
      }
    }
  });

  const saveState = () => {
    if (props.storageKey) {
      localStorage.setItem(`${props.storageKey}:expanded`, JSON.stringify([...expanded.value]));
      localStorage.setItem(`${props.storageKey}:sections`, JSON.stringify([...expandedSections.value]));
    }
  };

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

  const {
    selected,
    handleClick, clearSelection, deleteSelected, handleKeydown
  } = useTreeSelection({
    onDelete: async (ids: string[]) => {
      emit('delete', ids);
    }
  });

  const renaming = ref<{ id: string; value: string; node: TreeNodeData } | null>(null);
  const creating = ref<{ sectionId: string; name: string } | null>(null);

  const startRename = (node: TreeNodeData) => {
    renaming.value = { id: node.id, value: node.label, node };
  };

  const commitRename = () => {
    if (renaming.value) {
      const trimmed = renaming.value.value.trim();
      if (trimmed && (trimmed !== renaming.value.node.label || renaming.value.node.id.toString().startsWith('__new_'))) {
        renaming.value.node.label = trimmed;
        emit('rename', renaming.value.node, trimmed);
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

  const ctx = ref<{ x: number; y: number; node: TreeNodeData; sectionId: string } | null>(null);
  const ctxStyle = computed(() => {
    if (!ctx.value) return { top: '0px', left: '0px' };
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

  const isFaIcon = (val?: string) => {
    if (!val) return false;
    return val.startsWith('fa-') || val.startsWith('fas ') || val.startsWith('far ') || val.startsWith('fab ') || val.includes(' fa-');
  };

  const formatFaIcon = (val?: string) => {
    if (!val) return '';
    if (val.startsWith('fa-')) return `fas ${val}`;
    return val;
  };

  return {
    expandedSections,
    draggedNode,
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
  };
}
