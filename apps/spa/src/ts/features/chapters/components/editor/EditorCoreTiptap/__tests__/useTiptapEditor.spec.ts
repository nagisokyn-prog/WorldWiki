import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref, defineComponent } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import { useTiptapEditor } from '../useTiptapEditor';
import * as api from '@/services/api.client';
import { settingsService, appAlert } from '@worldwiki/components';
import { openEntityEditorWindow } from '@/utils/windowManager';

let mockEditorInstance: any;
let editorOptions: any;

vi.mock('@tiptap/vue-3', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    useEditor: vi.fn((opts) => {
      editorOptions = opts;
      return ref(mockEditorInstance);
    }),
    VueNodeViewRenderer: vi.fn((comp) => comp),
    nodeViewProps: {},
  };
});

vi.mock('@worldwiki/components', () => ({
  settingsService: {
    getSettings: vi.fn(() => ({})),
    onChange: vi.fn(),
  },
  appAlert: vi.fn(),
}));

vi.mock('../../../../services/api.client', () => ({
  searchEntities: vi.fn(),
}));

vi.mock('../../../../utils/windowManager', () => ({
  openEntityEditorWindow: vi.fn(),
}));

vi.mock('../Semantic/SemanticParagraphNode.vue', () => ({
  default: { name: 'SemanticParagraphNode' },
}));

const TestComponent = defineComponent({
  props: ['content', 'project', 'title', 'hasUnsavedChanges', 'footnotesData', 'isLocked'],
  emits: ['update:content', 'update:title', 'change', 'scroll-change', 'save', 'openEntity'],
  setup(p, { emit: e }) {
    return { ...useTiptapEditor(p, e as (event: string, ...args: unknown[]) => void) };
  },
  template: '<div></div>',
});

