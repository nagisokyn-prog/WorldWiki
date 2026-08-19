import { describe, it, expect, beforeEach, vi } from 'vitest';
import { footnoteService } from '../footnote.service';

describe('footnoteService', () => {
  beforeEach(() => {
    footnoteService.footnotes = {};
    footnoteService.counter = 1;
    footnoteService.onUpdate = null;
  });

  describe('load & getFootnotes', () => {
    it('loads existing footnotes and sets counter to max ID + 1', () => {
      const existing = {
        1: { id: 1, text: 'Note 1', createdAt: '2024-01-01' },
        5: { id: 5, text: 'Note 5', createdAt: '2024-01-01' },
      };

      footnoteService.load(existing);
      expect(footnoteService.getFootnotes()).toEqual(existing);
      expect(footnoteService.counter).toBe(6);
    });

    it('loads empty footnotes object when undefined is passed', () => {
      footnoteService.load(undefined);
      expect(footnoteService.getFootnotes()).toEqual({});
      expect(footnoteService.counter).toBe(1);
    });
  });

  describe('add & remove', () => {
    it('adds footnote, increments counter and notifies listeners', () => {
      const updateListener = vi.fn();
      footnoteService.onUpdate = updateListener;

      const id = footnoteService.add('Important explanation');
      expect(id).toBe(1);
      expect(footnoteService.footnotes[1].text).toBe('Important explanation');
      expect(updateListener).toHaveBeenCalledWith(footnoteService.footnotes);

      const id2 = footnoteService.add('Second note');
      expect(id2).toBe(2);
    });

    it('removes existing footnote and returns true', () => {
      footnoteService.add('Note to remove');
      const removed = footnoteService.remove(1);

      expect(removed).toBe(true);
      expect(footnoteService.footnotes[1]).toBeUndefined();
    });

    it('returns false when trying to remove non-existent footnote', () => {
      expect(footnoteService.remove(999)).toBe(false);
    });
  });

  describe('Markdown helpers', () => {
    it('generates markdown footnote reference and body', () => {
      const md = footnoteService.generateMarkdown(3, 'Detailed footnote text');
      expect(md).toBe('[^3]\n\n[^3]: Detailed footnote text');
    });

    it('removes footnote references and definitions from markdown content', () => {
      const content = 'This is a sentence[^1] with footnote.\n\n[^1]: Footnote description here\nRemaining text.';
      const cleaned = footnoteService.removeFromMarkdown(content, 1);

      expect(cleaned).not.toContain('[^1]');
      expect(cleaned).not.toContain('Footnote description here');
      expect(cleaned).toContain('This is a sentence with footnote.');
      expect(cleaned).toContain('Remaining text.');
    });
  });
});
