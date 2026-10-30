import type { AiQuoteReplyBannerEmits } from './AiQuoteReplyBanner.model';

export function useAiQuoteReplyBanner(emit: AiQuoteReplyBannerEmits) {
  const onClear = () => {
    emit('clear');
  };

  return {
    onClear
  };
}

