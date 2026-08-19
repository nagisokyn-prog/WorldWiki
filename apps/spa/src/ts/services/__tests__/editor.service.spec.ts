import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { editorService } from '../editor.service';

describe('editorService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    editorService.editor = null;
    editorService.cancelAutoSave();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Word & Character count', () => {
    it('calculates word count and char count based on editor content', () => {
      editorService.editor = {
        getMarkdown: vi.fn().mockReturnValue('Hello beautiful world! This is a test.'),
      };

      expect(editorService.getWordCount()).toBe(7);
      expect(editorService.getCharCount()).toBe(38);
    });

    it('returns 0 for empty content', () => {
      editorService.editor = {
        getMarkdown: vi.fn().mockReturnValue(''),
      };
      expect(editorService.getWordCount()).toBe(0);
      expect(editorService.getCharCount()).toBe(0);
    });
  });

  describe('Content & Text manipulation', () => {
    it('sets and gets markdown content', () => {
      const setMarkdown = vi.fn();
      editorService.editor = {
        getMarkdown: vi.fn().mockReturnValue('# Heading'),
        setMarkdown,
      };

      expect(editorService.getContent()).toBe('# Heading');

      editorService.setContent('New Text');
      expect(setMarkdown).toHaveBeenCalledWith('New Text');
    });

    it('inserts and replaces text', () => {
      const insertText = vi.fn();
      const replaceSelection = vi.fn();
      const getSelectedText = vi.fn().mockReturnValue('selected text');

      editorService.editor = {
        insertText,
        replaceSelection,
        getSelectedText,
      };

      editorService.insertText('Inserted');
      expect(insertText).toHaveBeenCalledWith('Inserted');

      editorService.replaceSelection('Replaced');
      expect(replaceSelection).toHaveBeenCalledWith('Replaced');

      expect(editorService.getSelectedText()).toBe('selected text');
    });
  });

  describe('Mode switching', () => {
    it('switches mode via changeMode or setMode', () => {
      const changeMode = vi.fn();
      editorService.editor = {
        changeMode,
        getCurrentMode: vi.fn().mockReturnValue('markdown'),
      };

      editorService.switchMode('wysiwyg');
      expect(changeMode).toHaveBeenCalledWith('wysiwyg');
      expect(editorService.getCurrentMode()).toBe('markdown');
    });
  });

  describe('Auto-save scheduling', () => {
    it('schedules autoSave and cancels if requested', () => {
      const saveCallback = vi.fn();

      editorService.autoSave(saveCallback, 1000);
      vi.advanceTimersByTime(500);
      expect(saveCallback).not.toHaveBeenCalled();

      editorService.autoSave(saveCallback, 1000); // Resets timeout
      vi.advanceTimersByTime(1000);
      expect(saveCallback).toHaveBeenCalledTimes(1);

      editorService.autoSave(saveCallback, 1000);
      editorService.cancelAutoSave();
      vi.advanceTimersByTime(2000);
      expect(saveCallback).toHaveBeenCalledTimes(1); // Not called again
    });
  });
});
