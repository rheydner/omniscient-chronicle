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
  Search,
  Skull,
  X,
} from 'lucide-react';
import { auth } from '@/lib/firebase';
import { pingSupabaseKeepAlive } from '@/lib/storage';
import { buildWorldClockPayload } from '@/lib/utils';
import { stopVTTProjection } from '@/lib/chronicle-actions';
import { useChronicleSync } from '@/hooks/useChronicleSync';
import { useChronicleStore, useEffectiveGM } from '@/store/useChronicleStore';
import { CommandPaletteModal } from '@/components/shared/CommandPaletteModal';
import { FloatingSheetViewerModal } from '@/components/shared/FloatingSheetViewerModal';
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
  { id: 'journal', label: 'Diário & Cartas', icon: FileText },
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

  const setRoomContext = useChronicleStore((s) => s.setRoomContext);
  const setActiveTab = useChronicleStore((s) => s.setActiveTab);
  const setCommandPaletteOpen = useChronicleStore((s) => s.setCommandPaletteOpen);
  const toggleSimulatingPlayer = useChronicleStore((s) => s.toggleSimulatingPlayer);

  const isGM = useEffectiveGM();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-[#0b0d10] text-[#ece8df]">
      {/* Top Archival Bar */}
      <header className="h-13 shrink-0 px-3.5 border-b border-[#222834] bg-[#0e1116] flex items-center justify-between gap-2 select-none">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((p) => !p)}
            className="md:hidden p-1.5 rounded-lg bg-[#13171e] border border-[#222834] text-[#ece8df] cursor-pointer"
            aria-label="Abrir navegação"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#13171e] border border-[#313a4b] flex items-center justify-center text-[#d4a359] shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <div className="leading-tight hidden sm:block">
              <div className="text-xs font-bold tracking-tight text-[#ece8df]">
                Omniscient Chronicle
              </div>
              <div className="text-[10px] font-mono text-[#6f6b62]">
                SALA: {roomId.toUpperCase()}
              </div>
            </div>
          </div>

          {/* Live World Clock Pill */}
          <button
            type="button"
            onClick={() => setActiveTab('calendar')}
            className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-lg bg-[#13171e] border border-[#222834] hover:border-[#d4a359] text-xs transition-colors cursor-pointer ml-2"
            title="Abrir Calendário & Fases Lunares"
          >
            <Calendar className="w-3.5 h-3.5 text-[#d4a359]" />
            <span className="font-medium text-[#ece8df]">{worldClock.dateLabel}</span>
            <span className="text-[#6f6b62]">·</span>
            <span className="font-mono text-[11px] text-[#a5a095] truncate max-w-52">
              {worldClock.moonSummary}
            </span>
          </button>
        </div>

        {/* Right Controls: Search Ctrl+K, Active VTT Projection, GM Player-View Simulator, Ecosystem */}
        <div className="flex items-center gap-2">
          {/* Active VTT Projection Indicator */}
          {isGM && activeHandout?.active && (
            <button
              type="button"
              onClick={() => void stopVTTProjection(roomId)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#c94a4a]/20 border border-[#c94a4a] text-xs font-mono text-[#ece8df] cursor-pointer"
              title="Encerrar projeção ativa na tela do StarStream VTT"
            >
              <MonitorX className="w-3.5 h-3.5 text-[#c94a4a]" />
              <span className="hidden sm:inline">VTT: {activeHandout.title}</span>
            </button>
          )}

          {/* Global Search Ctrl+K */}
          <button
            type="button"
            onClick={() => setCommandPaletteOpen(true)}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#13171e] border border-[#222834] hover:border-[#313a4b] text-xs text-[#a5a095] hover:text-[#ece8df] transition-colors cursor-pointer"
          >
            <Search className="w-3.5 h-3.5 text-[#d4a359]" />
            <span className="hidden sm:inline">Buscar...</span>
            <kbd className="hidden md:inline px-1.5 py-0.5 text-[10px] font-mono rounded bg-[#0b0d10] border border-[#222834] text-[#6f6b62]">
              Ctrl+K
            </kbd>
          </button>

          {/* GM Simulate Player View Toggle */}
          {isActualGM && (
            <button
              type="button"
              onClick={toggleSimulatingPlayer}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                isSimulatingPlayer
                  ? 'bg-[#4fa3b8]/20 border-[#4fa3b8] text-[#7cc6d8]'
                  : 'bg-[#13171e] border-[#d4a359]/45 text-[#e2b56e]'
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
                className="hidden xl:flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#13171e] border border-[#222834] hover:border-[#4fa3b8] text-xs text-[#a5a095] hover:text-[#ece8df] transition-colors"
              >
                <span>Fichas</span>
                <ExternalLink className="w-3 h-3 text-[#4fa3b8]" />
              </a>

              <div className="hidden md:flex items-center gap-2 pl-2 border-l border-[#222834]">
                <span className="text-xs text-[#a5a095] truncate max-w-28">
                  {userDisplayName || userEmail}
                </span>
                <button
                  type="button"
                  onClick={() => void signOut(auth)}
                  className="p-1.5 rounded-lg text-[#6f6b62] hover:text-[#c94a4a] hover:bg-[#13171e] cursor-pointer"
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
            mobileMenuOpen ? 'fixed inset-y-13 left-0 z-40 flex' : 'hidden md:flex'
          } ${
            isEmbeddedVTT ? 'w-44' : 'w-52'
          } shrink-0 flex-col justify-between bg-[#0e1116] border-r border-[#222834] p-2.5 select-none`}
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
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#191e27] text-[#ece8df] font-bold'
                      : 'text-[#a5a095] hover:text-[#ece8df] hover:bg-[#13171e] font-medium'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      active ? 'text-[#d4a359]' : 'text-[#6f6b62]'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="pt-2.5 border-t border-[#222834] px-2 text-[11px] font-mono text-[#6f6b62] flex items-center justify-between">
            <span>TAROT-RPG</span>
            <span className="text-[#4fa3b8]">SYNC LIVE</span>
          </div>
        </nav>

        {/* Active Module Workspace */}
        <div className="flex-1 min-w-0 min-h-0 overflow-hidden">
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
        <div className="fixed bottom-4 right-4 z-[9998] px-4 py-2.5 rounded-xl bg-[#13171e] border border-[#d4a359] text-xs font-medium text-[#ece8df]">
          {toastMessage}
        </div>
      )}

      {/* Global Modals */}
      <CommandPaletteModal />
      <FloatingSheetViewerModal />
    </div>
  );
}
