'use client';

import React, { useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  CloudRain,
  Moon,
  Plus,
  Radio,
  Settings2,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useChronicleStore, useEffectiveGM } from '@/store/useChronicleStore';
import { saveCalendarConfig, stepCalendarDays } from '@/lib/chronicle-actions';
import { getAbsoluteDayCount, getMoonPhaseLabel } from '@/lib/utils';
import type { CalendarHoliday, WorldCalendarConfig } from '@/types/chronicle';

export function CalendarModule() {
  const isGM = useEffectiveGM();
  const roomId = useChronicleStore((s) => s.roomId);
  const calendar = useChronicleStore((s) => s.calendar);
  const showToast = useChronicleStore((s) => s.showToast);

  const [showConfig, setShowConfig] = useState(false);
  const [configDraft, setConfigDraft] = useState<WorldCalendarConfig | null>(null);
  const [weatherInput, setWeatherInput] = useState('');

  // Holiday quick form
  const [holName, setHolName] = useState('');
  const [holDay, setHolDay] = useState(1);
  const [holDesc, setHolDesc] = useState('');

  const activeMonth =
    calendar.months[calendar.currentMonthIndex] ||
    calendar.months[0] || { id: 'm0', name: 'Mês 1', days: 30, season: 'Outono' };

  const activeEra =
    calendar.eras.find((e) => e.id === calendar.currentEraId) ||
    calendar.eras[0] || {
      id: 'era0',
      name: 'Era Atual',
      abbreviation: 'E.A.',
      startYear: 1,
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
    const list = calendar.weekdays.length > 0 ? calendar.weekdays : ['1º Dia'];
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
        ? `Tempo avançado em +${delta} dia(s) (HUD do VTT sincronizado).`
        : `Tempo recuado em ${delta} dia(s).`
    );
  };

  const handleSelectDay = async (day: number) => {
    if (!isGM) return;
    await saveCalendarConfig(roomId, {
      ...calendar,
      currentDay: day,
    });
    showToast(`Data ajustada para Dia ${day} de ${activeMonth.name}.`);
  };

  const handleUpdateWeather = async () => {
    if (!weatherInput.trim()) return;
    await saveCalendarConfig(roomId, {
      ...calendar,
      currentWeather: weatherInput.trim(),
    });
    setWeatherInput('');
    showToast('Clima sincronizado com o StarStream VTT!');
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
    showToast('Data comemorativa adicionada ao calendário.');
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-5 lg:p-8 bg-[#0b0d10]">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Top Live World Clock Header */}
        <header className="p-5 rounded-xl bg-[#13171e] border border-[#222834] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 text-xs font-mono uppercase text-[#4fa3b8]">
                <Radio className="w-3.5 h-3.5" />
                <span>Sincronizado com o HUD do StarStream VTT</span>
              </span>
              <span className="text-xs font-mono text-[#6f6b62]">·</span>
              <span className="text-xs font-mono text-[#d4a359]">{activeMonth.season}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold font-editorial text-[#ece8df]">
              Dia {calendar.currentDay} de {activeMonth.name}, Ano {calendar.currentYear}{' '}
              {activeEra.abbreviation}
            </h1>
            <p className="text-xs text-[#a5a095] mt-1">
              {weekdayName} · Clima atual:{' '}
              <strong className="text-[#ece8df]">{calendar.currentWeather}</strong>
            </p>
          </div>

          {isGM && (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleStep(-7)}
                className="px-2.5 py-1.5 rounded-lg bg-[#0e1116] border border-[#222834] hover:border-[#313a4b] text-xs font-mono text-[#a5a095] hover:text-[#ece8df] cursor-pointer"
              >
                -7d
              </button>
              <button
                type="button"
                onClick={() => handleStep(-1)}
                className="flex items-center gap-0.5 px-2.5 py-1.5 rounded-lg bg-[#0e1116] border border-[#222834] hover:border-[#313a4b] text-xs font-mono text-[#ece8df] cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>1 Dia</span>
              </button>
              <button
                type="button"
                onClick={() => handleStep(1)}
                className="flex items-center gap-0.5 px-3 py-1.5 rounded-lg bg-[#d4a359] hover:bg-[#e2b56e] text-[#0b0d10] font-semibold text-xs font-mono cursor-pointer"
              >
                <span>+1 Dia</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleStep(7)}
                className="px-2.5 py-1.5 rounded-lg bg-[#0e1116] border border-[#222834] hover:border-[#d4a359] text-xs font-mono text-[#ece8df] cursor-pointer"
              >
                +7d
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfigDraft(JSON.parse(JSON.stringify(calendar)));
                  setShowConfig((p) => !p);
                }}
                className="p-2 rounded-lg bg-[#191e27] border border-[#313a4b] text-[#a5a095] hover:text-[#ece8df] cursor-pointer ml-1"
                title="Configurar Meses, Luas e Eras"
              >
                <Settings2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </header>

        {/* Active Holiday Alert */}
        {todayHolidays.length > 0 && (
          <div className="p-4 rounded-xl bg-[#191712] border border-[#d4a359]/50 flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-[#d4a359] shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-mono uppercase text-[#d4a359]">
                Efeméride / Data Marcada Hoje
              </div>
              {todayHolidays.map((h) => (
                <div key={h.id} className="mt-0.5">
                  <div className="text-sm font-bold text-[#ece8df]">{h.name}</div>
                  {h.description && <p className="text-xs text-[#a5a095]">{h.description}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Custom Structure Configurator (GM) */}
        {showConfig && isGM && configDraft && (
          <section className="p-5 rounded-xl bg-[#13171e] border border-[#d4a359]/45 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#ece8df]">
                Arquitetura do Calendário Customizado
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowConfig(false)}
                  className="px-3 py-1 rounded-lg bg-[#0e1116] border border-[#222834] text-xs text-[#a5a095] cursor-pointer"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await saveCalendarConfig(roomId, configDraft);
                    setShowConfig(false);
                    showToast('Estrutura do calendário atualizada.');
                  }}
                  className="px-3.5 py-1 rounded-lg bg-[#d4a359] text-[#0b0d10] font-semibold text-xs cursor-pointer"
                >
                  Salvar Estrutura
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-[#a5a095] mb-1">Nome do Mundo / Sistema</label>
                <input
                  type="text"
                  value={configDraft.worldName}
                  onChange={(e) =>
                    setConfigDraft({ ...configDraft, worldName: e.target.value })
                  }
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-[#0e1116] border border-[#222834] text-[#ece8df]"
                />
              </div>
              <div>
                <label className="block text-xs text-[#a5a095] mb-1">Era Atual</label>
                <select
                  value={configDraft.currentEraId}
                  onChange={(e) =>
                    setConfigDraft({ ...configDraft, currentEraId: e.target.value })
                  }
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-[#0e1116] border border-[#222834] text-[#ece8df]"
                >
                  {configDraft.eras.map((er) => (
                    <option key={er.id} value={er.id}>
                      {er.name} ({er.abbreviation})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-[#a5a095] mb-1">Ano Atual</label>
                <input
                  type="number"
                  value={configDraft.currentYear}
                  onChange={(e) =>
                    setConfigDraft({
                      ...configDraft,
                      currentYear: Number(e.target.value) || 1,
                    })
                  }
                  className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg bg-[#0e1116] border border-[#222834] text-[#ece8df]"
                />
              </div>
            </div>

            {/* Months Editor */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-[#ece8df]">Meses do Ano</span>
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
                          season: 'Outono',
                        },
                      ],
                    })
                  }
                  className="text-xs text-[#d4a359] hover:underline cursor-pointer"
                >
                  + Adicionar Mês
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {configDraft.months.map((m, idx) => (
                  <div
                    key={m.id}
                    className="p-2.5 rounded-lg bg-[#0e1116] border border-[#222834] space-y-1.5"
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
                        className="w-full px-2 py-1 text-xs font-semibold rounded bg-[#13171e] border border-[#222834] text-[#ece8df]"
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
                          className="text-[#6f6b62] hover:text-[#c94a4a] cursor-pointer"
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
                        className="w-16 px-2 py-1 text-xs font-mono rounded bg-[#13171e] border border-[#222834]"
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
                        className="flex-1 px-2 py-1 text-xs rounded bg-[#13171e] border border-[#222834]"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Moons Editor */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-[#ece8df]">Ciclos Lunares</span>
                <button
                  type="button"
                  onClick={() =>
                    setConfigDraft({
                      ...configDraft,
                      moons: [
                        ...configDraft.moons,
                        {
                          id: `mn_${Math.random().toString(36).slice(2, 6)}`,
                          name: 'Nova Lua',
                          cycleDays: 28,
                          offsetDays: 0,
                          color: '#d4a359',
                        },
                      ],
                    })
                  }
                  className="text-xs text-[#d4a359] hover:underline cursor-pointer"
                >
                  + Adicionar Lua
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {configDraft.moons.map((mn, idx) => (
                  <div
                    key={mn.id}
                    className="p-2.5 rounded-lg bg-[#0e1116] border border-[#222834] flex items-center gap-2"
                  >
                    <input
                      type="color"
                      value={mn.color}
                      onChange={(e) => {
                        const copy = [...configDraft.moons];
                        copy[idx] = { ...mn, color: e.target.value };
                        setConfigDraft({ ...configDraft, moons: copy });
                      }}
                      className="w-8 h-7 rounded bg-transparent border-0"
                    />
                    <input
                      type="text"
                      value={mn.name}
                      onChange={(e) => {
                        const copy = [...configDraft.moons];
                        copy[idx] = { ...mn, name: e.target.value };
                        setConfigDraft({ ...configDraft, moons: copy });
                      }}
                      className="flex-1 px-2 py-1 text-xs rounded bg-[#13171e] border border-[#222834]"
                    />
                    <input
                      type="number"
                      min={4}
                      value={mn.cycleDays}
                      onChange={(e) => {
                        const copy = [...configDraft.moons];
                        copy[idx] = { ...mn, cycleDays: Math.max(4, Number(e.target.value) || 28) };
                        setConfigDraft({ ...configDraft, moons: copy });
                      }}
                      className="w-16 px-2 py-1 text-xs font-mono rounded bg-[#13171e] border border-[#222834]"
                      title="Ciclo em dias"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setConfigDraft({
                          ...configDraft,
                          moons: configDraft.moons.filter((x) => x.id !== mn.id),
                        })
                      }
                      className="text-[#6f6b62] hover:text-[#c94a4a] cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Month Grid (2 columns wide) */}
          <div className="lg:col-span-2 p-5 rounded-xl bg-[#13171e] border border-[#222834] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-[#d4a359]" />
                <h2 className="text-sm font-bold text-[#ece8df]">
                  Mês de {activeMonth.name} ({activeMonth.days} dias)
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
                  className="px-2.5 py-1 text-xs rounded-lg bg-[#0e1116] border border-[#222834] text-[#ece8df]"
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
                : ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7']
              ).map((wd, i) => (
                <div key={i} className="text-[10px] font-mono uppercase text-[#6f6b62] truncate">
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
                        ? 'bg-[#d4a359]/20 border-[#d4a359] text-[#ece8df]'
                        : dayHol
                        ? 'bg-[#191e27] border-[#313a4b] text-[#ece8df]'
                        : 'bg-[#0e1116] border-[#222834] text-[#a5a095] hover:border-[#313a4b]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold">{dayNum}</span>
                      {isToday && (
                        <span className="text-[9px] font-mono px-1 rounded bg-[#d4a359] text-[#0b0d10] font-bold">
                          HOJE
                        </span>
                      )}
                    </div>
                    {dayHol && (
                      <div className="text-[10px] text-[#e2b56e] truncate">{dayHol.name}</div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Moons, Weather & Holidays */}
          <div className="space-y-4">
            {/* Lunar Phases */}
            <section className="p-4 rounded-xl bg-[#13171e] border border-[#222834] space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#ece8df]">
                <Moon className="w-4 h-4 text-[#d4a359]" />
                <span>Fases Lunares Atuais</span>
              </div>
              {calendar.moons.map((mn) => {
                const phase = getMoonPhaseLabel(absDay, mn.cycleDays, mn.offsetDays);
                const illumination = Math.round((1 - Math.abs(0.5 - phase.ratio) * 2) * 100);
                return (
                  <div
                    key={mn.id}
                    className="p-3 rounded-lg bg-[#0e1116] border border-[#222834] flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-7 h-7 rounded-full border border-[#313a4b] shrink-0"
                        style={{
                          background: `radial-gradient(circle at ${
                            Math.round(phase.ratio * 100)
                          }% 50%, ${mn.color} 45%, #0b0d10 75%)`,
                        }}
                      />
                      <div>
                        <div className="text-xs font-bold text-[#ece8df]">{mn.name}</div>
                        <div className="text-[11px] text-[#a5a095]">{phase.phaseName}</div>
                      </div>
                    </div>
                    <div className="text-right font-mono text-[11px] text-[#a5a095]">
                      <div>{illumination}% luz</div>
                      <div className="text-[10px] text-[#6f6b62]">Ciclo {mn.cycleDays}d</div>
                    </div>
                  </div>
                );
              })}
            </section>

            {/* Weather Control (GM) */}
            {isGM && (
              <section className="p-4 rounded-xl bg-[#13171e] border border-[#222834] space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#ece8df]">
                  <CloudRain className="w-4 h-4 text-[#4fa3b8]" />
                  <span>Atualizar Clima na Mesa</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={weatherInput}
                    onChange={(e) => setWeatherInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleUpdateWeather()}
                    placeholder={calendar.currentWeather}
                    className="flex-1 px-2.5 py-1.5 text-xs rounded-lg bg-[#0e1116] border border-[#222834] text-[#ece8df]"
                  />
                  <button
                    type="button"
                    onClick={handleUpdateWeather}
                    className="px-3 py-1.5 rounded-lg bg-[#4fa3b8] text-[#0b0d10] font-semibold text-xs cursor-pointer"
                  >
                    Aplicar
                  </button>
                </div>
              </section>
            )}

            {/* Holidays & Festivals */}
            <section className="p-4 rounded-xl bg-[#13171e] border border-[#222834] space-y-2.5">
              <div className="text-xs font-bold text-[#ece8df]">
                Efemérides de {activeMonth.name}
              </div>
              {monthHolidays.length === 0 ? (
                <p className="text-xs text-[#6f6b62]">Nenhum evento fixo neste mês.</p>
              ) : (
                monthHolidays.map((h) => (
                  <div
                    key={h.id}
                    className="flex items-start justify-between gap-2 p-2.5 rounded-lg bg-[#0e1116] border border-[#222834] text-xs"
                  >
                    <div>
                      <div className="font-semibold text-[#ece8df]">
                        Dia {h.day} · {h.name}
                      </div>
                      {h.description && (
                        <div className="text-[11px] text-[#a5a095] mt-0.5">{h.description}</div>
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
                        className="text-[#6f6b62] hover:text-[#c94a4a] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))
              )}

              {isGM && (
                <div className="pt-2 border-t border-[#222834] space-y-2">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={1}
                      max={activeMonth.days}
                      value={holDay}
                      onChange={(e) => setHolDay(Number(e.target.value))}
                      className="w-16 px-2 py-1 text-xs font-mono rounded bg-[#0e1116] border border-[#222834]"
                    />
                    <input
                      type="text"
                      value={holName}
                      onChange={(e) => setHolName(e.target.value)}
                      placeholder="Novo feriado / ritual..."
                      className="flex-1 px-2 py-1 text-xs rounded bg-[#0e1116] border border-[#222834]"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={holDesc}
                      onChange={(e) => setHolDesc(e.target.value)}
                      placeholder="Descrição curta..."
                      className="flex-1 px-2 py-1 text-xs rounded bg-[#0e1116] border border-[#222834]"
                    />
                    <button
                      type="button"
                      onClick={handleAddHoliday}
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#d4a359] text-[#0b0d10] font-semibold text-xs cursor-pointer"
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
