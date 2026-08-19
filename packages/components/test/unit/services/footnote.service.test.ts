// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { footnoteService } from '../../../src/ts/services/footnote.service';

describe('packages/components footnote.service', () => {
  beforeEach(() => {
    footnoteService.footnotes = {};
    footnoteService.counter = 1;
    footnoteService.onUpdate = null;
  });

  it('loads footnotes and adjusts counter', () => {
    footnoteService.load({
      1: { id: 1, text: 'Note 1', createdAt: '2024-01-01' },
      5: { id: 5, text: 'Note 5', createdAt: '2024-01-01' },
    });

    expect(footnoteService.counter).toBe(6);
    expect(Object.keys(footnoteService.getFootnotes()).length).toBe(2);
  });

  it('adds footnote and notifies callback', () => {
    const onUpdate = vi.fn();
    footnoteService.onUpdate = onUpdate;

    const id = footnoteService.add('New Footnote');
    expect(id).toBe(1);
    expect(footnoteService.footnotes[1].text).toBe('New Footnote');
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it('removes footnote by id', () => {
    footnoteService.add('First');
    expect(footnoteService.remove(1)).toBe(true);
    expect(footnoteService.remove(999)).toBe(false);
    expect(Object.keys(footnoteService.getFootnotes()).length).toBe(0);
  });

  it('generates and removes markdown tags', () => {
    const md = footnoteService.generateMarkdown(1, 'Explanation');
    expect(md).toBe('[^1]\n\n[^1]: Explanation');

    const content = 'Some text with footnote[^1] here.\n\n[^1]: Explanation\nMore text.';
    const cleaned = footnoteService.removeFromMarkdown(content, 1);
    expect(cleaned).not.toContain('[^1]');
    expect(cleaned).toContain('Some text with footnote here.');
  });
});
