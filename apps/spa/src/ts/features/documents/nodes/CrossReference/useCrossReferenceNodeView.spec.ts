import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { reactive } from 'vue';
import { useCrossReferenceNodeView } from './useCrossReferenceNodeView';
import type { CrossReferenceNodeViewProps } from './CrossReferenceNodeView.model';

describe('useCrossReferenceNodeView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function makeProps(attrs: Record<string, unknown> = {}) {
    return reactive({
      node: {
        attrs: {
          targetId: 'node-1',
          kind: 'figure',
          isBroken: false,
          resolvedLabel: 'Рис. 1',
          ...attrs
        }
      }
    }) as unknown as CrossReferenceNodeViewProps;
  }

  it('computes targetId, kind, isBroken, resolvedLabel, and icon for all kinds', () => {
    const props = makeProps();
    const view = useCrossReferenceNodeView(props);

    expect(view.targetId.value).toBe('node-1');
    expect(view.kind.value).toBe('figure');
    expect(view.isBroken.value).toBe(false);
    expect(view.resolvedLabel.value).toBe('Рис. 1');
    expect(view.icon.value).toBe('🖼️');

    props.node.attrs.kind = 'table';
    expect(view.icon.value).toBe('📊');

    props.node.attrs.kind = 'equation';
    expect(view.icon.value).toBe('∑');

    props.node.attrs.kind = 'heading';
    expect(view.icon.value).toBe('§');

    props.node.attrs.kind = 'other';
    expect(view.icon.value).toBe('🔗');

    props.node.attrs.kind = '';
    expect(view.kind.value).toBe('figure');

    props.node.attrs.resolvedLabel = '';
    expect(view.resolvedLabel.value).toBe('Ссылка');

    props.node.attrs.isBroken = true;
    expect(view.resolvedLabel.value).toBe('⚠️ [объект удален]');
  });

  it('jumpToTarget scrolls and highlights existing target, and skips broken/empty targets', () => {
    const targetEl = document.createElement('div');
    targetEl.setAttribute('data-node-id', 'node-42');
    targetEl.scrollIntoView = vi.fn();
    document.body.appendChild(targetEl);

    const props = makeProps({ targetId: 'node-42', isBroken: false });
    const view = useCrossReferenceNodeView(props);

    const preventDefault = vi.fn();
    const stopPropagation = vi.fn();

    view.jumpToTarget({ preventDefault, stopPropagation } as unknown as MouseEvent);
    expect(preventDefault).toHaveBeenCalled();
    expect(stopPropagation).toHaveBeenCalled();
    expect(targetEl.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
    expect(targetEl.classList.contains('ww-target-highlight')).toBe(true);

    vi.advanceTimersByTime(1500);
    expect(targetEl.classList.contains('ww-target-highlight')).toBe(false);

    // Broken or missing targetId does nothing
    props.node.attrs.isBroken = true;
    (targetEl.scrollIntoView as ReturnType<typeof vi.fn>).mockClear();
    view.jumpToTarget({ preventDefault: vi.fn(), stopPropagation: vi.fn() } as unknown as MouseEvent);
    expect(targetEl.scrollIntoView).not.toHaveBeenCalled();

    props.node.attrs.isBroken = false;
    props.node.attrs.targetId = '';
    view.jumpToTarget({ preventDefault: vi.fn(), stopPropagation: vi.fn() } as unknown as MouseEvent);
    expect(targetEl.scrollIntoView).not.toHaveBeenCalled();

    targetEl.remove();
  });
});

