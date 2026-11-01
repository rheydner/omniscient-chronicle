'use client';

import React from 'react';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { BookOpen, Clock, FileLock2, GitFork, Loader2, Map as MapIcon } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { status, user } = useAuth();

  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error('[Chronicle Auth] Erro no login Google:', err);
      alert('Falha ao autenticar com o Google. Verifique se pop-ups estão permitidos.');
    }
  };

  if (status === 'pending') {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#0b0d10] text-[#ece8df] gap-3">
        <Loader2 className="w-6 h-6 text-[#d4a359] motion-safe:animate-spin" />
        <span className="text-xs font-mono text-[#a5a095] tracking-wider uppercase">
          Sincronizando Arquivo Omniscient...
        </span>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#0b0d10] px-4 py-10 select-none">
        <div className="w-full max-w-md bg-[#13171e] border border-[#222834] rounded-xl p-7 shadow-lg">
          <div className="flex items-center justify-between pb-4 mb-5 border-b border-[#222834]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#0e1116] border border-[#313a4b] flex items-center justify-center text-[#d4a359]">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-[#ece8df]">
                  Omniscient Chronicle
                </h1>
                <p className="text-xs text-[#a5a095]">
                  Arquivo de Mundo, Cronos & Dossiês Sincronizados
                </p>
              </div>
            </div>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#0e1116] border border-[#222834] text-[#d4a359]">
              TAROT-RPG
            </span>
          </div>

          <p className="text-xs text-[#a5a095] leading-relaxed mb-5">
            Entre com a mesma conta Google utilizada no <strong className="text-[#ece8df]">StarStream VTT</strong> e no{' '}
            <strong className="text-[#ece8df]">Omniscient Sheet</strong> para acessar cartas em sua posse, fichas conectadas, mapas e registros desbloqueados pelo Mestre.
          </p>

          <div className="grid grid-cols-2 gap-2.5 mb-6">
            <div className="p-2.5 rounded-lg bg-[#0e1116] border border-[#222834] flex items-center gap-2.5">
              <FileLock2 className="w-4 h-4 text-[#d4a359] shrink-0" />
              <span className="text-xs text-[#ece8df] font-medium">Dossiês & Tarjas Ao Vivo</span>
            </div>
            <div className="p-2.5 rounded-lg bg-[#0e1116] border border-[#222834] flex items-center gap-2.5">
              <GitFork className="w-4 h-4 text-[#d4a359] shrink-0" />
              <span className="text-xs text-[#ece8df] font-medium">Grafo & Genealogia</span>
            </div>
            <div className="p-2.5 rounded-lg bg-[#0e1116] border border-[#222834] flex items-center gap-2.5">
              <MapIcon className="w-4 h-4 text-[#d4a359] shrink-0" />
              <span className="text-xs text-[#ece8df] font-medium">Cartografia Regional</span>
            </div>
            <div className="p-2.5 rounded-lg bg-[#0e1116] border border-[#222834] flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-[#d4a359] shrink-0" />
              <span className="text-xs text-[#ece8df] font-medium">Cronos & Calendário</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-lg bg-[#d4a359] hover:bg-[#e2b56e] text-[#0b0d10] font-semibold text-xs transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#13171e"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#13171e"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#13171e"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#13171e"
              />
            </svg>
            <span>Autenticar com Conta Google</span>
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
