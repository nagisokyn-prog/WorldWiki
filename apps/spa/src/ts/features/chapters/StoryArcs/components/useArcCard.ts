import { computed } from 'vue';
import type { RichPlotPromise, SceneArcItem } from '@/features/chapters/PromisesPanel/composables/PromiseActions.model';
import type { ArcCardProps, PhaseCounts } from './ArcCard.model';

export function useArcCard(props: ArcCardProps) {
  const getPhaseForBlock = (block: RichPlotPromise, arcId?: string | null): string => {
    let phase = block.arc_phase;
    if (Array.isArray(block.arcs) && block.arcs.length > 0 && arcId) {
      const cleanArcId = arcId.replace(/^story_arcs:/, '');
      const entry = block.arcs.find((a: SceneArcItem) => {
        const aid = String(a.arc_id || '').replace(/^story_arcs:/, '');
        return aid === cleanArcId || aid === arcId;
      });
      if (entry?.arc_phase) phase = entry.arc_phase;
    }
    return phase || 'setup';
  };

  const phaseCounts = computed<PhaseCounts>(() => {
    const counts: PhaseCounts = {
      setup: 0,
      escalation: 0,
      climax: 0,
      resolution: 0,
    };

    props.linkedBlocks.forEach(block => {
      const ph = getPhaseForBlock(block, props.arc.id);
      if (ph === 'setup') counts.setup++;
      else if (ph === 'escalation') counts.escalation++;
      else if (ph === 'climax') counts.climax++;
      else if (ph === 'resolution') counts.resolution++;
    });

    return counts;
  });

  const getPhaseInfo = (block: RichPlotPromise, arcId?: string | null) => {
    const phase = getPhaseForBlock(block, arcId);
    switch (phase) {
      case 'setup':
        return { label: '🌱 Завязка', class: 'phase-setup' };
      case 'escalation':
        return { label: '⚡ Эскалация', class: 'phase-escalation' };
      case 'climax':
        return { label: '🔥 Кульминация', class: 'phase-climax' };
      case 'resolution':
        return { label: '✅ Развязка', class: 'phase-resolution' };
      default:
        return { label: '🌱 Завязка', class: 'phase-default' };
    }
  };

  const getPromiseStatusLabel = (status: string) => {
    switch (status) {
      case 'planted':
        return '🌱 Заложено';
      case 'developed':
        return '⚡ Развитие';
      case 'resolved':
        return '✅ Разрешено';
      case 'abandoned':
        return '🛑 Отменено';
      default:
        return status;
    }
  };

  const formatChapterName = (chapterId: string) => {
    return chapterId.replace(/^chapters:/, 'Гл. ');
  };

  const getArcTypeLabel = (type?: string) => {
    switch (type) {
      case 'character':
        return 'Персонаж';
      case 'event':
        return 'Событие';
      case 'relationship':
        return 'Отношения';
      case 'theme':
        return 'Тематика';
      default:
        return type || 'Арка';
    }
  };

  const displayBlocks = computed(() => {
    return props.linkedBlocks.map((block) => {
      const phaseInfo = getPhaseInfo(block, props.arc.id);
      return {
        ...block,
        phaseClass: phaseInfo.class,
        phaseLabel: phaseInfo.label,
        formattedChapter: formatChapterName(block.chapter_id || ''),
        statusLabel: getPromiseStatusLabel(block.status),
      };
    });
  });

  return {
    phaseCounts,
    displayBlocks,
    getArcTypeLabel,
    getPhaseInfo,
    formatChapterName,
  };
}
