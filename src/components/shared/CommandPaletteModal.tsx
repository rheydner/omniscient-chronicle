'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BookOpen,
  Clock,
  FileText,
  Library,
  Map as MapIcon,
  Search,
  Skull,
  User,
  X,
} from 'lucide-react';
import { useChronicleStore, useEffectiveGM } from '@/store/useChronicleStore';

interface SearchHit {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  icon: React.ReactNode;
  onSelect: () => void;
}

export function CommandPaletteModal() {
  const isOpen = useChronicleStore((s) => s.commandPaletteOpen);
  const setOpen = useChronicleStore((s) => s.setCommandPaletteOpen);
  const isGM = useEffectiveGM();
  const userUid = useChronicleStore((s) => s.userUid);
  const userEmail = useChronicleStore((s) => s.userEmail);

  const entities = useChronicleStore((s) => s.entities);
  const characters = useChronicleStore((s) => s.characters);
  const documents = useChronicleStore((s) => s.documents);
  const creatures = useChronicleStore((s) => s.creatures);
  const books = useChronicleStore((s) => s.books);
  const maps = useChronicleStore((s) => s.maps);
  const events = useChronicleStore((s) => s.events);

  const setActiveTab = useChronicleStore((s) => s.setActiveTab);
  const setSelectedEntityId = useChronicleStore((s) => s.setSelectedEntityId);
  const setSelectedDocumentId = useChronicleStore((s) => s.setSelectedDocumentId);
  const setSelectedCreatureId = useChronicleStore((s) => s.setSelectedCreatureId);
  const setSelectedBookId = useChronicleStore((s) => s.setSelectedBookId);
  const setSelectedMapId = useChronicleStore((s) => s.setSelectedMapId);
  const openFloatingSheet = useChronicleStore((s) => s.openFloatingSheet);

  const [query, setQuery] = useState('');

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(!useChronicleStore.getState().commandPaletteOpen);
      } else if (e.key === 'Escape' && useChronicleStore.getState().commandPaletteOpen) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setOpen]);

  const allHits = useMemo<SearchHit[]>(() => {
    const list: SearchHit[] = [];

    // 1. Wiki Entities
    Object.values(entities).forEach((e) => {
      if (!isGM && !e.isPublicToPlayers) return;
      list.push({
        id: `ent-${e.id}`,
        title: e.title,
        subtitle: e.subtitle || e.tags.join(', ') || 'Página do Atlas',
        badge: 'Atlas / Wiki',
        icon: <BookOpen className="w-4 h-4 text-cyan-400" />,
        onSelect: () => {
          setActiveTab('wiki');
          setSelectedEntityId(e.id);
        },
      });
    });

    // 2. Live Omniscient Sheet Characters
    Object.values(characters).forEach((c) => {
      list.push({
        id: `char-${c.id}`,
        title: c.name,
        subtitle: `${c.className || 'Personagem'} · Nv. ${c.level} · HP ${c.hp.current}/${c.hp.max}`,
        badge: 'Ficha Oficial',
        icon: <User className="w-4 h-4 text-cyan-400" />,
        onSelect: () => openFloatingSheet(c.id),
      });
    });

    // 3. Documents / Letters (respecting possession)
    Object.values(documents).forEach((d) => {
      const canSee =
        isGM ||
        d.possessionMode === 'party-public' ||
        (d.possessionMode === 'single-holder' &&
          ((userUid && d.holderUserId === userUid) ||
            (userEmail &&
              d.holderEmail &&
              d.holderEmail.toLowerCase() === userEmail.toLowerCase())));
      if (!canSee) return;
      list.push({
        id: `doc-${d.id}`,
        title: d.title,
        subtitle: d.code || 'Carta / Dossiê',
        badge: 'Diário & Cartas',
        icon: <FileText className="w-4 h-4 text-cyan-400" />,
        onSelect: () => {
          setActiveTab('journal');
          setSelectedDocumentId(d.id);
        },
      });
    });

    // 4. Bestiary
    Object.values(creatures).forEach((cr) => {
      if (!isGM && !cr.isKnownByPlayers) return;
      list.push({
        id: `cr-${cr.id}`,
        title: cr.name,
        subtitle: `${cr.threatGrade} · ${cr.creatureType}`,
        badge: 'Bestiário',
        icon: <Skull className="w-4 h-4 text-red-400" />,
        onSelect: () => {
          setActiveTab('bestiary');
          setSelectedCreatureId(cr.id);
        },
      });
    });

    // 5. Grimoire Books & Glossary Terms
    Object.values(books).forEach((b) => {
      if (!isGM && !b.isPublicToPlayers) return;
      list.push({
        id: `bk-${b.id}`,
        title: b.title,
        subtitle: b.subtitle || `${b.chapters.length} capítulo(s)`,
        badge: 'Grimório',
        icon: <Library className="w-4 h-4 text-cyan-400" />,
        onSelect: () => {
          setActiveTab('grimoire');
          setSelectedBookId(b.id);
        },
      });
      b.glossary.forEach((g) => {
        list.push({
          id: `gl-${b.id}-${g.id}`,
          title: g.term,
          subtitle: g.definition,
          badge: `Regra · ${g.category}`,
          icon: <Library className="w-4 h-4 text-zinc-400" />,
          onSelect: () => {
            setActiveTab('grimoire');
            setSelectedBookId(b.id);
          },
        });
      });
    });

    // 6. Maps
    Object.values(maps).forEach((m) => {
      if (!isGM && !m.isPublicToPlayers) return;
      list.push({
        id: `mp-${m.id}`,
        title: m.name,
        subtitle: `${m.pins.length} marcadores · Cartografia Regional`,
        badge: 'Mapa',
        icon: <MapIcon className="w-4 h-4 text-cyan-400" />,
        onSelect: () => {
          setActiveTab('maps');
          setSelectedMapId(m.id);
        },
      });
    });

    // 7. Chronos Events
    Object.values(events).forEach((ev) => {
      if (!isGM && !ev.isPublicToPlayers) return;
      list.push({
        id: `ev-${ev.id}`,
        title: ev.title,
        subtitle: `Ano ${ev.year} · ${ev.summary}`,
        badge: 'Cronos',
        icon: <Clock className="w-4 h-4 text-zinc-400" />,
        onSelect: () => setActiveTab('chronos'),
      });
    });

    return list;
  }, [
    entities,
    characters,
    documents,
    creatures,
    books,
    maps,
    events,
    isGM,
    userUid,
    userEmail,
    setActiveTab,
    setSelectedEntityId,
    setSelectedDocumentId,
    setSelectedCreatureId,
    setSelectedBookId,
    setSelectedMapId,
    openFloatingSheet,
  ]);

  if (!isOpen || typeof document === 'undefined') return null;

  const q = query.trim().toLowerCase();
  const filtered = q
    ? allHits.filter(
        (h) =>
          h.title.toLowerCase().includes(q) ||
          h.subtitle.toLowerCase().includes(q) ||
          h.badge.toLowerCase().includes(q)
      )
    : allHits.slice(0, 14);

  return createPortal(
    <div
      className="fixed inset-0 z-[9995] bg-black/75 flex items-start justify-center pt-16 px-4 select-none"
      onClick={() => setOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden"
      >
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-zinc-800 bg-zinc-950">
          <Search className="w-4 h-4 text-cyan-400 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar páginas da Wiki, fichas, cartas, regras, criaturas ou eventos..."
            autoFocus
            className="flex-1 bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="p-1 rounded text-zinc-400 hover:text-zinc-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto custom-scrollbar p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-500">
              Nenhum registro encontrado para &ldquo;{query}&rdquo;.
            </div>
          ) : (
            filtered.slice(0, 25).map((hit) => (
              <button
                key={hit.id}
                type="button"
                onClick={() => {
                  hit.onSelect();
                  setOpen(false);
                  setQuery('');
                }}
                className="w-full text-left flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-md bg-zinc-950 border border-zinc-800 flex items-center justify-center shrink-0">
                    {hit.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-zinc-100 truncate">
                      {hit.title}
                    </div>
                    <div className="text-xs text-zinc-400 truncate">{hit.subtitle}</div>
                  </div>
                </div>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-zinc-400 shrink-0">
                  {hit.badge}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
