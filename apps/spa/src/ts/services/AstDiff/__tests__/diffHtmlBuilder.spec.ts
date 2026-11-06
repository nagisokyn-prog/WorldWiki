import { describe, it, expect } from 'vitest';
import { buildDiffHtml } from '../diffHtmlBuilder';

describe('diffHtmlBuilder (VS Code Unified Block Diff)', () => {
  it('returns target HTML untouched if base and target are identical', () => {
    const html = '<p>Текст главы без изменений</p>';
    expect(buildDiffHtml(html, html)).toBe(html);
  });

  it('handles empty inputs cleanly', () => {
    expect(buildDiffHtml('', '')).toBe('');
    expect(buildDiffHtml('', '<p>Новый блок</p>')).toContain('diff-block-ins');
    expect(buildDiffHtml('<p>Старый блок</p>', '')).toContain('diff-block-del');
  });

  it('marks purely inserted blocks with diff-block-ins', () => {
    const base = '<p>Первый абзац</p>';
    const target = '<p>Первый абзац</p>\n<p>Второй новый абзац</p>';

    const diff = buildDiffHtml(base, target);
    expect(diff).toContain('<p>Первый абзац</p>');
    expect(diff).toContain('class="diff-block-ins"');
    expect(diff).toContain('Второй новый абзац');
  });

  it('marks purely deleted blocks with diff-block-del', () => {
    const base = '<p>Первый абзац</p>\n<p>Удалённый абзац</p>';
    const target = '<p>Первый абзац</p>';

    const diff = buildDiffHtml(base, target);
    expect(diff).toContain('<p>Первый абзац</p>');
    expect(diff).toContain('class="diff-block-del"');
    expect(diff).toContain('Удалённый абзац');
  });

  it('shows modified paragraph: old on top with diff-block-mod-del, new below with diff-block-mod-ins', () => {
    const base = '<p>я пришёл домой</p>';
    const target = '<p>я пришёл домой, где все?</p>';

    const diff = buildDiffHtml(base, target);
    const lines = diff.split('\n');

    expect(lines.length).toBe(2);
    expect(lines[0]).toContain('diff-block-mod-del');
    expect(lines[0]).toContain('я пришёл домой');
    expect(lines[1]).toContain('diff-block-mod-ins');
    expect(lines[1]).toContain('я пришёл домой, где все?');
  });

  it('correctly sequences unchanged, modified, and inserted paragraphs', () => {
    const base = '<p>Глава 1</p>\n<p>Старый текст</p>\n<p>Конец главы</p>';
    const target = '<p>Глава 1</p>\n<p>Обновлённый текст</p>\n<p>Совершенно новый абзац</p>\n<p>Конец главы</p>';

    const diff = buildDiffHtml(base, target);
    expect(diff).toContain('<p>Глава 1</p>');
    expect(diff).toContain('diff-block-mod-del');
    expect(diff).toContain('Старый текст');
    expect(diff).toContain('diff-block-mod-ins');
    expect(diff).toContain('Обновлённый текст');
    expect(diff).toContain('diff-block-ins');
    expect(diff).toContain('Совершенно новый абзац');
    expect(diff).toContain('<p>Конец главы</p>');
  });
});
