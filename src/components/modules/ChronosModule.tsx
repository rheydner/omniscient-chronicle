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
  investigation: 'Investigação / Caso',
  incident: 'Incidente / Anomalia',
  operation: 'Operação / Missão',
  milestone: 'Registro / Fato Histórico',
  document: 'Pista / Documento',
};

const CATEGORY_COLORS: Record<ChronosEventCategory, string> = {
  session: 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300',
  investigation: 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300',
  incident: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
  operation: 'bg-rose-500/15 border-rose-500/30 text-rose-300',
  milestone: 'bg-purple-500/15 border-purple-500/30 text-purple-300',
  document: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300',
};

interface TimelineRow {
  id: string;
  source: 'event' | 'entity' | 'now';
  title: string;
  summary: string;
  year: number;
  monthIndex: number;
  monthName: string;
  day: number;
  category: ChronosEventCategory;
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

  const [catFilter, setCatFilter] = useState<ChronosEventCategory | 'all'>('all');
  const [showCreator, setShowCreator] = useState(false);

  // Event Creator Form
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [year, setYear] = useState(calendar.currentYear || 2026);
  const [monthIndex, setMonthIndex] = useState(calendar.currentMonthIndex || 0);
  const [day, setDay] = useState(calendar.currentDay || 1);
  const [category, setCategory] = useState<ChronosEventCategory>('session');
  const [linkedEntityId, setLinkedEntityId] = useState('');
  const [isPublic, setIsPublic] = useState(true);

  const timelineRows = useMemo<TimelineRow[]>(() => {
    const getMonthName = (idx: number) =>
      calendar.months[idx]?.name || calendar.months[0]?.name || 'Mês';

    const rows: TimelineRow[] = [];

    // 1. Dedicated Chronos Events
    Object.values(eventsMap).forEach((ev) => {
      if (!isGM && !ev.isPublicToPlayers) return;
      if (catFilter !== 'all' && ev.category !== catFilter) return;
      rows.push({
        id: `ev-${ev.id}`,
        source: 'event',
        title: ev.title,
        summary: ev.summary,
        year: ev.year,
        monthIndex: ev.monthIndex,
        monthName: getMonthName(ev.monthIndex),
        day: ev.day,
        category: ev.category,
        categoryLabel: CATEGORY_LABELS[ev.category] || 'Evento',
        linkedEntityId: ev.linkedEntityId || null,
        isPublic: ev.isPublicToPlayers,
        rawEvent: ev,
      });
    });

    // 2. Atlas Entities with eventDate
    Object.values(entitiesMap).forEach((ent) => {
      if (!ent.eventDate) return;
      if (!isGM && !ent.isPublicToPlayers) return;
      rows.push({
        id: `ent-${ent.id}`,
        source: 'entity',
        title: ent.title,
        summary: ent.subtitle || 'Registro do Atlas com datação associada.',
        year: ent.eventDate.year,
        monthIndex: ent.eventDate.monthIndex,
        monthName: getMonthName(ent.eventDate.monthIndex),
        day: ent.eventDate.day,
        category: 'document',
        categoryLabel: 'Página do Atlas',
        linkedEntityId: ent.id,
        isPublic: ent.isPublicToPlayers,
      });
    });

    // 3. Current In-Game Present Marker
    rows.push({
      id: 'timeline-now',
      source: 'now',
      title: 'Presente da Campanha',
      summary: `Marco temporal ativo sincronizado com o StarStream VTT (${calendar.currentWeather || 'Clima padrão'}).`,
      year: calendar.currentYear,
      monthIndex: calendar.currentMonthIndex,
      monthName: getMonthName(calendar.currentMonthIndex),
      day: calendar.currentDay,
      category: 'session',
      categoryLabel: 'Tempo Presente',
      linkedEntityId: null,
      isPublic: true,
    });

    // Sort Chronologically: Year -> Month -> Day
    rows.sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      if (a.monthIndex !== b.monthIndex) return a.monthIndex - b.monthIndex;
      if (a.day !== b.day) return a.day - b.day;
      if (a.source === 'now') return 1;
      if (b.source === 'now') return -1;
      return 0;
    });

