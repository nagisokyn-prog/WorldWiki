import { computed } from 'vue';
import type { AiActionButtonsProps, AiActionButtonsEmits } from './AiActionButtons.model';

export function useAiActionButtons(
  props: AiActionButtonsProps,
  emit: AiActionButtonsEmits
) {
  const isVisible = computed(() => {
    return Boolean(props.isGenerating || props.hasError || props.canResume);
  });

  const handleCancel = () => {
    emit('cancel');
  };

  const handleUnloadModels = () => {
    emit('unload-models');
  };

  const handleRetry = () => {
    emit('retry');
  };

  const handleResume = () => {
    emit('resume');
  };

  return {
    isVisible,
    handleCancel,
    handleUnloadModels,
    handleRetry,
    handleResume
  };
}
