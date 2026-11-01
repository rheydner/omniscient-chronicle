'use client';

import React, { useMemo, useState } from 'react';
import {
  Clock,
  ExternalLink,
  Eye,
  EyeOff,
  Flag,
  Plus,
  Trash2,
} from 'lucide-react';
import { useChronicleStore, useEffectiveGM } from '@/store/useChronicleStore';
import { deleteChronosEvent, saveChronosEvent } from '@/lib/chronicle-actions';
import type { ChronosEvent, ChronosEventCategory } from '@/types/chronicle';

const CATEGORY_LABELS: Record<ChronosEventCategory, string> = {
  session: 'Sessão Jogada',
  war: 'Guerra / Conflito',
  discovery: 'Descoberta / Pista',
  cataclysm: 'Cataclismo / Ruptura',
  ritual: 'Ritual Oculto',
  foundation: 'Fundação / Pacto',
};

interface TimelineRow {
  id: string;
  source: 'event' | 'entity' | 'now';
  title: string;
  summary: string;
  eraId: string;
  eraAbbr: string;
  eraStartYear: number;
  year: number;
  monthIndex: number;
  monthName: string;
  day: number;
  categoryLabel: string;
  linkedEntityId: string | null;
  isPublic: boolean;
  rawEvent?: ChronosEvent;
}

