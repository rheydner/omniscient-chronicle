import type { DocumentData } from 'firebase/firestore';
import type { CharacterSummary, CharacterAttack, CustomBar } from '@/types/chronicle';

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim());
}

/**
 * Converte documento bruto de `characters/{id}` (Omniscient Sheet) para uso em tempo real
 * no Omniscient Chronicle (Smart Tooltips, Posse de Cartas, Grafo e Genealogia).
 */
export function toCharacterSummary(id: string, data: DocumentData): CharacterSummary {
  const mainStatsRecord = asRecord(data.mainStats);
  const vitals = asRecord(mainStatsRecord.vitals);
  const avatar = asString(data.avatarUrl) || asString(data.portraitUrl);

  const rawAttacks = Array.isArray(mainStatsRecord.attacks)
    ? (mainStatsRecord.attacks as Array<Record<string, unknown>>)
    : Array.isArray(data.attacks)
    ? (data.attacks as Array<Record<string, unknown>>)
    : [];

  const attacks: CharacterAttack[] = rawAttacks
    .filter((a) => a && typeof a === 'object')
    .map((a, idx) => ({
      id: asString(a.id) || `attack-${idx}`,
      name: asString(a.name) || 'Ataque',
      test: asString(a.test),
      bonus: asNumber(a.bonus, 0),
      damage: asString(a.damage),
      critical: asString(a.critical),
      range: asString(a.range),
      special: asString(a.special),
    }));

  const defenseEquip = asNumber(vitals.defenseEquip, 0);
  const defenseOther = asNumber(vitals.defenseOther, 0);
  const defenseBase = 10;
  const defense =
    defenseEquip > 0 || defenseOther !== 0
      ? defenseBase + defenseEquip + defenseOther
      : asNumber(vitals.armorClass, defenseBase);

  const initiative = asNumber(vitals.initiative, 0);

  const rawSkills = Array.isArray(mainStatsRecord.skills)
    ? (mainStatsRecord.skills as Array<Record<string, unknown>>)
    : [];
  const perceptionSkill = rawSkills.find(
    (s) => typeof s?.name === 'string' && s.name.toLowerCase().includes('percep')
  );
  const perceptionBonus = perceptionSkill
    ? asNumber(perceptionSkill.otherBonus, 0) + (Boolean(perceptionSkill.isTrained) ? 5 : 0)
    : asNumber(vitals.atencaoOther, 0);
  const passivePerception = 10 + perceptionBonus;

  const rawConditions = asRecord(mainStatsRecord.conditions);
  const conditions: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(rawConditions)) {
    if (typeof v === 'boolean') {
      conditions[k] = v;
    }
  }

  const rawCustomBars = Array.isArray(mainStatsRecord.customBars)
    ? (mainStatsRecord.customBars as Array<Record<string, unknown>>)
    : [];
  const customBars: CustomBar[] = rawCustomBars
    .filter((b) => b && typeof b === 'object')
    .map((b, idx) => ({
      id: asString(b.id) || `bar-${idx}`,
      label: asString(b.label) || `Barra ${idx + 1}`,
      current: asNumber(b.current, 0),
      max: asNumber(b.max, 10),
    }));

  return {
    id,
    userId: asString(data.userId) || asString(data.uid),
    ownerId: asString(data.ownerId),
    userEmail: asString(data.userEmail),
    ownerEmail: asString(data.ownerEmail),
    createdBy: asString(data.createdBy),
    name: asString(data.name).trim() || 'Sem nome',
    avatarUrl: avatar || null,
    tokenImageUrl: asString(data.tokenImageUrl) || null,
    controlledBy: asString(data.controlledBy),
    allowedUsers: asStringArray(data.allowedUsers),
    className: asString(data.className),
    level: asNumber(data.level, 1),
    status: asString(data.status, 'active'),
    hp: {
      current: asNumber(vitals.currentHp),
      max: asNumber(vitals.maxHp),
      temp: asNumber(vitals.temporaryHp, 0),
    },
    energy: {
      current: asNumber(vitals.currentEnergy),
      max: asNumber(vitals.maxEnergy),
      temp: asNumber(vitals.temporaryEnergy, 0),
    },
    sanity: {
      current: asNumber(vitals.currentSanity),
      max: asNumber(vitals.maxSanity),
      temp: 0,
    },
    integrity: {
      current: asNumber(vitals.currentSoul, asNumber(vitals.currentIntegrity, 0)),
      max: asNumber(vitals.maxSoul, asNumber(vitals.maxIntegrity, 0)),
      temp: 0,
    },
    attacks,
    defense,
    initiative,
    passivePerception,
    conditions,
    customBars,
  };
}
