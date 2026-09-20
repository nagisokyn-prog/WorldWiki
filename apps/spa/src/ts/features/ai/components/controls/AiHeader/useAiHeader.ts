import { ref } from 'vue';
import type { AiHeaderProps, AiHeaderEmits } from './AiHeader.model';

export function useAiHeader(
  _props: AiHeaderProps,
  emit: AiHeaderEmits
) {
  const currentMode = ref('chat');

  const setMode = (mode: string) => {
    currentMode.value = mode;
  };

  const handleOpenSettings = () => {
    emit('open-settings');
  };

  const handleDetach = () => {
    emit('detach');
  };

  const handleClose = () => {
    emit('close');
  };

  return {
    currentMode,
    setMode,
    handleOpenSettings,
    handleDetach,
    handleClose
  };
}
