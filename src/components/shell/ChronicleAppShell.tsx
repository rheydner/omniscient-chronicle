'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { signOut } from 'firebase/auth';
import {
  BookOpen,
  Calendar,
  Clock,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  FolderSync,
  GitFork,
  Library,
  LogOut,
  Map as MapIcon,
  Menu,
  MonitorX,
  Network,
  RotateCcw,
  Search,
  Skull,
  X,
} from 'lucide-react';
import { auth } from '@/lib/firebase';
import { pingSupabaseKeepAlive } from '@/lib/storage';
import { buildWorldClockPayload } from '@/lib/utils';
import { purgeDemonstrationData, stopVTTProjection } from '@/lib/chronicle-actions';
import { useChronicleSync } from '@/hooks/useChronicleSync';
import { useChronicleStore, useEffectiveGM } from '@/store/useChronicleStore';
import { CommandPaletteModal } from '@/components/shared/CommandPaletteModal';
import { FloatingSheetViewerModal } from '@/components/shared/FloatingSheetViewerModal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useConfirmStore } from '@/store/useConfirmStore';
import { WikiModule } from '@/components/modules/WikiModule';
import { JournalModule } from '@/components/modules/JournalModule';
import { GraphModule } from '@/components/modules/GraphModule';
import { GenealogyModule } from '@/components/modules/GenealogyModule';
import { MapsModule } from '@/components/modules/MapsModule';
import { ChronosModule } from '@/components/modules/ChronosModule';
import { CalendarModule } from '@/components/modules/CalendarModule';
import { BestiaryModule } from '@/components/modules/BestiaryModule';
import { GrimoireModule } from '@/components/modules/GrimoireModule';
import { ObsidianModule } from '@/components/modules/ObsidianModule';
import type { ChronicleTabId } from '@/types/chronicle';

interface NavEntry {
  id: ChronicleTabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavEntry[] = [
  { id: 'wiki', label: 'Atlas & Wiki', icon: BookOpen },
  { id: 'journal', label: 'Diário & Documentos', icon: FileText },
  { id: 'graph', label: 'Grafo', icon: Network },
  { id: 'genealogy', label: 'Genealogia', icon: GitFork },
  { id: 'maps', label: 'Cartografia', icon: MapIcon },
  { id: 'chronos', label: 'Cronos', icon: Clock },
  { id: 'calendar', label: 'Calendário', icon: Calendar },
  { id: 'bestiary', label: 'Bestiário', icon: Skull },
  { id: 'grimoire', label: 'Grimório', icon: Library },
  { id: 'obsidian', label: 'Obsidian (.md)', icon: FolderSync },
];

export function ChronicleAppShell() {
  const searchParams = useSearchParams();

  const roomId = useChronicleStore((s) => s.roomId);
  const isEmbeddedVTT = useChronicleStore((s) => s.isEmbeddedVTT);
  const activeTab = useChronicleStore((s) => s.activeTab);
  const userDisplayName = useChronicleStore((s) => s.userDisplayName);
  const userEmail = useChronicleStore((s) => s.userEmail);
  const isActualGM = useChronicleStore((s) => s.isActualGM);
  const isSimulatingPlayer = useChronicleStore((s) => s.isSimulatingPlayer);
  const calendar = useChronicleStore((s) => s.calendar);
  const activeHandout = useChronicleStore((s) => s.activeHandout);
  const toastMessage = useChronicleStore((s) => s.toastMessage);
  const showToast = useChronicleStore((s) => s.showToast);

  const setRoomContext = useChronicleStore((s) => s.setRoomContext);
  const setActiveTab = useChronicleStore((s) => s.setActiveTab);
  const setCommandPaletteOpen = useChronicleStore((s) => s.setCommandPaletteOpen);
  const toggleSimulatingPlayer = useChronicleStore((s) => s.toggleSimulatingPlayer);

  const isGM = useEffectiveGM();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isPurging, setIsPurging] = useState(false);

