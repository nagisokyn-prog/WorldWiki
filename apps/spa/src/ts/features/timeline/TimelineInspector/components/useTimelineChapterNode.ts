import type { TimelineChapterNodeProps, TimelineChapterNodeEmits } from './TimelineChapterNode.model';
import { normalizeId } from '../timelineInspector.utils';

export function useTimelineChapterNode(
  props: TimelineChapterNodeProps,
  emit: TimelineChapterNodeEmits
) {
  function onClick() {
    emit('select', props.chapter);
  }

  function onNavigate() {
    emit('navigate', props.chapter);
  }

  function onJumpFlashback(e: MouseEvent) {
    emit('jump-flashback', props.chapter, e);
  }

  function onMouseEnter() {
    emit('set-hover', props.chapter.id);
  }

  function onMouseLeave() {
    emit('set-hover', null);
  }

  return {
    normalizeId,
    onClick,
    onNavigate,
    onJumpFlashback,
    onMouseEnter,
    onMouseLeave,
  };
}
