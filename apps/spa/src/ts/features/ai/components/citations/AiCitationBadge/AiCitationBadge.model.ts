import type { CitationItem } from '../AiCitation.model';

export type { CitationItem };

export interface AiCitationBadgeProps {
  citation: CitationItem;
}

export type AiCitationBadgeEmits = {
  (e: 'ask-source', citation: CitationItem): void;
};