    return rows;
  }, [eventsMap, entitiesMap, calendar, isGM, catFilter]);

  const handleCreateEvent = async () => {
    if (!title.trim()) {
      showToast('Informe um título para o evento.');
      return;
    }
    const ev: ChronosEvent = {
      id: crypto.randomUUID(),
      title: title.trim(),
      summary: summary.trim(),
      eraId: 'era-padrao',
      year,
      monthIndex,
      day,
      category,
      linkedEntityId: linkedEntityId || null,
      isPublicToPlayers: isPublic,
      createdAt: Date.now(),
    };
    await saveChronosEvent(roomId, ev);
    setTitle('');
    setSummary('');
    setShowCreator(false);
    showToast('Marco adicionado à linha do tempo.');
  };

  const actualEventsCount = timelineRows.filter((r) => r.source !== 'now').length;

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-5 lg:p-8 bg-zinc-950">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header & Filters */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono uppercase text-cyan-400">
              <Clock className="w-3.5 h-3.5" />
              <span>Cronos · Linha do Tempo da Campanha</span>
            </div>
            <h1 className="text-xl font-bold text-zinc-100 mt-1">
              {calendar.worldName || 'Linha do Tempo'}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={catFilter}
              onChange={(e) => setCatFilter(e.target.value as ChronosEventCategory | 'all')}
              className="px-2.5 py-1.5 text-xs rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200"
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
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-semibold text-xs cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Novo Marco</span>
              </button>
            )}
          </div>
        </header>

        {/* Creator Drawer */}
        {showCreator && isGM && (
          <section className="p-5 rounded-xl bg-zinc-900 border border-cyan-500/40 space-y-3.5 shadow-lg">
            <div className="text-xs font-bold text-zinc-100 uppercase font-mono tracking-wider text-cyan-400">
              Registrar Marco na Linha do Tempo
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Título do acontecimento..."
                className="px-3 py-2 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-cyan-500"
              />
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ChronosEventCategory)}
                className="px-3 py-2 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-cyan-500"
              >
                {(Object.keys(CATEGORY_LABELS) as ChronosEventCategory[]).map((cat) => (
                  <option key={cat} value={cat}>
                    {CATEGORY_LABELS[cat]}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                placeholder="Ano"
                className="px-2.5 py-1.5 text-xs font-mono rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
              />
              <select
                value={monthIndex}
                onChange={(e) => setMonthIndex(Number(e.target.value))}
                className="px-2.5 py-1.5 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200"
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
                className="px-2.5 py-1.5 text-xs font-mono rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
              />
            </div>

            <textarea
              rows={2}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Resumo do acontecimento, pistas obtidas ou consequências..."
              className="w-full px-3 py-2 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-cyan-500"
            />

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <select
                value={linkedEntityId}
                onChange={(e) => setLinkedEntityId(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-300"
              >
                <option value="">Vincular Página do Atlas (opcional)...</option>
                {Object.values(entitiesMap).map((en) => (
                  <option key={en.id} value={en.id}>
                    {en.title}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                    className="rounded border-zinc-700 text-cyan-500 focus:ring-0"
                  />
                  <span>Visível aos jogadores</span>
                </label>
                <button
                  type="button"
                  onClick={handleCreateEvent}
                  className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-semibold text-xs cursor-pointer transition-colors"
                >
                  Salvar Marco
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Empty State when no events exist */}
        {actualEventsCount === 0 && (
          <div className="p-8 rounded-xl bg-zinc-900 border border-zinc-800 text-center space-y-3">
            <Clock className="w-8 h-8 text-zinc-600 mx-auto" />
            <div className="text-sm font-semibold text-zinc-200">
              Nenhum acontecimento registrado na Linha do Tempo
            </div>
            <p className="text-xs text-zinc-500 max-w-md mx-auto">
              Utilize o botão acima para registrar datas de sessões jogadas, incidentes investigados ou pistas descobertas pelo grupo.
            </p>
            {isGM && (
              <button
                type="button"
                onClick={() => setShowCreator(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5 text-cyan-400" />
                <span>Adicionar Primeiro Marco</span>
              </button>
            )}
          </div>
        )}

        {/* Vertical Chronological Axis */}
        <div className="relative pl-6 border-l border-zinc-800 space-y-4">
          {timelineRows.map((row) => {
            const isNow = row.source === 'now';
            const catBadgeColor =
              CATEGORY_COLORS[row.category] || 'bg-zinc-800 border-zinc-700 text-zinc-300';
            return (
              <div key={row.id} className="relative">
                {/* Node Dot on Axis */}
                <span
                  className={`absolute -left-[29px] top-4 w-3 h-3 rounded-full border-2 ${
                    isNow
                      ? 'bg-cyan-400 border-zinc-950 ring-4 ring-cyan-500/20'
                      : 'bg-zinc-700 border-zinc-950'
                  }`}
                />

                <div
                  className={`p-4 rounded-xl border ${
                    isNow
                      ? 'bg-zinc-900 border-cyan-500/40 shadow-sm'
                      : 'bg-zinc-900/90 border-zinc-800'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-xs font-mono font-bold ${
                          isNow ? 'text-cyan-400' : 'text-zinc-200'
                        }`}
                      >
                        {row.day} de {row.monthName} de {row.year}
                      </span>
                      <span
                        className={`text-[11px] font-mono px-2 py-0.5 rounded border ${catBadgeColor}`}
                      >
                        {row.categoryLabel}
                      </span>
                      {!row.isPublic && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-500/15 border border-rose-500/30 text-rose-300">
                          GM
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {row.linkedEntityId && (
                        <button
                          type="button"
                          onClick={() => navigateToEntity(row.linkedEntityId!)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800 hover:border-cyan-500 text-xs text-zinc-300 cursor-pointer transition-colors"
                        >
                          <ExternalLink className="w-3 h-3 text-cyan-400" />
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
                            className="p-1 text-zinc-500 hover:text-zinc-200 cursor-pointer transition-colors"
                            title="Alternar visibilidade para jogadores"
                          >
                            {row.rawEvent.isPublicToPlayers ? (
                              <Eye className="w-3.5 h-3.5 text-cyan-400" />
                            ) : (
                              <EyeOff className="w-3.5 h-3.5 text-zinc-600" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteChronosEvent(roomId, row.rawEvent!.id)}
                            className="p-1 text-zinc-600 hover:text-rose-400 cursor-pointer transition-colors"
                            title="Excluir marco"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-1.5">
                    {isNow && <Flag className="w-4 h-4 text-cyan-400" />}
                    <span>{row.title}</span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{row.summary}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
