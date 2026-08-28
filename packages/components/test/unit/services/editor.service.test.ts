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

      // editor is null or missing optional methods
      editorService.editor = null;
      editorService.insertText('noop');
      editorService.replaceSelection('noop');
      expect(editorService.getSelectedText()).toBe('');
      editorService.setContent('');

      editorService.editor = {};
      editorService.insertText('noop');
      editorService.replaceSelection('noop');
      expect(editorService.getSelectedText()).toBe('');
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

      editorService.editor = null;
      editorService.switchMode('wysiwyg');
      expect(editorService.getCurrentMode()).toBe('wysiwyg');
    });
  });

  describe('Auto-save', () => {
    it('schedules, reschedules, and cancels autoSave', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();

      // 1. Double autoSave (rescheduling line 111)
      editorService.autoSave(cb1, 1000);
      editorService.autoSave(cb2, 1000);
      vi.advanceTimersByTime(1000);
      expect(cb1).not.toHaveBeenCalled();
      expect(cb2).toHaveBeenCalledTimes(1);

      // 2. cancelAutoSave when timer active
      editorService.autoSave(cb1, 1000);
      editorService.cancelAutoSave();
      vi.advanceTimersByTime(2000);
      expect(cb1).not.toHaveBeenCalled();

      // 3. cancelAutoSave when no timer active
      editorService.cancelAutoSave();
    });
  });

  describe('Window & Fallback bindings', () => {
    it('handles setContent with editor.setMarkdown and window.editorService (covers lines 62, 67, 135)', () => {
      const setMarkdown = vi.fn();
      editorService.editor = { setMarkdown };
      editorService.setContent('Hello Markdown');
      expect(setMarkdown).toHaveBeenCalledWith('Hello Markdown');

      // editor without getMarkdown
      editorService.editor = {};
      expect(editorService.getContent()).toBe('');

      // window.editorService
      expect((window as any).editorService).toBeDefined();
    });
  });
});
