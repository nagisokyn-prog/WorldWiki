import { useAiMessageList } from '../AiMessageList/useAiMessageList';

export function useAiMessageItem() {
  const {
    copyText,
    isErrorMessage,
    getAttachedSkills,
    getExtractedQuote,
    getCleanedContent,
    parseMessageContent
  } = useAiMessageList();

  return {
    copyText,
    isErrorMessage,
    getAttachedSkills,
    getExtractedQuote,
    getCleanedContent,
    parseMessageContent
  };
}

