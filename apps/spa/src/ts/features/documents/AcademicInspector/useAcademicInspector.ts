import { computed, ref } from 'vue';
import { useDocumentProfilesStore } from '@/stores/document_profiles.store';
import type { AcademicInspectorProps, InspectorItem, InspectorTab } from './AcademicInspector.model';

export function useAcademicInspector(props: AcademicInspectorProps) {
  const activeTab = ref<InspectorTab>('toc');
  const profilesStore = useDocumentProfilesStore();

  const headingsList = computed<InspectorItem[]>(() => {
    const list: InspectorItem[] = [];
    for (const block of props.document.blocks) {
      if (block.type === 'heading') {
        const text = block.content.map((c) => (c.type === 'text' ? c.text : '')).join('');
        const num = props.numberingContext.headings.get(block.id) || '';
        list.push({
          id: block.id,
          kind: 'heading',
          number: num,
          title: text || 'Без названия',
          level: block.level
        });
      }
    }
    return list;
  });

  const figuresList = computed<InspectorItem[]>(() => {
    const list: InspectorItem[] = [];
    for (const block of props.document.blocks) {
      if (block.type === 'figure') {
        const text = block.captionContent.map((c) => (c.type === 'text' ? c.text : '')).join('');
        const num = props.numberingContext.figures.get(block.id) || '';
        list.push({
          id: block.id,
          kind: 'figure',
          number: num,
          title: text || 'Без подписи'
        });
      }
    }
    return list;
  });

  const tablesList = computed<InspectorItem[]>(() => {
    const list: InspectorItem[] = [];
    for (const block of props.document.blocks) {
      if (block.type === 'table') {
        const text = block.captionContent.map((c) => (c.type === 'text' ? c.text : '')).join('');
        const num = props.numberingContext.tables.get(block.id) || '';
        list.push({
          id: block.id,
          kind: 'table',
          number: num,
          title: text || 'Без подписи'
        });
      }
    }
    return list;
  });

  const equationsList = computed<InspectorItem[]>(() => {
    const list: InspectorItem[] = [];
    for (const block of props.document.blocks) {
      if (block.type === 'equation') {
        const num = props.numberingContext.equations.get(block.id) || '';
        list.push({
          id: block.id,
          kind: 'equation',
          number: num,
          title: block.latex || 'формула'
        });
      }
    }
    return list;
  });

  function jumpToNode(id: string) {
    const el = document.querySelector(`[data-node-id="${id}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ww-target-highlight');
      setTimeout(() => {
        el.classList.remove('ww-target-highlight');
      }, 1500);
    }
  }

  function insertReference(item: InspectorItem) {
    if (!props.editor) return;

    let defaultLabel = item.number;
    if (item.kind === 'figure') defaultLabel = `Рисунок ${item.number}`;
    if (item.kind === 'table') defaultLabel = `Таблица ${item.number}`;
    if (item.kind === 'heading') defaultLabel = `раздел ${item.number}`;

    props.editor
      .chain()
      .focus()
      .insertContent({
        type: 'cross_reference',
        attrs: {
          targetId: item.id,
          kind: item.kind,
          displayMode: 'full',
          resolvedLabel: defaultLabel,
          isBroken: false
        }
      })
      .run();
  }

  function switchProfile(profileId: string) {
    profilesStore.setProfile(profileId);
  }

  return {
    activeTab,
    headingsList,
    figuresList,
    tablesList,
    equationsList,
    activeProfileId: computed(() => profilesStore.activeProfileId),
    allProfiles: computed(() => profilesStore.allProfiles),
    jumpToNode,
    insertReference,
    switchProfile
  };
}
