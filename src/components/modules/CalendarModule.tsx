'use client';

import React, { useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  CloudRain,
  Plus,
  Radio,
  Settings2,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useChronicleStore, useEffectiveGM } from '@/store/useChronicleStore';
import { saveCalendarConfig, stepCalendarDays } from '@/lib/chronicle-actions';
import { getAbsoluteDayCount } from '@/lib/utils';
import type { CalendarHoliday, WorldCalendarConfig } from '@/types/chronicle';

export function CalendarModule() {
  const isGM = useEffectiveGM();
  const roomId = useChronicleStore((s) => s.roomId);
  const calendar = useChronicleStore((s) => s.calendar);
  const showToast = useChronicleStore((s) => s.showToast);

  const [showConfig, setShowConfig] = useState(false);
  const [configDraft, setConfigDraft] = useState<WorldCalendarConfig | null>(null);
  const [weatherInput, setWeatherInput] = useState('');

  // Milestone quick form
  const [holName, setHolName] = useState('');
  const [holDay, setHolDay] = useState(1);
  const [holDesc, setHolDesc] = useState('');

  const activeMonth =
    calendar.months[calendar.currentMonthIndex] ||
    calendar.months[0] || { id: 'm1', name: 'Janeiro', days: 31, season: 'Verão' };

  const activeEra =
    calendar.eras.find((e) => e.id === calendar.currentEraId) ||
    calendar.eras[0] || {
      id: 'era-atual',
      name: 'Calendário Padrão',
      abbreviation: 'D.C.',
      startYear: 2026,
    };

  const absDay = useMemo(
    () =>
      getAbsoluteDayCount(
        calendar,
        calendar.currentYear,
        calendar.currentMonthIndex,
        calendar.currentDay
      ),
    [calendar]
  );

  const weekdayName = useMemo(() => {
    const list =
      calendar.weekdays.length > 0
        ? calendar.weekdays
        : ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    return list[((absDay % list.length) + list.length) % list.length];
  }, [calendar.weekdays, absDay]);

  const monthHolidays = useMemo(
    () => calendar.holidays.filter((h) => h.monthIndex === calendar.currentMonthIndex),
    [calendar.holidays, calendar.currentMonthIndex]
  );

  const todayHolidays = useMemo(
    () => monthHolidays.filter((h) => h.day === calendar.currentDay),
    [monthHolidays, calendar.currentDay]
  );

  const handleStep = async (delta: number) => {
    await stepCalendarDays(roomId, calendar, delta);
    showToast(
      delta > 0
        ? `Tempo avançado em +${delta} dia(s) (sincronizado com o VTT).`
        : `Tempo recuado em ${delta} dia(s).`
    );
  };

  const handleSelectDay = async (day: number) => {
    if (!isGM) return;
    await saveCalendarConfig(roomId, {
      ...calendar,
      currentDay: day,
    });
    showToast(`Data ajustada para ${day} de ${activeMonth.name}.`);
  };

  const handleUpdateWeather = async () => {
    if (!weatherInput.trim()) return;
    await saveCalendarConfig(roomId, {
      ...calendar,
      currentWeather: weatherInput.trim(),
    });
    setWeatherInput('');
    showToast('Condição climática sincronizada com a mesa.');
  };

  const handleAddHoliday = async () => {
    if (!holName.trim()) return;
    const nextHol: CalendarHoliday = {
      id: `hol_${crypto.randomUUID().slice(0, 7)}`,
      name: holName.trim(),
      monthIndex: calendar.currentMonthIndex,
      day: Math.max(1, Math.min(activeMonth.days, Number(holDay) || 1)),
      description: holDesc.trim(),
    };
    await saveCalendarConfig(roomId, {
      ...calendar,
      holidays: [...calendar.holidays, nextHol],
    });
    setHolName('');
    setHolDesc('');
    showToast('Marco fixado no calendário.');
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-5 lg:p-8 bg-zinc-950 text-zinc-100">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Top Live World Clock Header */}
        <header className="p-5 rounded-xl bg-zinc-900/80 border border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 text-xs font-mono uppercase text-cyan-400">
                <Radio className="w-3.5 h-3.5" />
                <span>Sincronizado com o StarStream VTT</span>
              </span>
              <span className="text-xs font-mono text-zinc-600">·</span>
              <span className="text-xs font-mono text-zinc-400">{activeMonth.season}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-100">
              {calendar.currentDay} de {activeMonth.name} de {calendar.currentYear}
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              {weekdayName}
              {calendar.currentWeather && (
                <>
                  {' '}· Condição atmosférica:{' '}
                  <strong className="text-zinc-200">{calendar.currentWeather}</strong>
                </>
              )}
            </p>
          </div>

          {isGM && (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleStep(-7)}
                className="px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs font-mono text-zinc-400 hover:text-zinc-200 cursor-pointer"
                title="Voltar 7 dias"
              >
                -7d
              </button>
              <button
                type="button"
                onClick={() => handleStep(-1)}
                className="flex items-center gap-0.5 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs font-mono text-zinc-200 cursor-pointer"
                title="Voltar 1 dia"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>1 Dia</span>
              </button>
              <button
                type="button"
                onClick={() => handleStep(1)}
                className="flex items-center gap-0.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs font-mono cursor-pointer transition-colors shadow-sm"
                title="Avançar 1 dia"
              >
                <span>+1 Dia</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleStep(7)}
                className="px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-cyan-500/50 text-xs font-mono text-zinc-200 cursor-pointer"
                title="Avançar 7 dias"
              >
                +7d
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfigDraft(JSON.parse(JSON.stringify(calendar)));
                  setShowConfig((p) => !p);
                }}
                className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 cursor-pointer ml-1"
                title="Configurar Meses e Ano"
              >
                <Settings2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </header>

        {/* Active Milestone Alert */}
        {todayHolidays.length > 0 && (
          <div className="p-4 rounded-xl bg-cyan-950/20 border border-cyan-500/30 flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-mono uppercase text-cyan-400 font-semibold">
                Marco / Evento Registrado para Hoje
              </div>
              {todayHolidays.map((h) => (
                <div key={h.id} className="mt-0.5">
                  <div className="text-sm font-bold text-zinc-100">{h.name}</div>
                  {h.description && <p className="text-xs text-zinc-400">{h.description}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Custom Structure Configurator (GM) */}
        {showConfig && isGM && configDraft && (
          <section className="p-5 rounded-xl bg-zinc-900/90 border border-cyan-500/30 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-zinc-100">
                Ajustes de Calendário e Ano
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowConfig(false)}
                  className="px-3 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-400 hover:text-zinc-200 cursor-pointer"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await saveCalendarConfig(roomId, configDraft);
                    setShowConfig(false);
                    showToast('Calendário atualizado.');
                  }}
                  className="px-3.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs cursor-pointer"
                >
                  Salvar
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Nome do Sistema / Campanha</label>
                <input
                  type="text"
                  value={configDraft.worldName}
                  onChange={(e) =>
                    setConfigDraft({ ...configDraft, worldName: e.target.value })
                  }
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 focus:border-cyan-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Ano Corrente</label>
                <input
                  type="number"
                  value={configDraft.currentYear}
                  onChange={(e) =>
                    setConfigDraft({
                      ...configDraft,
                      currentYear: Number(e.target.value) || 2026,
                    })
                  }
                  className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 focus:border-cyan-500 outline-none"
                />
              </div>
            </div>

            {/* Months Editor */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-zinc-300">Meses do Ano</span>
                <button
                  type="button"
                  onClick={() =>
                    setConfigDraft({
                      ...configDraft,
                      months: [
                        ...configDraft.months,
                        {
                          id: `m_${Math.random().toString(36).slice(2, 6)}`,
                          name: `Mês ${configDraft.months.length + 1}`,
                          days: 30,
                          season: 'Estação',
                        },
                      ],
                    })
                  }
                  className="text-xs text-cyan-400 hover:underline cursor-pointer"
                >
                  + Adicionar Mês
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {configDraft.months.map((m, idx) => (
                  <div
                    key={m.id}
                    className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <input
                        type="text"
                        value={m.name}
                        onChange={(e) => {
                          const copy = [...configDraft.months];
                          copy[idx] = { ...m, name: e.target.value };
                          setConfigDraft({ ...configDraft, months: copy });
                        }}
                        className="w-full px-2 py-1 text-xs font-semibold rounded bg-zinc-900 border border-zinc-800 text-zinc-100"
                      />
                      {configDraft.months.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setConfigDraft({
                              ...configDraft,
                              months: configDraft.months.filter((x) => x.id !== m.id),
                              currentMonthIndex: 0,
                            })
                          }
                          className="text-zinc-500 hover:text-red-400 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={5}
                        max={90}
                        value={m.days}
                        onChange={(e) => {
                          const copy = [...configDraft.months];
                          copy[idx] = { ...m, days: Math.max(5, Number(e.target.value) || 30) };
                          setConfigDraft({ ...configDraft, months: copy });
                        }}
                        className="w-16 px-2 py-1 text-xs font-mono rounded bg-zinc-900 border border-zinc-800 text-zinc-200"
                      />
                      <input
                        type="text"
                        value={m.season}
                        onChange={(e) => {
                          const copy = [...configDraft.months];
                          copy[idx] = { ...m, season: e.target.value };
                          setConfigDraft({ ...configDraft, months: copy });
                        }}
                        placeholder="Estação"
                        className="flex-1 px-2 py-1 text-xs rounded bg-zinc-900 border border-zinc-800 text-zinc-200"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Month Grid (2 columns wide) */}
          <div className="lg:col-span-2 p-5 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-cyan-400" />
                <h2 className="text-sm font-bold text-zinc-100">
                  {activeMonth.name} ({activeMonth.days} dias)
                </h2>
              </div>
              {isGM && (
                <select
                  value={calendar.currentMonthIndex}
                  onChange={(e) =>
                    saveCalendarConfig(roomId, {
                      ...calendar,
                      currentMonthIndex: Number(e.target.value),
                      currentDay: 1,
                    })
                  }
                  className="px-2.5 py-1 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 focus:border-cyan-500 outline-none"
                >
                  {calendar.months.map((m, idx) => (
                    <option key={m.id} value={idx}>
                      Ir para: {m.name} ({m.season})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Weekday Header */}
            <div className="grid grid-cols-7 gap-1.5 text-center">
              {(calendar.weekdays.length === 7
                ? calendar.weekdays
                : ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
              ).map((wd, i) => (
                <div key={i} className="text-[10px] font-mono uppercase text-zinc-500 truncate">
                  {wd}
                </div>
              ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1.5">
              {Array.from({ length: activeMonth.days }, (_, idx) => idx + 1).map((dayNum) => {
                const isToday = dayNum === calendar.currentDay;
                const dayHol = monthHolidays.find((h) => h.day === dayNum);
                return (
                  <button
                    key={dayNum}
                    type="button"
                    disabled={!isGM}
                    onClick={() => handleSelectDay(dayNum)}
                    className={`h-14 p-1.5 rounded-lg border text-left flex flex-col justify-between transition-colors ${
                      isGM ? 'cursor-pointer' : 'cursor-default'
                    } ${
                      isToday
                        ? 'bg-cyan-950/40 border-cyan-500/70 text-zinc-100 ring-1 ring-cyan-500/30'
                        : dayHol
                        ? 'bg-zinc-900 border-zinc-700 text-zinc-100'
                        : 'bg-zinc-950/70 border-zinc-800/80 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold">{dayNum}</span>
                      {isToday && (
                        <span className="text-[9px] font-mono px-1 rounded bg-cyan-500 text-zinc-950 font-bold">
                          HOJE
                        </span>
                      )}
                    </div>
                    {dayHol && (
                      <div className="text-[10px] text-cyan-400 truncate">{dayHol.name}</div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Weather & Milestones */}
          <div className="space-y-4">
            {/* Weather Control (GM) */}
            {isGM && (
              <section className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-100">
                  <CloudRain className="w-4 h-4 text-cyan-400" />
                  <span>Condição Climática na Mesa</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={weatherInput}
                    onChange={(e) => setWeatherInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleUpdateWeather()}
                    placeholder={calendar.currentWeather || 'Ex: Chuva fria, névoa densa...'}
                    className="flex-1 px-2.5 py-1.5 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleUpdateWeather}
                    className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs cursor-pointer transition-colors"
                  >
                    Aplicar
                  </button>
                </div>
              </section>
            )}

            {/* Milestones & Fixed Notes */}
            <section className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-2.5">
              <div className="text-xs font-bold text-zinc-100">
                Marcos & Efemérides de {activeMonth.name}
              </div>
              {monthHolidays.length === 0 ? (
                <p className="text-xs text-zinc-500">Nenhum evento registrado para este mês.</p>
              ) : (
                monthHolidays.map((h) => (
                  <div
                    key={h.id}
                    className="flex items-start justify-between gap-2 p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs"
                  >
                    <div>
                      <div className="font-semibold text-zinc-200">
                        Dia {h.day} · {h.name}
                      </div>
                      {h.description && (
                        <div className="text-[11px] text-zinc-400 mt-0.5">{h.description}</div>
                      )}
                    </div>
                    {isGM && (
                      <button
                        type="button"
                        onClick={() =>
                          saveCalendarConfig(roomId, {
                            ...calendar,
                            holidays: calendar.holidays.filter((x) => x.id !== h.id),
                          })
                        }
                        className="text-zinc-500 hover:text-red-400 cursor-pointer"
                        title="Remover"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))
              )}

              {isGM && (
                <div className="pt-2 border-t border-zinc-800 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={1}
                      max={activeMonth.days}
                      value={holDay}
                      onChange={(e) => setHolDay(Number(e.target.value))}
                      className="w-16 px-2 py-1 text-xs font-mono rounded bg-zinc-950 border border-zinc-800 text-zinc-200"
                    />
                    <input
                      type="text"
                      value={holName}
                      onChange={(e) => setHolName(e.target.value)}
                      placeholder="Novo marco / data..."
                      className="flex-1 px-2 py-1 text-xs rounded bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder:text-zinc-600"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={holDesc}
                      onChange={(e) => setHolDesc(e.target.value)}
                      placeholder="Descrição curta..."
                      className="flex-1 px-2 py-1 text-xs rounded bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder:text-zinc-600"
                    />
                    <button
                      type="button"
                      onClick={handleAddHoliday}
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs cursor-pointer transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Fixar</span>
                    </button>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
