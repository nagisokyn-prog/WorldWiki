import type { NodeViewProps } from '@tiptap/vue-3';

export interface FigureNodeAttrs {
  id: string;
  src: string;
  caption: string;
  computedNumber?: string;
  numberingMode?: 'global' | 'by_chapter' | 'none';
  alignment?: 'center' | 'left' | 'right';
  width?: string | number;
}

export interface FigureNodeViewProps extends NodeViewProps {
  node: NodeViewProps['node'] & {
    attrs: FigureNodeAttrs;
  };
}
