import { ref } from 'vue';

export interface AppDialogOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isAlert?: boolean;
}

interface DialogState {
  isOpen: boolean;
  options: AppDialogOptions;
  resolve: ((value: boolean) => void) | null;
}

const state = ref<DialogState>({
  isOpen: false,
  options: { message: '' },
  resolve: null,
});

export const useAppDialog = () => {
  const showDialog = (options: AppDialogOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      state.value = {
        isOpen: true,
        options: {
          title: options.title || 'Внимание',
          message: options.message,
          confirmText: options.confirmText || 'ОК',
          cancelText: options.cancelText || 'Отмена',
          isAlert: options.isAlert || false,
        },
        resolve,
      };
    });
  };

  const confirm = () => {
    if (state.value.resolve) {
      state.value.resolve(true);
    }
    state.value.isOpen = false;
  };

  const cancel = () => {
    if (state.value.resolve) {
      state.value.resolve(false);
    }
    state.value.isOpen = false;
  };

  return {
    state,
    showDialog,
    confirm,
    cancel,
  };
};

export const appConfirm = (message: string, title?: string): Promise<boolean> => {
  const { showDialog } = useAppDialog();
  return showDialog({ message, title, isAlert: false });
};

export const appAlert = (message: string, title?: string): Promise<boolean> => {
  const { showDialog } = useAppDialog();
  return showDialog({ message, title, isAlert: true });
};

