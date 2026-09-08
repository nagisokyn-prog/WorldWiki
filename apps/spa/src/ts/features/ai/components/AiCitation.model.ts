export interface CitationItem {
  index: number;
  evidence_id: string;
  page_id?: string;
  url: string;
  domain: string;
  title: string;
  claim_text?: string;
  excerpt: string;
}

export interface AiCitationBadgeProps {
  citation: CitationItem;
}

export interface AiCitationPopoverProps {
  citation: CitationItem;
  isOpen: boolean;
  anchorEl?: HTMLElement | null;
}

export interface AiCitationPopoverEmits {
  (e: 'close'): void;
  (e: 'ask-source', citation: CitationItem): void;
}