  // Sync URL query params (`?embedded=vtt&room=global-room&tab=calendar`)
  useEffect(() => {
    const roomParam = searchParams.get('room') || 'global-room';
    const embeddedParam = searchParams.get('embedded') === 'vtt';
    const tabParam = searchParams.get('tab') as ChronicleTabId | null;

    setRoomContext(roomParam, embeddedParam);
    if (tabParam && NAV_ITEMS.some((n) => n.id === tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams, setRoomContext, setActiveTab]);

  // Activate live Firestore sync across Triad collections + Supabase Keep-Alive
  useChronicleSync(roomId, true);

  useEffect(() => {
    void pingSupabaseKeepAlive();
  }, []);

  // Zero-reload postMessage bridge when embedded inside StarStream VTT
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; tab?: ChronicleTabId } | null;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'CHRONICLE_SWITCH_TAB' && data.tab) {
        if (NAV_ITEMS.some((n) => n.id === data.tab)) {
          setActiveTab(data.tab);
        }
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [setActiveTab]);

  const worldClock = useMemo(() => buildWorldClockPayload(calendar), [calendar]);

  const handlePurgeDemo = async () => {
    const confirmed = await useConfirmStore.getState().ask({
      title: 'Limpar Dados de Exemplo',
      message:
        'Deseja realmente limpar todos os dados de demonstração (Lorde Valerius, Culto Carmim, etc.) desta sala? Esta ação é definitiva.',
      confirmLabel: 'Limpar Tudo',
      cancelLabel: 'Cancelar',
      variant: 'danger',
    });
    if (!confirmed) {
      return;
    }
    setIsPurging(true);
    try {
      await purgeDemonstrationData(roomId);
      showToast('Dados de teste removidos com sucesso.');
    } catch {
      showToast('Erro ao remover dados de teste.');
    } finally {
      setIsPurging(false);
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-zinc-950 text-zinc-100 antialiased selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Archival Bar */}
      <header className="h-12 shrink-0 px-3.5 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur flex items-center justify-between gap-2 select-none z-30">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((p) => !p)}
            className="md:hidden p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white cursor-pointer"
            aria-label="Abrir navegação"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-cyan-400 shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <div className="leading-tight hidden sm:block">
              <div className="text-xs font-semibold tracking-tight text-zinc-100">
                Omniscient Chronicle
              </div>
              <div className="text-[10px] font-mono text-zinc-500">
                SALA: {roomId.toUpperCase()}
              </div>
            </div>
          </div>

          {/* Live World Clock Pill */}
          <button
            type="button"
            onClick={() => setActiveTab('calendar')}
            className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-lg bg-zinc-900/80 border border-zinc-800 hover:border-cyan-500/40 text-xs transition-colors cursor-pointer ml-2"
            title="Abrir Calendário"
          >
            <Calendar className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-medium text-zinc-200">{worldClock.dateLabel}</span>
            {calendar.currentWeather && (
              <>
                <span className="text-zinc-600">·</span>
                <span className="text-zinc-400 truncate max-w-44 font-mono text-[11px]">
                  {calendar.currentWeather}
                </span>
              </>
            )}
          </button>
        </div>

