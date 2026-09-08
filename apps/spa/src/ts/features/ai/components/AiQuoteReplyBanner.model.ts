export interface AiQuoteReplyBannerProps {
  quotedText?: string | null;
  sourceMessageId?: string | null;
}

export interface AiQuoteReplyBannerEmits {
  (e: 'clear'): void;
}
