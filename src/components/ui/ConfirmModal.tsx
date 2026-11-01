'use client';

import React, { useEffect } from 'react';
import { useConfirmStore } from '@/store/useConfirmStore';
import { AlertTriangle, Info, Trash2, ShieldAlert, X } from 'lucide-react';

export function ConfirmModal() {
  const { isOpen, options, close } = useConfirmStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') close(false);
      if (e.key === 'Enter') close(true);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, close]);

  if (!isOpen) return null;

  const isDanger = options.variant === 'danger';
  const isWarning = options.variant === 'warning';

  const Icon = isDanger ? Trash2 : isWarning ? AlertTriangle : Info;
  const iconColor = isDanger
    ? 'text-red-400'
    : isWarning
    ? 'text-amber-400'
    : 'text-cyan-400';
  const bgIconColor = isDanger
    ? 'bg-red-500/10 border-red-500/30'
    : isWarning
    ? 'bg-amber-500/10 border-amber-500/30'
    : 'bg-cyan-500/10 border-cyan-500/30';
  const confirmButtonClass = isDanger
    ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-950/40'
    : isWarning
    ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-950/40'
    : 'bg-cyan-600 hover:bg-cyan-500 text-[#0b0d10] font-bold shadow-lg shadow-cyan-950/40';

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm select-none"
      onClick={() => close(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md overflow-hidden bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl transition-all"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-1">
          <div className="flex items-center gap-3">
            <div
              className={`flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-xl border ${bgIconColor}`}
            >
              <Icon className={`w-5 h-5 ${iconColor}`} />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-100 tracking-tight">
                {options.title || 'Confirmar Ação'}
              </h3>
              <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">
                {isDanger ? 'Atenção Necessária' : 'Confirmação de Ação'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => close(false)}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message */}
        <div className="px-6 py-4">
          <p className="text-sm text-zinc-300 leading-relaxed">
            {options.message}
          </p>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-4 bg-zinc-900/40 border-t border-zinc-800/80">
          <button
            type="button"
            onClick={() => close(false)}
            className="px-4 py-2 text-xs font-semibold text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors cursor-pointer"
          >
            {options.cancelLabel || 'Cancelar'}
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => close(true)}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all active:scale-[0.98] cursor-pointer ${confirmButtonClass}`}
          >
            {options.confirmLabel || 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}
