import React, { Suspense } from 'react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { ChronicleAppShell } from '@/components/shell/ChronicleAppShell';

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 flex items-center justify-center bg-[#0b0d10] text-xs font-mono text-[#a5a095]">
          Carregando Omniscient Chronicle...
        </div>
      }
    >
      <AuthGuard>
        <ChronicleAppShell />
      </AuthGuard>
    </Suspense>
  );
}
