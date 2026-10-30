import { useAppDialog as useBaseAppDialog } from '../../ts/composables/useAppDialog';

export const useAppDialog = () => {
  const base = useBaseAppDialog();

  const handleOverlayClick = () => {
    base.cancel();
  };

  return {
    ...base,
    handleOverlayClick,
  };
};

