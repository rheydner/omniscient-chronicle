import { create } from 'zustand';

export interface ConfirmModalOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
}

interface ConfirmState {
  isOpen: boolean;
  options: ConfirmModalOptions;
  resolveRef: ((value: boolean) => void) | null;
  ask: (options: ConfirmModalOptions) => Promise<boolean>;
  close: (confirmed: boolean) => void;
}

const defaultOptions: ConfirmModalOptions = {
  title: 'Confirmar Ação',
  message: 'Tem certeza?',
  confirmLabel: 'Confirmar',
  cancelLabel: 'Cancelar',
  variant: 'info',
};

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  isOpen: false,
  options: defaultOptions,
  resolveRef: null,
  ask: (options: ConfirmModalOptions) => {
    return new Promise<boolean>((resolve) => {
      set({
        isOpen: true,
        options: { ...defaultOptions, ...options },
        resolveRef: resolve,
      });
    });
  },
  close: (confirmed: boolean) => {
    const { resolveRef } = get();
    if (resolveRef) {
      resolveRef(confirmed);
    }
    set({ isOpen: false, resolveRef: null });
  },
}));
