export type ChronicleTabId =
  | 'wiki'
  | 'journal'
  | 'graph'
  | 'genealogy'
  | 'maps'
  | 'chronos'
  | 'calendar'
  | 'bestiary'
  | 'grimoire'
  | 'obsidian';

// ---------------------------------------------------------------------------
// Ecossistema Compartilhado: Omniscient Sheet & StarStream VTT
// ---------------------------------------------------------------------------

export interface StatPool {
  current: number;
  max: number;
  temp: number;
}

export interface CustomBar {
  id: string;
  label: string;
  current: number;
  max: number;
}

export interface CharacterAttack {
  id: string;
  name: string;
  test?: string;
  bonus?: number;
  damage?: string;
  critical?: string;
  range?: string;
  special?: string;
}

export interface CharacterSummary {
  id: string;
  userId?: string;
  ownerId?: string;
  userEmail?: string;
  ownerEmail?: string;
  createdBy?: string;
  name: string;
  avatarUrl: string | null;
  tokenImageUrl?: string | null;
  controlledBy?: string;
  allowedUsers?: string[];
  className: string;
  level: number;
  status: string;
  hp: StatPool;
  energy: StatPool;
  sanity: StatPool;
  integrity: StatPool;
  attacks?: CharacterAttack[];
  defense?: number;
  initiative?: number;
  passivePerception?: number;
  conditions?: Record<string, boolean>;
  customBars?: CustomBar[];
}

export interface RegisteredUser {
  uid: string;
  email: string;
  name: string;
  photoURL?: string | null;
}

export interface VTTSceneSummary {
  id: string;
  name: string;
  folderId?: string | null;
  thumbnailUrl?: string | null;
  mapSrc?: string | null;
  tokenCount: number;
}

export interface WorldClockPayload {
  worldName: string;
  dateLabel: string;
  eraAbbreviation: string;
  year: number;
  monthIndex: number;
  monthName: string;
  day: number;
  weekdayName: string;
  season: string;
  moonSummary: string;
  weather: string;
  updatedAt: number;
}

export interface ChroniclePresentationPayload {
  active: boolean;
  mode: 'chronicle-doc' | 'image';
  docId?: string;
  title: string;
  code?: string;
  paperTheme: DocumentPaperTheme;
  content?: string;
  unlockedRedactions?: string[];
  imageUrl?: string;
  caption?: string;
  possessionMode: DocumentPossessionMode;
  holderCharacterId?: string | null;
  holderUserId?: string | null;
  holderEmail?: string | null;
  holderName?: string | null;
  presentedAt: number;
}

// ---------------------------------------------------------------------------
// Fase 1: Wiki / Atlas Modular, Tarjas Pretas & Diário / Cartas com Posse
// ---------------------------------------------------------------------------

export type EntityCategory =
  | 'character'
  | 'location'
  | 'faction'
  | 'item'
  | 'case'
  | 'event'
  | 'custom';

export interface CustomField {
  id: string;
  label: string;
  value: string;
}

export interface AudioClipBlock {
  id: string;
  title: string;
  youtubeUrl: string;
  startSec: number;
  endSec: number;
  notes?: string;
}

export interface ChronicleFolder {
  id: string;
  name: string;
  scope: 'wiki' | 'journal';
  parentId: string | null;
  order: number;
  createdAt: number;
}

export interface EventDateStamp {
  eraId: string;
  year: number;
  monthIndex: number;
  day: number;
}

export interface ChronicleEntity {
  id: string;
  title: string;
  subtitle?: string;
  category: EntityCategory;
  customCategoryLabel?: string;
  folderId: string | null;
  tags: string[];
  imageUrl?: string | null;
  bannerUrl?: string | null;
  linkedCharacterId?: string | null;
  linkedSceneId?: string | null;
  content: string;
  unlockedRedactions: string[];
  gmSecretNotes?: string;
  customFields: CustomField[];
  audioClips: AudioClipBlock[];
  isPublicToPlayers: boolean;
  eventDate?: EventDateStamp | null;
  updatedAt: number;
  createdAt: number;
}

export type DocumentPaperTheme = 'dark-dossier' | 'sepia-parchment' | 'typewriter-report';
export type DocumentPossessionMode = 'gm-vault' | 'single-holder' | 'party-public';

export interface ChronicleDocument {
  id: string;
  title: string;
  code?: string;
  folderId: string | null;
  paperTheme: DocumentPaperTheme;
  possessionMode: DocumentPossessionMode;
  holderCharacterId: string | null;
  holderUserId: string | null;
  holderEmail?: string | null;
  holderName: string | null;
  imageUrl?: string | null;
  content: string;
  unlockedRedactions: string[];
  audioClips: AudioClipBlock[];
  updatedAt: number;
  createdAt: number;
}

// ---------------------------------------------------------------------------
// Fase 2: Grafo, Quadro de Detetive, Genealogia & Cartografia
// ---------------------------------------------------------------------------

export type RelationKind =
  | 'ally'
  | 'enemy'
  | 'blood'
  | 'marriage'
  | 'faction'
  | 'suspect'
  | 'location'
  | 'theory';