        {/* Right Controls: Search Ctrl+K, Active VTT Projection, GM Player-View Simulator, Ecosystem */}
        <div className="flex items-center gap-2">
          {/* Active VTT Projection Indicator */}
          {isGM && activeHandout?.active && (
            <button
              type="button"
              onClick={() => void stopVTTProjection(roomId)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/40 text-xs font-mono text-red-300 hover:bg-red-500/20 cursor-pointer"
              title="Encerrar projeção ativa na tela do StarStream VTT"
            >
              <MonitorX className="w-3.5 h-3.5 text-red-400" />
              <span className="hidden sm:inline">VTT: {activeHandout.title}</span>
            </button>
          )}

          {/* Global Search Ctrl+K */}
          <button
            type="button"
            onClick={() => setCommandPaletteOpen(true)}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
          >
            <Search className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Buscar...</span>
            <kbd className="hidden md:inline px-1.5 py-0.5 text-[10px] font-mono rounded bg-zinc-950 border border-zinc-800 text-zinc-500">
              Ctrl+K
            </kbd>
          </button>

          {/* GM Purge Test Data Button */}
          {isGM && (
            <button
              type="button"
              onClick={handlePurgeDemo}
              disabled={isPurging}
              className="hidden lg:flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-red-500/40 text-zinc-400 hover:text-red-300 text-xs transition-colors cursor-pointer disabled:opacity-50"
              title="Limpar entidades e eventos demonstrativos pré-adicionados"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Limpar Testes</span>
            </button>
          )}

          {/* GM Simulate Player View Toggle */}
          {isActualGM && (
            <button
              type="button"
              onClick={toggleSimulatingPlayer}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                isSimulatingPlayer
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                  : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20'
              }`}
              title="Alternar entre Visão Total do Mestre e Simulação Fiel da Visão de Jogador"
            >
              {isSimulatingPlayer ? (
                <>
                  <Eye className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Visão Jogador (Simulada)</span>
                </>
              ) : (
                <>
                  <EyeOff className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Modo Mestre</span>
                </>
              )}
            </button>
          )}

          {/* Ecosystem Links (Hidden when already embedded inside StarStream VTT) */}
          {!isEmbeddedVTT && (
            <>
              <a
                href="https://omniscient-rpg.web.app"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden xl:flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-cyan-500/50 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                title="Abrir Omniscient ID (Fichas dos Operadores)"
              >
                <span>Omniscient ID</span>
                <ExternalLink className="w-3 h-3 text-cyan-400" />
              </a>

              <div className="hidden md:flex items-center gap-2 pl-2 border-l border-zinc-800">
                <span className="text-xs text-zinc-400 truncate max-w-28">
                  {userDisplayName || userEmail}
                </span>
                <button
                  type="button"
                  onClick={() => void signOut(auth)}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-900 cursor-pointer"
                  title="Sair da conta"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Body: Left Module Navigation + Active Workspace */}
      <div className="flex-1 flex min-h-0 relative">
        {/* Sidebar Navigation */}
        <nav
          className={`${
            mobileMenuOpen ? 'fixed inset-y-12 left-0 z-40 flex' : 'hidden md:flex'
          } ${
            isEmbeddedVTT ? 'w-44' : 'w-52'
          } shrink-0 flex-col justify-between bg-zinc-950 border-r border-zinc-800 p-2.5 select-none`}
        >
          <div className="space-y-1 overflow-y-auto custom-scrollbar">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
                    active
                      ? 'bg-cyan-950/40 text-cyan-300 font-semibold border border-cyan-500/30'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 font-medium'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      active ? 'text-cyan-400' : 'text-zinc-500'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="pt-2.5 border-t border-zinc-800/80 px-2 text-[10px] font-mono text-zinc-500 flex items-center justify-between">
            <span>TAROT-RPG</span>
            <span className="text-cyan-400">SYNC ATIVO</span>
          </div>
        </nav>

        {/* Active Module Workspace */}
        <div className="flex-1 min-w-0 min-h-0 overflow-hidden bg-zinc-950">
          {activeTab === 'wiki' && <WikiModule />}
          {activeTab === 'journal' && <JournalModule />}
          {activeTab === 'graph' && <GraphModule />}
          {activeTab === 'genealogy' && <GenealogyModule />}
          {activeTab === 'maps' && <MapsModule />}
          {activeTab === 'chronos' && <ChronosModule />}
          {activeTab === 'calendar' && <CalendarModule />}
          {activeTab === 'bestiary' && <BestiaryModule />}
          {activeTab === 'grimoire' && <GrimoireModule />}
          {activeTab === 'obsidian' && <ObsidianModule />}
        </div>
      </div>

      {/* Global Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-[9998] px-4 py-2.5 rounded-lg bg-zinc-900 border border-cyan-500/40 text-xs font-medium text-zinc-100 shadow-xl shadow-cyan-950/20">
          {toastMessage}
        </div>
      )}

      {/* Global Modals */}
      <CommandPaletteModal />
      <FloatingSheetViewerModal />
      <ConfirmModal />
    </div>
  );
}
