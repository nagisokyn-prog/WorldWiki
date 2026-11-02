import type { TimelineInspectorToolbarProps, TimelineInspectorToolbarEmits } from './TimelineInspectorToolbar.model';

export function useTimelineInspectorToolbar(
  _props: TimelineInspectorToolbarProps,
  emit: TimelineInspectorToolbarEmits
) {
  function onRefresh() {
    emit('refresh');
  }

  return {
    onRefresh,
  };
}
