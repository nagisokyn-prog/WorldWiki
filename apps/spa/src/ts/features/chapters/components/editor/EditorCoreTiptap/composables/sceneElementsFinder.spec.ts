import { describe, it, expect } from 'vitest';
import { findSceneElements } from './sceneElementsFinder';

describe('sceneElementsFinder', () => {
  it('returns [] for empty editorDom', () => {
    const div = document.createElement('div');
    expect(findSceneElements(div, 'quote')).toEqual([]);
  });

  it('matches explicit blockIds via data-block-id / data-id and para-N fallback', () => {
    const dom = document.createElement('div');
    dom.innerHTML = `
      <p data-block-id="blk_101">Первый абзац текста</p>
      <p data-id="blocks:b202">Второй абзац текста</p>
      <p>Третий абзац с длинным текстом для поиска</p>
      <p>Четвёртый финальный абзац сцены</p>
    `;

    expect(findSceneElements(dom, undefined, undefined, undefined, ['blk_101'])).toHaveLength(1);
    expect(findSceneElements(dom, undefined, undefined, undefined, ['blocks:b202'])).toHaveLength(1);

    // para-N without quote returns matching paragraphs directly
    const byPara = findSceneElements(dom, '', undefined, undefined, ['para-2', 'para-2', 'para-4']);
    expect(byPara).toHaveLength(2);
  });

  it('matches by blockId, quote anchors, paragraphIndex, and multi-paragraph span', () => {
    const dom = document.createElement('div');
    dom.innerHTML = `
      <p data-block-id="b1">Начало длинной сцены которая продолжается дальше в тексте</p>
      <p data-block-id="b2">Середина сцены с диалогом</p>
      <p data-block-id="b3">Конец длинной сцены и финальная реплика героя</p>
    `;

    // Match by blockId with prefix
    expect(findSceneElements(dom, undefined, 'blocks:prefix_b2')).toHaveLength(1);

    // Match multi-paragraph quote across b1..b3 using long >45 char first/last lines
    const multiQuote =
      'Начало длинной сцены которая продолжается дальше в тексте\nКонец длинной сцены и финальная реплика героя';
    const multiEls = findSceneElements(dom, multiQuote);
    expect(multiEls).toHaveLength(3);

    // Fallback to para-N in blockId & expectedSpan when endAnchor not found
    const spanEls = findSceneElements(dom, 'Несуществующий финал\nЕщё строка', 'para-1', undefined, ['para-1', 'para-2']);
    expect(spanEls).toHaveLength(2);

    // Fallback to paragraphIndex when quote/blockId don't match
    const byIdx = findSceneElements(dom, 'совсем другой текст', undefined, 2);
    expect(byIdx).toHaveLength(1);

    // Out-of-range / no match returns []
    expect(findSceneElements(dom, 'нет такого', undefined, 0)).toEqual([]);
  });

  it('does not truncate multi-paragraph scene when only one block has matching data-block-id', () => {
    const dom = document.createElement('div');
    dom.innerHTML = `
      <p>Эпиграф</p>
      <p>Автор</p>
      <p></p>
      <p></p>
      <p>— Эй, Лёша, может уже постучишься?</p>
      <p>— Успокойся, Ника, дай ему время.</p>
      <p>— Да-да, как скажешь, мамочка.</p>
      <p>— Так, сестра, хватит выкаблучиваться.</p>
      <p data-block-id="para-9">— Да не бузи ты так.</p>
    `;

    const els = findSceneElements(
      dom,
      '— Эй, Лёша, может уже постучишься?\n— Да не бузи ты так.',
      'para-5',
      5,
      ['para-5', 'para-6', 'para-7', 'para-8', 'para-9']
    );
    expect(els).toHaveLength(5);
    expect(els[0].textContent).toContain('Лёша');
    expect(els[4].textContent).toContain('Да не бузи ты так.');
  });
});
