import { generateNodeId, normalizeSemanticDocument } from '../ast/ASTNormalizer';
import type {
  BlockNode,
  DocumentMetadata,
  HeadingNode,
  InlineNode,
  ListItemNode,
  ListNode,
  ParagraphNode,
  QuoteNode,
  SemanticDocument,
  TableCellNode,
  TableNode,
  TableRowNode,
  TextMark
} from '../ast/types';

/**
 * High-performance lightweight DOMParser-based converter from legacy HTML to Semantic AST.
 * Operates without initializing heavy ProseMirror/Tiptap instances in memory.
 */
export class LegacyHtmlToASTConverter {
  public static convert(
    html: string,
    metadata?: Partial<DocumentMetadata>,
    profileId = 'gost',
    id?: string
  ): SemanticDocument {
    if (!html || !html.trim()) {
      return normalizeSemanticDocument({
        id,
        metadata: {
          title: metadata?.title || 'Без названия',
          authors: metadata?.authors || [],
          createdAt: metadata?.createdAt || Date.now(),
          updatedAt: metadata?.updatedAt || Date.now(),
          ...metadata
        },
        profileId,
        blocks: [
          {
            type: 'paragraph',
            id: generateNodeId(),
            content: []
          }
        ]
      });
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(`<body>${html}</body>`, 'text/html');
    const body = doc.body;

    const blocks: BlockNode[] = [];

    for (let i = 0; i < body.children.length; i++) {
      const el = body.children[i] as HTMLElement;
      const block = this.convertElementToBlock(el);
      if (block) {
        if (Array.isArray(block)) {
          blocks.push(...block);
        } else {
          blocks.push(block);
        }
      }
    }

    if (blocks.length === 0) {
      blocks.push({
        type: 'paragraph',
        id: generateNodeId(),
        content: []
      });
    }

    return normalizeSemanticDocument({
      id,
      metadata: {
        title: metadata?.title || 'Без названия',
        authors: metadata?.authors || [],
        createdAt: metadata?.createdAt || Date.now(),
        updatedAt: metadata?.updatedAt || Date.now(),
        ...metadata
      },
      profileId,
      blocks
    });
  }

  private static convertElementToBlock(el: HTMLElement): BlockNode | BlockNode[] | null {
    const tagName = el.tagName.toLowerCase();

    // Заголовки h1..h6
    if (/^h[1-6]$/.test(tagName)) {
      const level = Math.min(Math.max(parseInt(tagName[1], 10), 1), 6) as 1 | 2 | 3 | 4 | 5 | 6;
      const content = this.parseInlineContent(el);
      const headingNode: HeadingNode = {
        type: 'heading',
        id: el.getAttribute('id') || generateNodeId(),
        level,
        content,
        numberingMode: 'auto'
      };
      return headingNode;
    }

    // Параграфы
    if (tagName === 'p') {
      const text = el.textContent?.trim() || '';
      if (text === '* * *' || text === '***' || el.classList.contains('scene-break')) {
        return {
          type: 'scene_break',
          id: el.getAttribute('id') || generateNodeId(),
          variant: 'asterisms'
        };
      }

      const content = this.parseInlineContent(el);
      const node: ParagraphNode = {
        type: 'paragraph',
        id: el.getAttribute('id') || generateNodeId(),
        content
      };

      const textAlign = el.style.textAlign;
      if (textAlign === 'left' || textAlign === 'center' || textAlign === 'right' || textAlign === 'justify') {
        node.styleOverride = { alignment: textAlign };
      }
      return node;
    }

    // Списки ul / ol
    if (tagName === 'ul' || tagName === 'ol') {
      const items: ListItemNode[] = [];
      for (let i = 0; i < el.children.length; i++) {
        const li = el.children[i] as HTMLElement;
        if (li.tagName.toLowerCase() === 'li') {
          const liContent = this.parseInlineContent(li);
          items.push({
            id: li.getAttribute('id') || generateNodeId(),
            content: [
              {
                type: 'paragraph',
                id: generateNodeId(),
                content: liContent
              }
            ]
          });
        }
      }

      const listNode: ListNode = {
        type: 'list',
        id: el.getAttribute('id') || generateNodeId(),
        variant: tagName === 'ol' ? 'ordered' : 'bullet',
        items
      };
      return listNode;
    }

    // Цитаты blockquote
    if (tagName === 'blockquote') {
      const paragraphs: ParagraphNode[] = [];
      for (let i = 0; i < el.children.length; i++) {
        const child = el.children[i] as HTMLElement;
        if (child.tagName.toLowerCase() === 'p') {
          paragraphs.push({
            type: 'paragraph',
            id: child.getAttribute('id') || generateNodeId(),
            content: this.parseInlineContent(child)
          });
        }
      }

      if (paragraphs.length === 0) {
        paragraphs.push({
          type: 'paragraph',
          id: generateNodeId(),
          content: this.parseInlineContent(el)
        });
      }

      const quoteNode: QuoteNode = {
        type: 'quote',
        id: el.getAttribute('id') || generateNodeId(),
        content: paragraphs
      };
      return quoteNode;
    }

    // Разделители hr
    if (tagName === 'hr') {
      return {
        type: 'scene_break',
        id: generateNodeId(),
        variant: 'asterisms'
      };
    }

    // Таблицы table
    if (tagName === 'table') {
      const rows: TableRowNode[] = [];
      const trList = el.querySelectorAll('tr');

      trList.forEach((tr) => {
        const cells: TableCellNode[] = [];
        const cellEls = tr.querySelectorAll('th, td');
        const isHeaderRow = tr.querySelector('th') !== null;

        cellEls.forEach((cell) => {
          const content = this.parseInlineContent(cell as HTMLElement);
          cells.push({
            id: cell.getAttribute('id') || generateNodeId(),
            content: [
              {
                type: 'paragraph',
                id: generateNodeId(),
                content
              }
            ]
          });
        });

        rows.push({
          id: tr.getAttribute('id') || generateNodeId(),
          isHeader: isHeaderRow,
          cells
        });
      });

      const tableNode: TableNode = {
        type: 'table',
        id: el.getAttribute('id') || generateNodeId(),
        captionContent: [],
        numberingMode: 'by_chapter',
        repeatHeaderOnPageBreak: true,
        keepWithCaption: true,
        rows
      };
      return tableNode;
    }

    // Дефолтный fallback
    const fallbackContent = this.parseInlineContent(el);
    if (fallbackContent.length > 0) {
      return {
        type: 'paragraph',
        id: generateNodeId(),
        content: fallbackContent
      };
    }

    return null;
  }

  private static parseInlineContent(container: HTMLElement): InlineNode[] {
    const inlines: InlineNode[] = [];

    const traverse = (node: Node, marks: TextMark[]) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || '';
        if (text) {
          inlines.push({
            type: 'text',
            text,
            ...(marks.length > 0 ? { marks: [...marks] } : {})
          });
        }
        return;
      }

      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        const tag = el.tagName.toLowerCase();

        // Ссылки на сущности
        if (el.hasAttribute('data-entity-id') || el.classList.contains('entity-mention')) {
          const entityId = el.getAttribute('data-entity-id') || '';
          const entityType = el.getAttribute('data-entity-type') || 'character';
          const name = el.textContent || '';
          inlines.push({
            type: 'entity_reference',
            id: entityId || generateNodeId(),
            entityType,
            name,
            url: `${entityType}://${entityId}`
          });
          return;
        }

        const nextMarks = [...marks];

        if (tag === 'strong' || tag === 'b') nextMarks.push({ type: 'bold' });
        if (tag === 'em' || tag === 'i') nextMarks.push({ type: 'italic' });
        if (tag === 'u') nextMarks.push({ type: 'underline' });
        if (tag === 's' || tag === 'strike' || tag === 'del') nextMarks.push({ type: 'strike' });
        if (tag === 'code') nextMarks.push({ type: 'code' });
        if (tag === 'sub') nextMarks.push({ type: 'subscript' });
        if (tag === 'sup') nextMarks.push({ type: 'superscript' });
        if (tag === 'a') {
          nextMarks.push({
            type: 'link',
            href: el.getAttribute('href') || '',
            title: el.getAttribute('title') || undefined
          });
        }

        if (el.style.color) {
          nextMarks.push({ type: 'color', color: el.style.color });
        }
        if (el.style.backgroundColor) {
          nextMarks.push({ type: 'highlight', color: el.style.backgroundColor });
        }
        if (el.style.fontFamily) {
          nextMarks.push({ type: 'fontFamily', font: el.style.fontFamily });
        }

        for (let i = 0; i < el.childNodes.length; i++) {
          traverse(el.childNodes[i], nextMarks);
        }
      }
    };

    for (let i = 0; i < container.childNodes.length; i++) {
      traverse(container.childNodes[i], []);
    }

    return inlines;
  }
}
