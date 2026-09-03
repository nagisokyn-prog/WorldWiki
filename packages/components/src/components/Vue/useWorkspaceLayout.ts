import { ref, onMounted, onUnmounted } from 'vue';
import { useEditorGroups } from '../../ts/composables/useEditorGroups';

export interface WorkspaceLayoutProps {
  defaultSidebarWidth?: number;
  sidebarVisible?: boolean;
}

export function useWorkspaceLayout(props: WorkspaceLayoutProps) {
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

  const sidebarWidth = ref(props.defaultSidebarWidth ?? 260);

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

  return {
    groups,
    activeGroupId,
    sidebarWidth,
    setActiveGroup,
    openTab,
    closeTab,
    activateTab,
    splitGroup,
    closeGroup,
    activeTab,
    startSidebarResize,
    startGroupResize
  };
}