export interface ChronicleEdge {
  id: string;
  sourceId: string;
  sourceType: 'entity' | 'character' | 'clue';
  targetId: string;
  targetType: 'entity' | 'character' | 'clue';
  label: string;
  kind: RelationKind;
  isSecretGM: boolean;
  isPlayerTheory: boolean;
  authorName?: string;
  createdAt: number;
}

export interface DetectiveClueNode {
  id: string;
  title: string;
  body: string;
  tone: 'brass' | 'crimson' | 'slate' | 'paper';
  x: number;
  y: number;
  linkedEntityId?: string | null;
  isSecretGM: boolean;
  authorName: string;
  createdAt: number;
}

export type MemberStatus = 'alive' | 'deceased' | 'missing' | 'unknown';

export interface GenealogyMember {
  id: string;
  name: string;
  role: string;
  generation: number;
  order: number;
  entityId?: string | null;
  characterId?: string | null;
  avatarUrl?: string | null;
  status: MemberStatus;
  isIdentityHidden: boolean;
  hiddenAlias?: string;
}

export interface GenealogyBond {
  id: string;
  fromMemberId: string;
  toMemberId: string;
  type: 'parent' | 'marriage' | 'command';
  label?: string;
  isSecretGM?: boolean;
}

export interface GenealogyTree {
  id: string;
  name: string;
  subtitle?: string;
  kind: 'family' | 'faction';
  members: GenealogyMember[];
  bonds: GenealogyBond[];
  isPublicToPlayers: boolean;
  updatedAt: number;
}

export type MapPinKind = 'city' | 'dungeon' | 'landmark' | 'danger' | 'hq';
export type TravelMode = 'foot' | 'mount' | 'ship' | 'vehicle';

export interface MapCoord {
  xPercent: number;
  yPercent: number;
}

export interface MapPin {
  id: string;
  label: string;
  xPercent: number;
  yPercent: number;
  kind: MapPinKind;
  entityId?: string | null;
  vttSceneId?: string | null;
  notes?: string;
  isPublicToPlayers: boolean;
}

export interface MapRegion {
  id: string;
  label: string;
  color: string;
  points: MapCoord[];
  factionEntityId?: string | null;
  isPublicToPlayers: boolean;
}

export interface MapRoute {
  id: string;
  label: string;
  mode: TravelMode;
  points: MapCoord[];
  isPublicToPlayers: boolean;
}

export interface RegionalMap {
  id: string;
  name: string;
  subtitle?: string;
  imageUrl: string;
  scaleKmPer100Px: number;
  isPublicToPlayers: boolean;
  pins: MapPin[];
  regions: MapRegion[];
  routes: MapRoute[];
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// Fase 3: Calendário, Cronos, Bestiário & Grimório / Livros
// ---------------------------------------------------------------------------

export interface CalendarMonth {
  id: string;
  name: string;
  days: number;
  season: string;
}

export interface CalendarEra {
  id: string;
  name: string;
  abbreviation: string;
  startYear: number;
  description?: string;
}

export interface CalendarMoon {
  id: string;
  name: string;
  cycleDays: number;
  offsetDays: number;
  color: string;
}

export interface CalendarHoliday {
  id: string;
  name: string;
  monthIndex: number;
  day: number;
  description?: string;
}

export interface WorldCalendarConfig {
  worldName: string;
  currentEraId: string;
  currentYear: number;
  currentMonthIndex: number;
  currentDay: number;
  currentWeather: string;
  weekdays: string[];
  months: CalendarMonth[];
  eras: CalendarEra[];
  moons: CalendarMoon[];
  holidays: CalendarHoliday[];
  updatedAt: number;
}

export type ChronosEventCategory =
  | 'session'
  | 'investigation'
  | 'incident'
  | 'operation'
  | 'milestone'
  | 'document';

export interface ChronosEvent {
  id: string;
  title: string;
  summary: string;
  eraId: string;
  year: number;
  monthIndex: number;
  day: number;
  category: ChronosEventCategory;
  linkedEntityId?: string | null;
  isPublicToPlayers: boolean;
  createdAt: number;
}

export interface CreatureAttackEntry {
  id: string;
  name: string;
  bonus: string;
  damage: string;
  notes?: string;
}

export interface BestiaryCreature {
  id: string;
  name: string;
  title?: string;
  threatGrade: string;
  creatureType: string;
  imageUrl?: string | null;
  tokenUrl?: string | null;
  hpMax: number;
  energyMax: number;
  defense: number;
  initiative: number;
  speed: string;
  sizeCells: 1 | 2 | 3;
  attacks: CreatureAttackEntry[];
  traits: string;
  lore: string;
  unlockedRedactions: string[];
  isKnownByPlayers: boolean;
  showStatsToPlayers: boolean;
  updatedAt: number;
}

export interface BookChapter {
  id: string;
  title: string;
  order: number;
  content: string;
  unlockedRedactions: string[];
}

export interface GlossaryTerm {
  id: string;
  term: string;
  category: string;
  definition: string;
}

export interface GrimoireBook {
  id: string;
  title: string;
  subtitle?: string;
  author?: string;
  accentColor: string;
  isPublicToPlayers: boolean;
  chapters: BookChapter[];
  glossary: GlossaryTerm[];
  updatedAt: number;
}