describe('useTiptapEditor', () => {
  let props: any;
  let emit: any;
  let chainObj: any;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    localStorage.clear();

    Object.defineProperty(window, 'location', {
      value: { reload: vi.fn(), origin: 'http://localhost' },
      writable: true,
      configurable: true,
    });

    chainObj = {
      focus: vi.fn().mockReturnThis(),
      deleteRange: vi.fn().mockReturnThis(),
      insertContent: vi.fn().mockReturnThis(),
      run: vi.fn().mockReturnValue(true),
    };

    mockEditorInstance = {
      state: {
        selection: { anchor: 0, $from: { parent: { textBetween: () => '' }, parentOffset: 0 } },
        doc: { content: { size: 0 } },
      },
      getHTML: vi.fn(() => '<p>Test</p>'),
      getText: vi.fn(() => 'Test'),
      getJSON: vi.fn(() => ({ type: 'doc', content: [] })),
      commands: {
        setContent: vi.fn(),
        setHardBreak: vi.fn().mockReturnValue(true),
      },
      chain: vi.fn(() => chainObj),
      destroy: vi.fn(),
    };

    emit = vi.fn();
    props = {
      content: '<p>Chapter text</p>',
      project: 'proj_1',
      title: 'Chapter 1',
      hasUnsavedChanges: false,
      footnotesData: {},
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes and exports all required reactive state and methods', () => {
    const tiptap = useTiptapEditor(props, emit);

    expect(tiptap.editor).toBeDefined();
    expect(tiptap.editorUpdateKey).toBeDefined();
    expect(typeof tiptap.updateTitle).toBe('function');
    expect(typeof tiptap.handleScroll).toBe('function');
    expect(typeof tiptap.switchEditorMode).toBe('function');
  });

  it('triggers onUpdate callback from editor options', () => {
    useTiptapEditor(props, emit);
    expect(editorOptions).toBeDefined();

    editorOptions.onUpdate({ editor: mockEditorInstance });
    expect(emit).toHaveBeenCalledWith('update:content', '<p>Test</p>');
    expect(emit).toHaveBeenCalledWith('change');
  });

  it('handles updateTitle and handleScroll correctly', () => {
    const tiptap = useTiptapEditor(props, emit);

    const inputEvent = { target: { innerText: 'New Title', value: 'New Title' } } as any;
    tiptap.updateTitle(inputEvent);
    expect(emit).toHaveBeenCalledWith('update:title', 'New Title');
    expect(emit).toHaveBeenCalledWith('change');

    const scrollEvent = { target: { scrollTop: 150 } } as any;
    tiptap.handleScroll(scrollEvent);
    expect(emit).toHaveBeenCalledWith('scroll-change', 150);
  });

  describe('Keyboard shortcuts in EnterHandler', () => {
    it('executes Enter, Shift-Enter, Mod-q, and Mod-й commands', () => {
      useTiptapEditor(props, emit);
      const enterExt = editorOptions.extensions.find((ext: any) => ext.name === 'enterHandler');
      expect(enterExt).toBeDefined();

      const shortcuts = enterExt.config.addKeyboardShortcuts();

      // Enter
      expect(shortcuts.Enter()).toBe(false);

      // Shift-Enter
      const mockEd = { commands: { setHardBreak: vi.fn(() => true) } };
      expect(shortcuts['Shift-Enter']({ editor: mockEd })).toBe(true);
      expect(mockEd.commands.setHardBreak).toHaveBeenCalled();

      // Mod-q without matching pattern
      const dispatchSpy = vi.spyOn(document, 'dispatchEvent');
      const mockEdNoMatch = {
        state: {
          selection: { $from: { parent: { textBetween: () => 'normal text' }, parentOffset: 11 }, empty: true, from: 0, to: 0 },
        },
      };
      expect(shortcuts['Mod-q']({ editor: mockEdNoMatch })).toBe(true);

      // Mod-q with matching ((Entity)) pattern
      const mockEdMatch = {
        state: {
          selection: { $from: { parent: { textBetween: () => 'some ((Target))' }, parentOffset: 15 }, empty: true, from: 0, to: 0 },
        },
      };
      expect(shortcuts['Mod-q']({ editor: mockEdMatch })).toBe(true);
      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'ww:open-entity-selector' })
      );

      // Mod-й with matching pattern
      expect(shortcuts['Mod-й']({ editor: mockEdMatch })).toBe(true);
      expect(shortcuts['Mod-й']({ editor: mockEdNoMatch })).toBe(true);
    });
  });

  describe('SemanticParagraph attributes and node view', () => {
    it('configures semanticTag attribute and node view renderer', () => {
      useTiptapEditor(props, emit);
      const semanticExt = editorOptions.extensions.find((ext: any) => ext.name === 'paragraph');
      expect(semanticExt).toBeDefined();

      const attrs = semanticExt.config.addAttributes();
      expect(attrs.semanticTag.default).toBe('desc');

      const mockEl = { getAttribute: vi.fn(() => 'dialogue') };
      expect(attrs.semanticTag.parseHTML(mockEl)).toBe('dialogue');

      expect(attrs.semanticTag.renderHTML({ semanticTag: 'action' })).toEqual({
        'data-semantic-tag': 'action',
      });

      const nodeView = semanticExt.config.addNodeView();
      expect(nodeView).toBeDefined();
    });
  });

  describe('Lifecycle and Global Events in mounted wrapper', () => {
    it('manages autoSave with settings change and saves when dirty', async () => {
      let settingsCb: any;
      (settingsService.onChange as any).mockImplementation((cb: any) => {
        settingsCb = cb;
      });

      const wrapper = mount(TestComponent, {
        props: { ...props, hasUnsavedChanges: true },
      });
      await flushPromises();

      if (settingsCb) {
        settingsCb({ editor: { autoSaveInterval: 2 } });
      }

      vi.advanceTimersByTime(2000);
      expect(wrapper.emitted('save')).toBeDefined();

      wrapper.unmount();
    });

    it('handles document keydown / keyup for Ctrl and reload', async () => {
      const reloadMock = vi.fn();
      Object.defineProperty(window, 'location', {
        value: { reload: reloadMock, origin: 'http://localhost' },
        writable: true,
        configurable: true,
      });

      const wrapper = mount(TestComponent, { props });
      await flushPromises();
      const vm = wrapper.vm as any;

      // Ctrl keydown
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Control' }));
      expect(vm.ctrlPressed).toBe(true);

      // Keyup
      document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Control' }));
      expect(vm.ctrlPressed).toBe(false);

      // Window blur
      vm.ctrlPressed = true;
      window.dispatchEvent(new Event('blur'));
      expect(vm.ctrlPressed).toBe(false);

      // F5 save and reload
      const f5Event = new KeyboardEvent('keydown', { key: 'F5', cancelable: true });
      document.dispatchEvent(f5Event);
      expect(wrapper.emitted('save')).toBeDefined();
      vi.advanceTimersByTime(350);
      expect(reloadMock).toHaveBeenCalled();

      wrapper.unmount();
    });

    it('handles Ctrl+Alt+B toggle right panel shortcut', async () => {
      const dispatchSpy = vi.spyOn(document, 'dispatchEvent');
      const wrapper = mount(TestComponent, { props });
      await flushPromises();

      const shortcutEvent = new KeyboardEvent('keydown', {
        code: 'KeyB',
        ctrlKey: true,
        altKey: true,
        cancelable: true,
      });
      document.dispatchEvent(shortcutEvent);

      expect(localStorage.getItem('chapters-right-panel-visible')).toBe('true');
      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'ww:toggle-right-panel' })
      );

      wrapper.unmount();
    });

    it('handles ww:toggle-structure custom event', async () => {
      const wrapper = mount(TestComponent, { props });
      await flushPromises();
      const vm = wrapper.vm as any;

      localStorage.setItem('split-view-show-structure', 'false');
      document.dispatchEvent(new CustomEvent('ww:toggle-structure'));
      expect(vm.showStructure).toBe(false);

      wrapper.unmount();
    });

    it('handles ww:quick-link event with successful entity insertion', async () => {
      (api.searchEntities as any).mockResolvedValueOnce([
        { id: 'ent_1', entity_type: 'character', name: 'Hero' },
      ]);

      const wrapper = mount(TestComponent, { props });
      await flushPromises();

      document.dispatchEvent(
        new CustomEvent('ww:quick-link', {
          detail: { name: 'Hero', startPos: 5, endPos: 11 },
        })
      );

      await flushPromises();

      expect(api.searchEntities).toHaveBeenCalledWith('proj_1', 'Hero', null);
      expect(chainObj.deleteRange).toHaveBeenCalledWith({ from: 5, to: 11 });
      expect(chainObj.insertContent).toHaveBeenCalledWith('<a href="?type=character&id=ent_1">Hero</a>');

      wrapper.unmount();
    });

    it('handles ww:quick-link event when entity is not found or fails', async () => {
      (api.searchEntities as any).mockResolvedValueOnce([]);

      const wrapper = mount(TestComponent, { props });
      await flushPromises();

      document.dispatchEvent(
        new CustomEvent('ww:quick-link', {
          detail: { name: 'UnknownEntity', startPos: 0, endPos: 5 },
        })
      );

      await flushPromises();

      expect(appAlert).toHaveBeenCalledWith('Сущность "UnknownEntity" не найдена.');
      wrapper.unmount();
    });

    describe('Link click navigation', () => {
      it('handles clicking on ui_editor.html entity link', async () => {
        vi.useRealTimers();
        const wrapper = mount(TestComponent, { props });
        await flushPromises();

        const a = document.createElement('a');
        a.setAttribute('href', 'ui_editor.html?project=demo&type=item&id=sword_1');
        a.textContent = 'Excalibur';
        document.body.appendChild(a);

        const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true });
        a.dispatchEvent(clickEvent);

        await new Promise((r) => setTimeout(r, 50));
        await flushPromises();
        expect(openEntityEditorWindow).toHaveBeenCalledWith('demo', 'item', 'sword_1', 'Excalibur');
        document.body.removeChild(a);
        wrapper.unmount();
      });

      it('dispatches ww:open-entity-window on entity:// protocol link with Ctrl pressed', async () => {
        const dispatchSpy = vi.spyOn(document, 'dispatchEvent');
        const wrapper = mount(TestComponent, { props });
        await flushPromises();
        (wrapper.vm as any).ctrlPressed = true;

        const a = document.createElement('a');
        a.setAttribute('href', 'entity://location/castle_1');
        document.body.appendChild(a);

        const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
        a.dispatchEvent(clickEvent);

        expect(dispatchSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'ww:open-entity-window',
            detail: { type: 'location', id: 'castle_1' },
          })
        );
        document.body.removeChild(a);
        wrapper.unmount();
      });

      it('prevents click when Ctrl is not pressed for entity link', async () => {
        const wrapper = mount(TestComponent, { props });
        await flushPromises();

        const a = document.createElement('a');
        a.setAttribute('href', '?type=character&id=c1');
        document.body.appendChild(a);

        const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
        a.dispatchEvent(clickEvent);

        expect(clickEvent.defaultPrevented).toBe(true);
        document.body.removeChild(a);
        wrapper.unmount();
      });

      it('handles link click without Ctrl when not locked, data-href, and normal query links', async () => {
        const dispatchSpy = vi.spyOn(document, 'dispatchEvent');
        const wrapper = mount(TestComponent, { props });
        await flushPromises();

        // 1. Link with data-href
        const a1 = document.createElement('a');
        a1.setAttribute('data-href', '?type=item&id=it_1');
        document.body.appendChild(a1);
        a1.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true }));
        expect(dispatchSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'ww:open-entity-window',
            detail: { type: 'item', id: 'it_1' },
          })
        );
        document.body.removeChild(a1);

        // 2. Link with empty href
        const aEmpty = document.createElement('a');
        document.body.appendChild(aEmpty);
        aEmpty.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        document.body.removeChild(aEmpty);

        // 3. Normal non-entity link
        const aNormal = document.createElement('a');
        aNormal.setAttribute('href', 'https://google.com');
        aNormal.addEventListener('click', (e) => e.preventDefault());
        document.body.appendChild(aNormal);
        aNormal.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        document.body.removeChild(aNormal);

        // 4. Query link without Ctrl (locked -> preventDefault) and with Ctrl (triggers window open)
        const aQuery = document.createElement('a');
        aQuery.setAttribute('href', '?type=location&id=loc_1');
        document.body.appendChild(aQuery);

        const evNoCtrl = new MouseEvent('click', { bubbles: true, cancelable: true });
        aQuery.dispatchEvent(evNoCtrl);
        expect(evNoCtrl.defaultPrevented).toBe(true);

        const evCtrl = new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true });
        aQuery.dispatchEvent(evCtrl);
        expect(dispatchSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'ww:open-entity-window',
            detail: { type: 'location', id: 'loc_1' },
          })
        );
        document.body.removeChild(aQuery);

        wrapper.unmount();

        // 5. Unlocked link click (covers line 286: emit('openEntity'))
        const unlockedWrapper = mount(TestComponent, {
          props: { ...props, isLocked: false },
        });
        await flushPromises();

        const aUnlocked = document.createElement('a');
        aUnlocked.setAttribute('href', '?type=character&id=char_unlocked');
        document.body.appendChild(aUnlocked);
        aUnlocked.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        expect(unlockedWrapper.emitted('openEntity')).toBeDefined();
        expect(unlockedWrapper.emitted('openEntity')![0]).toEqual([{ type: 'character', id: 'char_unlocked' }]);
        document.body.removeChild(aUnlocked);
        unlockedWrapper.unmount();
      });
    });

    it('covers switchEditorMode, quickLink error catch, content and footnotesData watchers', async () => {
      // 1. switchEditorMode
      const tiptap = useTiptapEditor(props, emit);
      tiptap.switchEditorMode('markdown');

      // 2. quickLink error catch
      (api.searchEntities as any).mockRejectedValueOnce(new Error('Search failed'));
      const wrapper = mount(TestComponent, { props });
      await flushPromises();

      document.dispatchEvent(
        new CustomEvent('ww:quick-link', {
          detail: { name: 'FailEntity', startPos: 0, endPos: 5 },
        })
      );
      await flushPromises();
      expect(appAlert).toHaveBeenCalledWith('Ошибка при поиске сущности "FailEntity"');

      // 3. Watchers on content & footnotesData via reactive props (covers lines 132-135, 140)
      const { reactive, nextTick } = await import('vue');
      const reactiveP = reactive({
        content: '<p>Initial</p>',
        project: 'p1',
        title: 'T',
        hasUnsavedChanges: false,
        footnotesData: {},
      });
      const reactiveEmit = vi.fn();
      const tiptapReactive = useTiptapEditor(reactiveP, reactiveEmit);
      
      reactiveP.content = '<p>New Content Differs From GetHTML</p>';
      await nextTick();
      expect(mockEditorInstance.commands.setContent).toHaveBeenCalledWith('<p>New Content Differs From GetHTML</p>');

      reactiveP.content = '';
      await nextTick();

      reactiveP.footnotesData = { 'fn2': { text: 'New Footnote' } };
      await nextTick();
      expect(tiptapReactive.footnotes.value).toEqual({ 'fn2': { text: 'New Footnote' } });

      // 4. Ctrl+R reload keydown
      const rEvent = new KeyboardEvent('keydown', { key: 'r', ctrlKey: true, cancelable: true });
      document.dispatchEvent(rEvent);
      expect(wrapper.emitted('save')).toBeDefined();

      // 5. Link parse error & query without type/id
      const aBad = document.createElement('a');
      aBad.setAttribute('href', 'ui_editor.html?type=1&id=2');
      document.body.appendChild(aBad);
      const origURL = window.URL;
      (window as any).URL = vi.fn().mockImplementation(() => { throw new Error('Bad URL'); });
      aBad.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true }));
      (window as any).URL = origURL;
      document.body.removeChild(aBad);

      // Query without type/id
      const aNoTypeId = document.createElement('a');
      aNoTypeId.setAttribute('href', '?other=123');
      aNoTypeId.addEventListener('click', (e) => e.preventDefault());
      document.body.appendChild(aNoTypeId);
      aNoTypeId.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true }));
      document.body.removeChild(aNoTypeId);

      wrapper.unmount();
    });
  });
});
