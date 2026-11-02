import { describe, it, expect, vi } from 'vitest';
import { useTimelineChapterNode } from '../useTimelineChapterNode';
import type { TimelineChapterNodeProps } from '../TimelineChapterNode.model';

describe('useTimelineChapterNode', () => {
  it('handles clicks, navigation and hover events', () => {
    const emit = vi.fn();
    const props: TimelineChapterNodeProps = {
      chapter: {
        id: 'chapters:c1',
        title: 'Title',
        sort_order: 1,
      },
      index: 0,
      isActive: false,
    };

    const { onClick, onNavigate, onJumpFlashback, onMouseEnter, onMouseLeave } =
      useTimelineChapterNode(props, emit as unknown as Parameters<typeof useTimelineChapterNode>[1]);

    onClick();
    expect(emit).toHaveBeenCalledWith('select', props.chapter);

    onNavigate();
    expect(emit).toHaveBeenCalledWith('navigate', props.chapter);

    const fakeEv = {} as MouseEvent;
    onJumpFlashback(fakeEv);
    expect(emit).toHaveBeenCalledWith('jump-flashback', props.chapter, fakeEv);

    onMouseEnter();
    expect(emit).toHaveBeenCalledWith('set-hover', 'chapters:c1');

    onMouseLeave();
    expect(emit).toHaveBeenCalledWith('set-hover', null);
  });
});

