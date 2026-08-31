import type { NodeViewProps } from '@tiptap/vue-3';

export interface FootnoteNodeAttrs {
  id: string;
  computedNumber?: number;
  content?: string;
}

export interface FootnoteNodeViewProps extends NodeViewProps {
  node: NodeViewProps['node'] & {
    attrs: FootnoteNodeAttrs;
  };
}
