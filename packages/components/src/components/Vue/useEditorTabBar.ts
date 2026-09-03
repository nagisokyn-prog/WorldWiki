import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

export interface EditorTab {
  id: string;
  rawId: string;
  title: string;
  entityType: string;
  tabType: 'entity' | 'chapter' | 'schema-editor';
  data: Record<string, unknown>;
  unsaved: boolean;
}

export interface EditorTabBarProps {
  groupId: string;
  tabs: EditorTab[];
  activeTabId: string | null;
  isActiveGroup: boolean;
  canClose: boolean;
}

export interface EditorTabBarEmits {
  (e: 'activate', tabId: string): void;
  (e: 'close', tabId: string): void;
  (e: 'split'): void;
  (e: 'close-group'): void;
  (e: 'move-tab', payload: { tabId: string; fromGroupId: string; toGroupId: string; toIndex: number }): void;
  (e: 'reorder-tab', payload: { groupId: string; fromIdx: number; toIdx: number }): void;
}

export function useEditorTabBar(
  props: EditorTabBarProps,
  emit: EditorTabBarEmits
) {
  const { t } = useI18n();

  const DRAG_TAB_KEY = 'ww-drag-tab-id';
  const DRAG_GROUP_KEY = 'ww-drag-group-id';

  const draggingTabId = ref<string | null>(null);
  const dragOverIdx = ref<number | null>(null);
  const dropSide = ref<'left' | 'right'>('right');

  const onDragStart = (e: DragEvent, tabId: string, _idx: number) => {
    draggingTabId.value = tabId;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData(DRAG_TAB_KEY, tabId);
      e.dataTransfer.setData(DRAG_GROUP_KEY, props.groupId);
    }
  };

  const onDragEnd = () => {
    draggingTabId.value = null;
    dragOverIdx.value = null;
  };

  const getDropIndex = (e: DragEvent, idx: number): { idx: number; side: 'left' | 'right' } => {
    const el = (e.currentTarget as HTMLElement);
    const rect = el.getBoundingClientRect();
    const mid = rect.left + rect.width / 2;
    if (e.clientX < mid) return { idx, side: 'left' };
    return { idx, side: 'right' };
  };

  const onTabDragOver = (e: DragEvent, idx: number) => {
    const { idx: di, side } = getDropIndex(e, idx);
    dragOverIdx.value = di;
    dropSide.value = side;
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
  };

  const onTabDragLeave = (idx: number) => {
    if (dragOverIdx.value === idx) dragOverIdx.value = null;
  };

  const onTabDrop = (e: DragEvent, idx: number) => {
    if (!e.dataTransfer) return;
    const tabId = e.dataTransfer.getData(DRAG_TAB_KEY);
    const fromGroupId = e.dataTransfer.getData(DRAG_GROUP_KEY);
    if (!tabId) return;

    const { idx: di, side } = getDropIndex(e, idx);
    const toIndex = side === 'right' ? di + 1 : di;

    if (fromGroupId === props.groupId) {
      const fromIdx = props.tabs.findIndex(t => t.id === tabId);
      if (fromIdx >= 0 && fromIdx !== toIndex) {
        emit('reorder-tab', { groupId: props.groupId, fromIdx, toIdx: toIndex });
      }
    } else {
      emit('move-tab', { tabId, fromGroupId, toGroupId: props.groupId, toIndex });
    }

    dragOverIdx.value = null;
    draggingTabId.value = null;
  };

  const onBarDragOver = (e: DragEvent) => {
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
  };

  const onBarDrop = (e: DragEvent) => {
    if (!e.dataTransfer) return;
    const tabId = e.dataTransfer.getData(DRAG_TAB_KEY);
    const fromGroupId = e.dataTransfer.getData(DRAG_GROUP_KEY);
    if (!tabId) return;

    if (fromGroupId !== props.groupId) {
      emit('move-tab', { tabId, fromGroupId, toGroupId: props.groupId, toIndex: props.tabs.length });
    }
    dragOverIdx.value = null;
  };

  return {
    t,
    draggingTabId,
    dragOverIdx,
    dropSide,
    onDragStart,
    onDragEnd,
    onTabDragOver,
    onTabDragLeave,
    onTabDrop,
    onBarDragOver,
    onBarDrop
  };
}
