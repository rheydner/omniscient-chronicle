'use client';

import React from 'react';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { BookOpen, Loader2 } from 'lucide-react';
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
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-zinc-950 text-zinc-100 gap-3">
        <Loader2 className="w-6 h-6 text-cyan-400 motion-safe:animate-spin" />
        <span className="text-xs font-mono text-zinc-400 tracking-wider uppercase">
          Sincronizando Omniscient Chronicle...
        </span>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="fixed inset-0 w-screen h-screen flex items-center justify-center bg-zinc-950 overflow-hidden select-none">
        {/* Subtle Tactical Grid Background */}
        <div
          className="absolute inset-0 z-0 opacity-[0.14]"
          style={{
            backgroundImage: 'radial-gradient(circle at center, #ffffff 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />

        {/* Ambient Cold Cyan Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-2xl h-[320px] bg-cyan-500/10 blur-[130px] rounded-full pointer-events-none" />

        {/* Minimalist Card */}
        <div className="relative z-10 w-full max-w-sm px-4">
          <div className="w-full p-8 bg-zinc-900/90 border border-zinc-800 rounded-2xl shadow-2xl backdrop-blur-xl flex flex-col items-center text-center">
            {/* Top Icon */}
            <div className="mb-5 flex items-center justify-center w-12 h-12 bg-zinc-950 border border-zinc-800 rounded-xl shadow-inner">
              <BookOpen className="w-6 h-6 text-cyan-400" />
            </div>

            {/* Typography */}
            <h1 className="text-2xl font-bold text-zinc-100 tracking-tight text-balance">
              Omniscient Chronicle
            </h1>
            <p className="text-zinc-400 text-xs mt-1.5 mb-7 text-pretty">
              Arquivo de Campanha & Documentos de Mundo
            </p>

            {/* Google Sign In Action */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-3 bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold py-3 px-4 rounded-xl transition-colors shadow-md active:scale-[0.98] cursor-pointer"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              <span>Entrar com Google</span>
            </button>

            <p className="text-[11px] text-zinc-500 mt-5 text-center leading-relaxed">
              Acesso sincronizado com StarStream VTT e Omniscient Sheet.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
