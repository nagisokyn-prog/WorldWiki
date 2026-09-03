import type { WordLayoutDTO, WordSelectionDTO, WordStatsDTO } from '../types/dto';

export type WordVibeEventMap = {
  /* lifecycle */
  'mounted': void;
  'ready': void;
  'destroyed': void;
  /* data */
  'change': { html: string };
  'selection-change': WordSelectionDTO;
  'stats-change': WordStatsDTO;
  'layout-change': WordLayoutDTO;
  /* dialogs */
  'open-image-dialog': void;
  'open-table-picker': void;
  'open-link-dialog': void;
  'open-equation-dialog': void;
  'open-paragraph-dialog': void;
  'open-font-dialog': void;
  'open-page-setup': void;
  'open-header-footer-dialog': { tab?: 'header' | 'footer' };
  'open-entity': { type: string; id: string };
  'save-request': void;
};