export function ChronosModule() {
  const isGM = useEffectiveGM();
  const roomId = useChronicleStore((s) => s.roomId);
  const eventsMap = useChronicleStore((s) => s.events);
  const entitiesMap = useChronicleStore((s) => s.entities);
  const calendar = useChronicleStore((s) => s.calendar);
  const navigateToEntity = useChronicleStore((s) => s.navigateToEntity);
  const showToast = useChronicleStore((s) => s.showToast);

  const [eraFilter, setEraFilter] = useState<string>('all');
  const [catFilter, setCatFilter] = useState<ChronosEventCategory | 'all'>('all');
  const [showCreator, setShowCreator] = useState(false);

  // Event Creator Form
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [eraId, setEraId] = useState(calendar.currentEraId);
  const [year, setYear] = useState(calendar.currentYear);
  const [monthIndex, setMonthIndex] = useState(calendar.currentMonthIndex);
  const [day, setDay] = useState(calendar.currentDay);
  const [category, setCategory] = useState<ChronosEventCategory>('session');
  const [linkedEntityId, setLinkedEntityId] = useState('');
  const [isPublic, setIsPublic] = useState(true);

  const timelineRows = useMemo<TimelineRow[]>(() => {
    const getEra = (id: string) =>
      calendar.eras.find((e) => e.id === id) ||
      calendar.eras[0] || { id: 'era-0', name: 'Era', abbreviation: 'E.A.', startYear: 1 };
    const getMonthName = (idx: number) =>
      calendar.months[idx]?.name || calendar.months[0]?.name || 'Mês 1';

    const rows: TimelineRow[] = [];

    // 1. Dedicated Chronos Events
    Object.values(eventsMap).forEach((ev) => {
      if (!isGM && !ev.isPublicToPlayers) return;
      if (eraFilter !== 'all' && ev.eraId !== eraFilter) return;
      if (catFilter !== 'all' && ev.category !== catFilter) return;
      const er = getEra(ev.eraId);
      rows.push({
        id: `ev-${ev.id}`,
        source: 'event',
        title: ev.title,
        summary: ev.summary,
        eraId: ev.eraId,
        eraAbbr: er.abbreviation,
        eraStartYear: er.startYear,
        year: ev.year,
        monthIndex: ev.monthIndex,
        monthName: getMonthName(ev.monthIndex),
        day: ev.day,
        categoryLabel: CATEGORY_LABELS[ev.category],
        linkedEntityId: ev.linkedEntityId || null,
        isPublic: ev.isPublicToPlayers,
        rawEvent: ev,
      });
    });

    // 2. Dated Wiki Entities
    Object.values(entitiesMap).forEach((ent) => {
      if (!ent.eventDate) return;
      if (!isGM && !ent.isPublicToPlayers) return;
      if (eraFilter !== 'all' && ent.eventDate.eraId !== eraFilter) return;
      if (catFilter !== 'all') return;
      const er = getEra(ent.eventDate.eraId);
      rows.push({
        id: `ent-${ent.id}`,
        source: 'entity',
        title: ent.title,
        summary: ent.subtitle || 'Página datada diretamente no Atlas.',
        eraId: ent.eventDate.eraId,
        eraAbbr: er.abbreviation,
        eraStartYear: er.startYear,
        year: ent.eventDate.year,
        monthIndex: ent.eventDate.monthIndex,
        monthName: getMonthName(ent.eventDate.monthIndex),
        day: ent.eventDate.day,
        categoryLabel: 'Registro do Atlas',
        linkedEntityId: ent.id,
        isPublic: ent.isPublicToPlayers,
      });
    });

    // 3. Live Party Current Position Marker from Calendar
    if (eraFilter === 'all' || eraFilter === calendar.currentEraId) {
      const er = getEra(calendar.currentEraId);
      rows.push({
        id: 'live-party-now',
        source: 'now',
        title: 'Posição Temporal Atual da Campanha',
        summary: `Clima em campo: ${calendar.currentWeather}`,
        eraId: calendar.currentEraId,
        eraAbbr: er.abbreviation,
        eraStartYear: er.startYear,
        year: calendar.currentYear,
        monthIndex: calendar.currentMonthIndex,
        monthName: getMonthName(calendar.currentMonthIndex),
        day: calendar.currentDay,
        categoryLabel: 'Presente da Mesa',
        linkedEntityId: null,
        isPublic: true,
      });
    }

    return rows.sort((a, b) => {
      if (a.eraStartYear !== b.eraStartYear) return a.eraStartYear - b.eraStartYear;
      if (a.year !== b.year) return a.year - b.year;
      if (a.monthIndex !== b.monthIndex) return a.monthIndex - b.monthIndex;
      return a.day - b.day;
    });
  }, [eventsMap, entitiesMap, calendar, isGM, eraFilter, catFilter]);

  const handleCreateEvent = async () => {
    if (!title.trim()) return;
    const ev: ChronosEvent = {
      id: `ev_${crypto.randomUUID().slice(0, 8)}`,
      title: title.trim(),
      summary: summary.trim() || 'Marco histórico registrado.',
      eraId: eraId || calendar.currentEraId,
      year: Number(year) || calendar.currentYear,
      monthIndex: Number(monthIndex) || 0,
      day: Math.max(1, Number(day) || 1),
      category,
      linkedEntityId: linkedEntityId || null,
      isPublicToPlayers: isPublic,
      createdAt: Date.now(),
    };
    await saveChronosEvent(roomId, ev);
    setTitle('');
    setSummary('');
    setShowCreator(false);
    showToast('Marco adicionado à linha do tempo Cronos.');
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-5 lg:p-8 bg-[#0b0d10]">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header & Filters */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#222834]">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono uppercase text-[#d4a359]">
              <Clock className="w-3.5 h-3.5" />
              <span>Cronos · Linha do Tempo Unificada</span>
            </div>
            <h1 className="text-2xl font-bold font-editorial text-[#ece8df] mt-0.5">
              História & Marcos de {calendar.worldName}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={eraFilter}
              onChange={(e) => setEraFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-lg bg-[#13171e] border border-[#222834] text-[#ece8df]"
            >
              <option value="all">Todas as Eras</option>
              {calendar.eras.map((er) => (
                <option key={er.id} value={er.id}>
                  {er.name}
                </option>
              ))}
            </select>

            <select
              value={catFilter}
              onChange={(e) => setCatFilter(e.target.value as ChronosEventCategory | 'all')}
              className="px-2.5 py-1.5 text-xs rounded-lg bg-[#13171e] border border-[#222834] text-[#ece8df]"
            >
              <option value="all">Todas Categorias</option>
              {(Object.keys(CATEGORY_LABELS) as ChronosEventCategory[]).map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORY_LABELS[cat]}
                </option>
              ))}
            </select>

            {isGM && (
              <button
                type="button"
                onClick={() => setShowCreator((p) => !p)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#d4a359] hover:bg-[#e2b56e] text-[#0b0d10] font-semibold text-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Novo Marco</span>
              </button>
            )}
          </div>
        </header>

        {/* Creator Drawer */}
        {showCreator && isGM && (
          <section className="p-4 rounded-xl bg-[#13171e] border border-[#d4a359]/45 space-y-3">
            <div className="text-xs font-bold text-[#ece8df]">Registrar Evento Histórico ou Sessão</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Título do evento..."
                className="px-3 py-1.5 text-xs rounded-lg bg-[#0e1116] border border-[#222834] text-[#ece8df]"
              />
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ChronosEventCategory)}
                className="px-3 py-1.5 text-xs rounded-lg bg-[#0e1116] border border-[#222834] text-[#ece8df]"
              >
                {(Object.keys(CATEGORY_LABELS) as ChronosEventCategory[]).map((cat) => (
                  <option key={cat} value={cat}>
                    {CATEGORY_LABELS[cat]}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <select
                value={eraId}
                onChange={(e) => setEraId(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-lg bg-[#0e1116] border border-[#222834] text-[#ece8df]"
              >
                {calendar.eras.map((er) => (
                  <option key={er.id} value={er.id}>
                    {er.abbreviation}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                placeholder="Ano"
                className="px-2.5 py-1.5 text-xs font-mono rounded-lg bg-[#0e1116] border border-[#222834] text-[#ece8df]"
              />
              <select
                value={monthIndex}
                onChange={(e) => setMonthIndex(Number(e.target.value))}
                className="px-2.5 py-1.5 text-xs rounded-lg bg-[#0e1116] border border-[#222834] text-[#ece8df]"
              >
                {calendar.months.map((m, idx) => (
                  <option key={m.id} value={idx}>
                    {m.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                max={31}
                value={day}
                onChange={(e) => setDay(Number(e.target.value))}
                placeholder="Dia"
                className="px-2.5 py-1.5 text-xs font-mono rounded-lg bg-[#0e1116] border border-[#222834] text-[#ece8df]"
              />
            </div>

            <textarea
              rows={2}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Resumo do acontecimento..."
              className="w-full px-3 py-1.5 text-xs rounded-lg bg-[#0e1116] border border-[#222834] text-[#ece8df]"
            />

            <div className="flex flex-wrap items-center justify-between gap-2">
              <select
                value={linkedEntityId}
                onChange={(e) => setLinkedEntityId(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-lg bg-[#0e1116] border border-[#222834] text-[#ece8df]"
              >
                <option value="">Vincular Página do Atlas (opcional)...</option>
                {Object.values(entitiesMap).map((en) => (
                  <option key={en.id} value={en.id}>
                    {en.title}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs text-[#a5a095] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                  />
                  <span>Visível aos jogadores</span>
                </label>
                <button
                  type="button"
                  onClick={handleCreateEvent}
                  className="px-4 py-1.5 rounded-lg bg-[#d4a359] text-[#0b0d10] font-semibold text-xs cursor-pointer"
                >
                  Salvar no Cronos
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Vertical Chronological Axis */}
        <div className="relative pl-6 border-l border-[#313a4b] space-y-4">
          {timelineRows.map((row) => {
            const isNow = row.source === 'now';
            return (
              <div key={row.id} className="relative">
                {/* Node Dot on Axis */}
                <span
                  className={`absolute -left-[29px] top-4 w-3 h-3 rounded-full border-2 ${
                    isNow
                      ? 'bg-[#4fa3b8] border-[#0b0d10] ring-4 ring-[#4fa3b8]/25'
                      : 'bg-[#d4a359] border-[#0b0d10]'
                  }`}
                />

                <div
                  className={`p-4 rounded-xl border ${
                    isNow
                      ? 'bg-[#111b22] border-[#4fa3b8]/55'
                      : 'bg-[#13171e] border-[#222834]'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-xs font-mono font-bold ${
                          isNow ? 'text-[#7cc6d8]' : 'text-[#d4a359]'
                        }`}
                      >
                        Dia {row.day} de {row.monthName}, Ano {row.year} {row.eraAbbr}
                      </span>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#0e1116] border border-[#222834] text-[#a5a095]">
                        {row.categoryLabel}
                      </span>
                      {!row.isPublic && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#c94a4a]/15 text-[#e07b7b]">
                          GM
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {row.linkedEntityId && (
                        <button
                          type="button"
                          onClick={() => navigateToEntity(row.linkedEntityId!)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#0e1116] border border-[#222834] hover:border-[#d4a359] text-xs text-[#ece8df] cursor-pointer"
                        >
                          <ExternalLink className="w-3 h-3 text-[#d4a359]" />
                          <span>Atlas</span>
                        </button>
                      )}
                      {isGM && row.rawEvent && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              saveChronosEvent(roomId, {
                                ...row.rawEvent!,
                                isPublicToPlayers: !row.rawEvent!.isPublicToPlayers,
                              })
                            }
                            className="p-1 text-[#a5a095] hover:text-[#ece8df] cursor-pointer"
                            title="Alternar visibilidade"
                          >
                            {row.rawEvent.isPublicToPlayers ? (
                              <Eye className="w-3.5 h-3.5 text-[#d4a359]" />
                            ) : (
                              <EyeOff className="w-3.5 h-3.5 text-[#6f6b62]" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteChronosEvent(roomId, row.rawEvent!.id)}
                            className="p-1 text-[#6f6b62] hover:text-[#c94a4a] cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <h3 className="text-base font-bold text-[#ece8df] flex items-center gap-1.5">
                    {isNow && <Flag className="w-4 h-4 text-[#4fa3b8]" />}
                    <span>{row.title}</span>
                  </h3>
                  <p className="text-xs text-[#a5a095] mt-1 leading-relaxed">{row.summary}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
