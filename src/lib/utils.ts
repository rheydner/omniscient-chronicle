import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { WorldCalendarConfig, WorldClockPayload } from '@/types/chronicle';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function sanitizeForFirestore<T>(obj: T): T {
  return JSON.parse(
    JSON.stringify(obj, (_k, v) => (v === undefined ? null : v))
  );
}

export function extractYouTubeVideoId(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/,
    /^([A-Za-z0-9_-]{11})$/,
  ];
  for (const re of patterns) {
    const match = trimmed.match(re);
    if (match?.[1]) return match[1];
  }
  return null;
}

export function formatSeconds(sec: number): string {
  const safe = Math.max(0, Math.floor(sec));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Calcula o número absoluto de dias transcorridos desde o Ano 1, Mês 0, Dia 1
 * para determinar dia da semana e fases lunares de forma determinística.
 */
export function getAbsoluteDayCount(
  cal: Pick<WorldCalendarConfig, 'months'>,
  year: number,
  monthIndex: number,
  day: number
): number {
  const daysPerYear = cal.months.reduce((acc, m) => acc + Math.max(1, m.days), 0) || 360;
  const safeMonthIdx = Math.max(0, Math.min(cal.months.length - 1, monthIndex));
  let daysBeforeMonth = 0;
  for (let i = 0; i < safeMonthIdx; i++) {
    daysBeforeMonth += Math.max(1, cal.months[i].days);
  }
  return (year - 1) * daysPerYear + daysBeforeMonth + (day - 1);
}

export function getMoonPhaseLabel(
  absDay: number,
  cycleDays: number,
  offsetDays: number
): { phaseName: string; ratio: number } {
  const safeCycle = Math.max(4, cycleDays);
  const pos = (((absDay + offsetDays) % safeCycle) + safeCycle) % safeCycle;
  const ratio = pos / safeCycle;

  if (ratio < 0.08 || ratio >= 0.92) return { phaseName: 'Lua Nova', ratio };
  if (ratio < 0.22) return { phaseName: 'Crescente Inicial', ratio };
  if (ratio < 0.34) return { phaseName: 'Quarto Crescente', ratio };
  if (ratio < 0.46) return { phaseName: 'Gibosa Crescente', ratio };
  if (ratio < 0.56) return { phaseName: 'Lua Cheia', ratio };
  if (ratio < 0.68) return { phaseName: 'Gibosa Minguante', ratio };
  if (ratio < 0.80) return { phaseName: 'Quarto Minguante', ratio };
  return { phaseName: 'Minguante Final', ratio };
}

export function buildWorldClockPayload(cal: WorldCalendarConfig): WorldClockPayload {
  const month = cal.months[cal.currentMonthIndex] || cal.months[0] || {
    id: 'm1',
    name: 'Bruma',
    days: 30,
    season: 'Outono',
  };
  const era = cal.eras.find((e) => e.id === cal.currentEraId) || cal.eras[0] || {
    id: 'era-1',
    name: 'Era Atual',
    abbreviation: 'E.A.',
    startYear: 1,
  };
  const absDay = getAbsoluteDayCount(cal, cal.currentYear, cal.currentMonthIndex, cal.currentDay);
  const weekdayList = cal.weekdays.length > 0 ? cal.weekdays : ['1º Dia'];
  const weekdayName = weekdayList[((absDay % weekdayList.length) + weekdayList.length) % weekdayList.length];

  const moonParts = cal.moons.map((m) => {
    const phase = getMoonPhaseLabel(absDay, m.cycleDays, m.offsetDays);
    return `${m.name}: ${phase.phaseName}`;
  });

  return {
    worldName: cal.worldName,
    dateLabel: `Dia ${cal.currentDay} de ${month.name}, Ano ${cal.currentYear} ${era.abbreviation}`,
    eraAbbreviation: era.abbreviation,
    year: cal.currentYear,
    monthIndex: cal.currentMonthIndex,
    monthName: month.name,
    day: cal.currentDay,
    weekdayName,
    season: month.season,
    moonSummary: moonParts.join(' · ') || 'Céu encoberto',
    weather: cal.currentWeather || 'Neblina fria',
    updatedAt: Date.now(),
  };
}
