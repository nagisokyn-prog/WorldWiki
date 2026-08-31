import type {
  BlockNode,
  CrossReferenceNode,
  EquationNode,
  FigureNode,
  FootnoteReferenceNode,
  HeadingNode,
  InlineNode,
  ParagraphNode,
  SemanticDocument,
  TableNode,
  VersionedDocument
} from './types';

export const CURRENT_DOCUMENT_SCHEMA_VERSION = 1;

/**
 * Generates a stable UUID v4 for document nodes.
 * Uses native Web Crypto API when available.
 */
export function generateNodeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback RFC4122 v4 UUID generator
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Normalizes inline node trees: ensures nested footnotes and cross references have IDs.
 */
export function normalizeInlineNode(node: InlineNode): InlineNode {
  if (node.type === 'footnote_reference') {
    const footnote = node as FootnoteReferenceNode;
    return {
      ...footnote,
      id: footnote.id && footnote.id.trim() !== '' ? footnote.id : generateNodeId(),
      content: (footnote.content || []).map(normalizeInlineNode)
    };
  }

  if (node.type === 'cross_reference') {
    const ref = node as CrossReferenceNode;
    return {
      ...ref,
      displayMode: ref.displayMode || 'full'
    };
  }

  return node;
}

/**
 * Normalizes a single BlockNode: ensures valid IDs and recursively normalizes children.
 */
export function normalizeBlockNode(block: BlockNode): BlockNode {
  const id = block.id && block.id.trim() !== '' ? block.id : generateNodeId();

  switch (block.type) {
    case 'paragraph': {
      const p = block as ParagraphNode;
      return {
        ...p,
        id,
        content: (p.content || []).map(normalizeInlineNode)
      };
    }

    case 'heading': {
      const h = block as HeadingNode;
      return {
        ...h,
        id,
        level: h.level >= 1 && h.level <= 6 ? h.level : 1,
        numberingMode: h.numberingMode || 'auto',
        content: (h.content || []).map(normalizeInlineNode)
      };
    }

    case 'figure': {
      const f = block as FigureNode;
      return {
        ...f,
        id,
        numberingMode: f.numberingMode || 'global',
        alignment: f.alignment || 'center',
        captionContent: (f.captionContent || []).map(normalizeInlineNode)
      };
    }

    case 'table': {
      const t = block as TableNode;
      return {
        ...t,
        id,
        numberingMode: t.numberingMode || 'global',
        repeatHeaderOnPageBreak: t.repeatHeaderOnPageBreak ?? true,
        keepWithCaption: t.keepWithCaption ?? true,
        captionContent: (t.captionContent || []).map(normalizeInlineNode),
        rows: (t.rows || []).map((row) => ({
          ...row,
          id: row.id && row.id.trim() !== '' ? row.id : generateNodeId(),
          cells: (row.cells || []).map((cell) => ({
            ...cell,
            id: cell.id && cell.id.trim() !== '' ? cell.id : generateNodeId(),
            content: (cell.content || []).map(normalizeBlockNode)
          }))
        }))
      };
    }

    case 'equation': {
      const eq = block as EquationNode;
      return {
        ...eq,
        id,
        numberingMode: eq.numberingMode || 'auto'
      };
    }

    case 'quote': {
      return {
        ...block,
        id,
        content: (block.content || []).map(normalizeBlockNode)
      };
    }

    case 'list': {
      return {
        ...block,
        id,
        items: (block.items || []).map((item) => ({
          ...item,
          id: item.id && item.id.trim() !== '' ? item.id : generateNodeId(),
          content: (item.content || []).map(normalizeBlockNode)
        }))
      };
    }

    default:
      return {
        ...block,
        id
      };
  }
}

/**
 * Normalizes a raw SemanticDocument:
 * - Guarantees document ID
 * - Validates metadata
 * - Recursively normalizes all BlockNodes and InlineNodes
 */
export function normalizeSemanticDocument(doc: Partial<SemanticDocument>): SemanticDocument {
  const now = Date.now();
  const id = doc.id && doc.id.trim() !== '' ? doc.id : generateNodeId();

  return {
    id,
    profileId: doc.profileId || 'gost_academic',
    metadata: {
      title: doc.metadata?.title || 'Без названия',
      subtitle: doc.metadata?.subtitle,
      authors: doc.metadata?.authors || ['Автор'],
      createdAt: doc.metadata?.createdAt || now,
      updatedAt: now,
      academic: doc.metadata?.academic,
      book: doc.metadata?.book
    },
    blocks: (doc.blocks || []).map(normalizeBlockNode)
  };
}

/**
 * Normalizes a VersionedDocument container.
 * Handles schema version verification and preparation for migrations.
 */
export function normalizeVersionedDocument(raw: Partial<VersionedDocument>): VersionedDocument {
  const schemaVersion = raw.schemaVersion || CURRENT_DOCUMENT_SCHEMA_VERSION;
  const document = normalizeSemanticDocument(raw.document || {});

  return {
    schemaVersion,
    document
  };
}
