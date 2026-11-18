import { describe, it, expect } from 'vitest';
import { LegacyHtmlToASTConverter } from '../legacyHtmlToASTConverter';
import type { HeadingNode, ListNode, ParagraphNode, QuoteNode, TableNode, TextNode } from '../../ast/types';

describe('LegacyHtmlToASTConverter', () => {
  it('1. Корректно парсит пустой HTML в валидный SemanticDocument с пустым параграфом', () => {
    const doc = LegacyHtmlToASTConverter.convert('', { title: 'Пустая глава' });
    expect(doc.metadata.title).toBe('Пустая глава');
    expect(doc.blocks).toHaveLength(1);
    expect(doc.blocks[0].type).toBe('paragraph');
  });

  it('2. Парсит параграфы со сложными марками (bold, italic, underline, link, colors)', () => {
    const html = `
      <p style="text-align: justify;">
        Привет <strong>жирный</strong> и <em><strong>жирный курсив</strong></em>.
        <a href="https://example.com">Ссылка</a>
        <span style="color: rgb(255, 0, 0);">Красный</span>
      </p>
    `;

    const doc = LegacyHtmlToASTConverter.convert(html);
    expect(doc.blocks).toHaveLength(1);

    const p = doc.blocks[0] as ParagraphNode;
    expect(p.type).toBe('paragraph');
    expect(p.styleOverride?.alignment).toBe('justify');
    expect(p.content.length).toBeGreaterThanOrEqual(4);

    const boldText = p.content.find(c => c.type === 'text' && (c as TextNode).text === 'жирный') as TextNode | undefined;
    expect(boldText?.marks).toEqual([{ type: 'bold' }]);

    const boldItalicText = p.content.find(c => c.type === 'text' && (c as TextNode).text === 'жирный курсив') as TextNode | undefined;
    expect(boldItalicText?.marks).toEqual(expect.arrayContaining([{ type: 'bold' }, { type: 'italic' }]));

    const linkText = p.content.find(c => c.type === 'text' && (c as TextNode).text === 'Ссылка') as TextNode | undefined;
    expect(linkText?.marks).toEqual([{ type: 'link', href: 'https://example.com' }]);
  });

  it('3. Парсит заголовки h1..h6, цитаты, списки и разделители сцен * * *', () => {
    const html = `
      <h2>Глава 1. Начало</h2>
      <p>Обычный абзац.</p>
      <p>* * *</p>
      <blockquote><p>Мудрая мысль.</p></blockquote>
      <ul>
        <li>Элемент 1</li>
        <li>Элемент 2</li>
      </ul>
    `;

    const doc = LegacyHtmlToASTConverter.convert(html);
    expect(doc.blocks).toHaveLength(5);

    expect(doc.blocks[0].type).toBe('heading');
    expect((doc.blocks[0] as HeadingNode).level).toBe(2);

    expect(doc.blocks[1].type).toBe('paragraph');

    expect(doc.blocks[2].type).toBe('scene_break');

    expect(doc.blocks[3].type).toBe('quote');
    const quote = doc.blocks[3] as QuoteNode;
    expect(quote.content).toHaveLength(1);
    const quoteP = quote.content[0] as ParagraphNode;
    expect((quoteP.content[0] as TextNode).text).toBe('Мудрая мысль.');

    expect(doc.blocks[4].type).toBe('list');
    const list = doc.blocks[4] as ListNode;
    expect(list.variant).toBe('bullet');
    expect(list.items).toHaveLength(2);
  });

  it('4. Парсит таблицы с ячейками и шапками', () => {
    const html = `
      <table>
        <tr><th>Параметр</th><th>Значение</th></tr>
        <tr><td>Скорость</td><td>100 км/ч</td></tr>
      </table>
    `;

    const doc = LegacyHtmlToASTConverter.convert(html);
    expect(doc.blocks).toHaveLength(1);

    const table = doc.blocks[0] as TableNode;
    expect(table.type).toBe('table');
    expect(table.rows).toHaveLength(2);
    expect(table.rows[0].isHeader).toBe(true);
    expect(table.rows[1].isHeader).toBe(false);
  });

  it('covers empty HTML, headings, scene breaks, alignment, lists, blockquotes, hr, fallback div, and inline marks', () => {
    const emptyDoc = LegacyHtmlToASTConverter.convert('   ', { title: '' });
    expect(emptyDoc.metadata.title).toBe('Без названия');
    expect(emptyDoc.blocks).toHaveLength(1);

    const noBlocksDoc = LegacyHtmlToASTConverter.convert('<div></div>');
    expect(noBlocksDoc.blocks).toHaveLength(1);

    const richHtml = `
      <h2 id="h2-1">Заголовок</h2>
      <p>* * *</p>
      <p style="text-align: center">Центр</p>
      <ul><li>Пункт</li></ul>
      <ol><li>Номер</li></ol>
      <blockquote><p>Цитата в p</p></blockquote>
      <blockquote>Прямая цитата</blockquote>
      <hr />
      <div>Фоллбэк <b>жирный</b> <i>курсив</i> <u>подчерк</u> <s>зачерк</s> <code>код</code> <sub>2</sub> <sup>3</sup> <a href="https://a.b" title="t">ссылка</a> <span style="color: red; background-color: yellow; font-family: serif">стиль</span> <span class="entity-mention" data-entity-id="e1" data-entity-type="location">Город</span></div>
    `;
    const doc = LegacyHtmlToASTConverter.convert(richHtml);
    expect(doc.blocks.some((b) => b.type === 'heading' && b.level === 2)).toBe(true);
    expect(doc.blocks.filter((b) => b.type === 'scene_break')).toHaveLength(2);
    expect(doc.blocks.some((b) => b.type === 'list' && b.variant === 'ordered')).toBe(true);
    expect(doc.blocks.filter((b) => b.type === 'quote')).toHaveLength(2);
  });
});
