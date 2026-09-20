import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { EditorGroupPaneProps, EditorGroupPaneEmits } from './EditorGroupPane.model';

export function useEditorGroupPane(
  props: EditorGroupPaneProps,
  emit: EditorGroupPaneEmits
) {
  const { t } = useI18n();

  const activeTab = computed(() =>
    props.group?.tabs?.find(tab => tab.id === props.group.activeTabId) ?? null
  );

  const handleFocus = () => {
    emit('focus');
  };

  const handleActivateTab = (id: string) => {
    emit('activate-tab', props.group.id, id);
  };

  const handleCloseTab = (id: string) => {
    emit('close-tab', props.group.id, id);
  };

  const handleSplit = () => {
    emit('split', props.group.id);
  };

  const handleCloseGroup = () => {
    emit('close-group', props.group.id);
  };

  const handleMoveTab = (event: { tabId: string; toGroupId: string; toIndex: number }) => {
    emit('move-tab', event);
  };

  const handleReorderTab = (event: { groupId: string; fromIdx: number; toIdx: number }) => {
    emit('reorder-tab', event);
  };

  return {
    t,
    activeTab,
    handleFocus,
    handleActivateTab,
    handleCloseTab,
    handleSplit,
    handleCloseGroup,
    handleMoveTab,
    handleReorderTab
  };
}
