// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { editorService } from '../../../src/ts/services/editor.service';

describe('packages/components editor.service', () => {
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

    it('initializes editor with toastui factory', () => {
      const container = document.createElement('div');
      container.id = 'editor_box';
      document.body.appendChild(container);

      const mockOn = vi.fn();
      const mockEditorInstance = { on: mockOn };
      const mockFactory = vi.fn((config) => {
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
    });
  });

  describe('Content & Stats manipulation', () => {
    it('word and char count calculations', () => {
      editorService.editor = {
        getMarkdown: vi.fn().mockReturnValue('Hello beautiful components world!'),
      };

      expect(editorService.getWordCount()).toBe(4);
      expect(editorService.getCharCount()).toBe(33);
    });

    it('getContent and setContent', () => {
      const setMarkdown = vi.fn();
      editorService.editor = {
        getMarkdown: vi.fn().mockReturnValue('Text'),
        setMarkdown,
      };

      expect(editorService.getContent()).toBe('Text');
      editorService.setContent('Updated');
      expect(setMarkdown).toHaveBeenCalledWith('Updated');
    });

    it('text insertions and replacements', () => {
      const insertText = vi.fn();
      const replaceSelection = vi.fn();
      const getSelectedText = vi.fn().mockReturnValue('selected');

      editorService.editor = {
        insertText,
        replaceSelection,
        getSelectedText,
      };

      editorService.insertText('Inserted');
      expect(insertText).toHaveBeenCalledWith('Inserted');

      editorService.replaceSelection('Replaced');
      expect(replaceSelection).toHaveBeenCalledWith('Replaced');

      expect(editorService.getSelectedText()).toBe('selected');
    });

    it('mode switching and detection', () => {
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

      editorService.editor = {} as any;
      expect(editorService.getCurrentMode()).toBe('wysiwyg');
    });
  });

  describe('Auto-save', () => {
    it('schedules and cancels autoSave', () => {
      const cb = vi.fn();
      editorService.autoSave(cb, 1000);
      vi.advanceTimersByTime(1000);
      expect(cb).toHaveBeenCalledTimes(1);

      editorService.autoSave(cb, 1000);
      editorService.cancelAutoSave();
      vi.advanceTimersByTime(2000);
      expect(cb).toHaveBeenCalledTimes(1);
    });
  });
});
