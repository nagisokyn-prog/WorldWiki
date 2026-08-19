// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { editorService } from '../editor.service';

describe('editorService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '';
    editorService.editor = null;
    editorService.cancelAutoSave();
    delete (window as any).toastui;
    delete (window as any).editorInstance;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('init', () => {
    it('throws error if container element does not exist', () => {
      expect(() => editorService.init('missing_container')).toThrow(
        'Editor container #missing_container not found'
      );
    });

    it('initializes editor with toastui factory and binds onChange', () => {
      const container = document.createElement('div');
      container.id = 'editor_box';
      document.body.appendChild(container);

      const mockOn = vi.fn();
      const mockEditorInstance = { on: mockOn };
      const mockFactory = vi.fn((config) => {
        // Test addImageBlobHook inside config
        const callback = vi.fn();
        const blob = new Blob(['dummy'], { type: 'image/png' });
        config.hooks.addImageBlobHook(blob, callback);
        return mockEditorInstance;
      });

      (window as any).toastui = {
        Editor: {
          factory: mockFactory,
        },
      };

      const onChange = vi.fn();
      const instance = editorService.init('editor_box', { onChange });

      expect(mockFactory).toHaveBeenCalled();
      expect(mockOn).toHaveBeenCalledWith('change', onChange);
      expect(instance).toBe(mockEditorInstance);
      expect((window as any).editorInstance).toBe(mockEditorInstance);
    });
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

    it('handles missing editor safely during text manipulation', () => {
      editorService.editor = null;
      expect(editorService.getContent()).toBe('');
      expect(editorService.getSelectedText()).toBe('');
      expect(() => editorService.setContent('text')).not.toThrow();
      expect(() => editorService.insertText('text')).not.toThrow();
      expect(() => editorService.replaceSelection('text')).not.toThrow();
    });
  });

  describe('Mode switching', () => {
    it('switches mode via changeMode or setMode fallback', () => {
      const changeMode = vi.fn();
      editorService.editor = {
        changeMode,
        getCurrentMode: vi.fn().mockReturnValue('markdown'),
      };

      editorService.switchMode('wysiwyg');
      expect(changeMode).toHaveBeenCalledWith('wysiwyg');
      expect(editorService.getCurrentMode()).toBe('markdown');

      const setMode = vi.fn();
      editorService.editor = {
        setMode,
        isWysiwygMode: vi.fn().mockReturnValue(true),
      };
      editorService.switchMode('markdown');
      expect(setMode).toHaveBeenCalledWith('markdown');
      expect(editorService.getCurrentMode()).toBe('wysiwyg');

      editorService.editor = {
        isWysiwygMode: vi.fn().mockReturnValue(false),
      };
      expect(editorService.getCurrentMode()).toBe('markdown');

      editorService.editor = null;
      expect(editorService.getCurrentMode()).toBe('wysiwyg');
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
