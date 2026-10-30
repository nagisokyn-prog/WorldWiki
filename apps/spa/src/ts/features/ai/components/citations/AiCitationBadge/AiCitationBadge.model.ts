import type { AiCitationBadgeProps, CitationItem } from '../AiCitation.model'

export interface AiCitationBadgeProps {}

export type AiCitationBadgeEmits = {
  (e: 'ask-source', citation: CitationItem): void;
};
