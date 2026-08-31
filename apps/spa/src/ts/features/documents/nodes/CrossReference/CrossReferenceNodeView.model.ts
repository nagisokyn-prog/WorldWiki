import type { NodeViewProps } from '@tiptap/vue-3';

export interface CrossReferenceNodeAttrs {
  targetId: string;
  kind: 'heading' | 'figure' | 'table' | 'equation' | 'page';
  displayMode: 'full' | 'short' | 'number_only';
  resolvedLabel?: string;
  isBroken?: boolean;
}

export interface CrossReferenceNodeViewProps extends NodeViewProps {
  node: NodeViewProps['node'] & {
    attrs: CrossReferenceNodeAttrs;
  };
}
