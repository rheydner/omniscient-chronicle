import { create } from 'zustand';
import type {
  BestiaryCreature,
  CharacterSummary,
  ChronicleDocument,
  ChronicleEdge,
  ChronicleEntity,
  ChronicleFolder,
  ChroniclePresentationPayload,
  ChronicleTabId,
  ChronosEvent,
  DetectiveClueNode,
  GenealogyTree,
  GrimoireBook,
  RegionalMap,
  RegisteredUser,
  VTTSceneSummary,
  WorldCalendarConfig,
} from '@/types/chronicle';

export const DEFAULT_CALENDAR: WorldCalendarConfig = {
  worldName: 'Calendário da Campanha',
  currentEraId: 'era-padrao',
  currentYear: 2026,
  currentMonthIndex: 2,
  currentDay: 14,
  currentWeather: 'Céu nublado e garoa fina',
  weekdays: [
    'Domingo',
    'Segunda-feira',
    'Terça-feira',
    'Quarta-feira',
    'Quinta-feira',
    'Sexta-feira',
    'Sábado',
  ],
  months: [
    { id: 'm-01', name: 'Janeiro', days: 31, season: 'Verão' },
    { id: 'm-02', name: 'Fevereiro', days: 28, season: 'Verão' },
    { id: 'm-03', name: 'Março', days: 31, season: 'Outono' },
    { id: 'm-04', name: 'Abril', days: 30, season: 'Outono' },
    { id: 'm-05', name: 'Maio', days: 31, season: 'Outono' },
    { id: 'm-06', name: 'Junho', days: 30, season: 'Inverno' },
    { id: 'm-07', name: 'Julho', days: 31, season: 'Inverno' },
    { id: 'm-08', name: 'Agosto', days: 31, season: 'Inverno' },
    { id: 'm-09', name: 'Setembro', days: 30, season: 'Primavera' },
    { id: 'm-10', name: 'Outubro', days: 31, season: 'Primavera' },
    { id: 'm-11', name: 'Novembro', days: 30, season: 'Primavera' },
    { id: 'm-12', name: 'Dezembro', days: 31, season: 'Verão' },
  ],
  eras: [
    {
      id: 'era-padrao',
      name: 'Calendário Padrão',
      abbreviation: '',
      startYear: 1,
      description: 'Ano corrente real da campanha.',
    },
  ],
  moons: [],
  holidays: [],
  updatedAt: 0,
};

interface ChronicleState {
  roomId: string;
  isEmbeddedVTT: boolean;
  activeTab: ChronicleTabId;
  commandPaletteOpen: boolean;

  // Auth & Role
  userUid: string | null;
  userEmail: string | null;
  userDisplayName: string | null;
  userPhotoURL: string | null;
  isActualGM: boolean;
  isSimulatingPlayer: boolean;

  // Selection / Navigation targets
  selectedEntityId: string | null;
  selectedDocumentId: string | null;
  selectedTreeId: string | null;
  selectedMapId: string | null;
  selectedCreatureId: string | null;
  selectedBookId: string | null;
  floatingSheetCharacterId: string | null;

  // Live Firestore Collections
  isHydrated: boolean;
  characters: Record<string, CharacterSummary>;
  registeredUsers: RegisteredUser[];
  vttScenes: VTTSceneSummary[];
  activeVttSceneId: string | null;

  folders: Record<string, ChronicleFolder>;
  entities: Record<string, ChronicleEntity>;
  documents: Record<string, ChronicleDocument>;
  edges: Record<string, ChronicleEdge>;
  clues: Record<string, DetectiveClueNode>;
  trees: Record<string, GenealogyTree>;
  maps: Record<string, RegionalMap>;
  events: Record<string, ChronosEvent>;
  creatures: Record<string, BestiaryCreature>;
  books: Record<string, GrimoireBook>;
  calendar: WorldCalendarConfig;
  activeHandout: ChroniclePresentationPayload | null;

  // Toast notification
  toastMessage: string | null;

  // Setters
  setRoomContext: (roomId: string, isEmbeddedVTT: boolean) => void;
  setActiveTab: (tab: ChronicleTabId) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setAuthUser: (payload: {
    uid: string | null;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
    isActualGM: boolean;
  }) => void;
  toggleSimulatingPlayer: () => void;

  navigateToEntity: (entityId: string) => void;
  setSelectedEntityId: (id: string | null) => void;
  setSelectedDocumentId: (id: string | null) => void;
  setSelectedTreeId: (id: string | null) => void;
  setSelectedMapId: (id: string | null) => void;
  setSelectedCreatureId: (id: string | null) => void;
  setSelectedBookId: (id: string | null) => void;
  openFloatingSheet: (characterId: string | null) => void;

  setHydrated: (hydrated: boolean) => void;
  setCharacters: (map: Record<string, CharacterSummary>) => void;
  setRegisteredUsers: (list: RegisteredUser[]) => void;
  setVttScenes: (list: VTTSceneSummary[], activeId?: string | null) => void;
  setFolders: (map: Record<string, ChronicleFolder>) => void;
  setEntities: (map: Record<string, ChronicleEntity>) => void;
  setDocuments: (map: Record<string, ChronicleDocument>) => void;
  setEdges: (map: Record<string, ChronicleEdge>) => void;
  setClues: (map: Record<string, DetectiveClueNode>) => void;
  setTrees: (map: Record<string, GenealogyTree>) => void;
  setMaps: (map: Record<string, RegionalMap>) => void;
  setEvents: (map: Record<string, ChronosEvent>) => void;
  setCreatures: (map: Record<string, BestiaryCreature>) => void;
  setBooks: (map: Record<string, GrimoireBook>) => void;
  setCalendar: (cal: WorldCalendarConfig) => void;
  setActiveHandout: (handout: ChroniclePresentationPayload | null) => void;
  showToast: (msg: string) => void;
}

export const useChronicleStore = create<ChronicleState>()((set, get) => ({
  roomId: 'global-room',
  isEmbeddedVTT: false,
  activeTab: 'wiki',
  commandPaletteOpen: false,

  userUid: null,
  userEmail: null,
  userDisplayName: null,
  userPhotoURL: null,
  isActualGM: false,
  isSimulatingPlayer: false,

  selectedEntityId: null,
  selectedDocumentId: null,
  selectedTreeId: null,
  selectedMapId: null,
  selectedCreatureId: null,
  selectedBookId: null,
  floatingSheetCharacterId: null,

  isHydrated: false,
  characters: {},
  registeredUsers: [],
  vttScenes: [],
  activeVttSceneId: null,

  folders: {},
  entities: {},
  documents: {},
  edges: {},
  clues: {},
  trees: {},
  maps: {},
  events: {},
  creatures: {},
  books: {},
  calendar: DEFAULT_CALENDAR,
  activeHandout: null,

  toastMessage: null,

  setRoomContext: (roomId, isEmbeddedVTT) =>
    set({ roomId: roomId || 'global-room', isEmbeddedVTT }),

  setActiveTab: (activeTab) => set({ activeTab }),
  setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),

  setAuthUser: ({ uid, email, displayName, photoURL, isActualGM }) =>
    set({
      userUid: uid,
      userEmail: email,
      userDisplayName: displayName,
      userPhotoURL: photoURL,
      isActualGM,
      isSimulatingPlayer: isActualGM ? false : false,
    }),

  toggleSimulatingPlayer: () =>
    set((s) => ({ isSimulatingPlayer: s.isActualGM ? !s.isSimulatingPlayer : false })),

  navigateToEntity: (entityId) =>
    set({ activeTab: 'wiki', selectedEntityId: entityId }),

  setSelectedEntityId: (selectedEntityId) => set({ selectedEntityId }),
  setSelectedDocumentId: (selectedDocumentId) => set({ selectedDocumentId }),
  setSelectedTreeId: (selectedTreeId) => set({ selectedTreeId }),
  setSelectedMapId: (selectedMapId) => set({ selectedMapId }),
  setSelectedCreatureId: (selectedCreatureId) => set({ selectedCreatureId }),
  setSelectedBookId: (selectedBookId) => set({ selectedBookId }),
  openFloatingSheet: (floatingSheetCharacterId) => {
    if (
      floatingSheetCharacterId &&
      get().isEmbeddedVTT &&
      typeof window !== 'undefined' &&
      window.parent &&
      window.parent !== window
    ) {
      const charName = get().characters[floatingSheetCharacterId]?.name || 'Personagem';
      window.parent.postMessage(
        {
          type: 'CHRONICLE_OPEN_SHEET',
          characterId: floatingSheetCharacterId,
          characterName: charName,
        },
        '*'
      );
      return;
    }
    set({ floatingSheetCharacterId });
  },

  setHydrated: (isHydrated) => set({ isHydrated }),
  setCharacters: (characters) => set({ characters }),
  setRegisteredUsers: (registeredUsers) => set({ registeredUsers }),
  setVttScenes: (vttScenes, activeId) =>
    set((s) => ({
      vttScenes,
      activeVttSceneId: activeId !== undefined ? activeId : s.activeVttSceneId,
    })),
  setFolders: (folders) => set({ folders }),
  setEntities: (entities) => set({ entities }),
  setDocuments: (documents) => set({ documents }),
  setEdges: (edges) => set({ edges }),
  setClues: (clues) => set({ clues }),
  setTrees: (trees) => set({ trees }),
  setMaps: (maps) => set({ maps }),
  setEvents: (events) => set({ events }),
  setCreatures: (creatures) => set({ creatures }),
  setBooks: (books) => set({ books }),
  setCalendar: (calendar) => set({ calendar }),
  setActiveHandout: (activeHandout) => set({ activeHandout }),

  showToast: (msg) => {
    set({ toastMessage: msg });
    setTimeout(() => {
      set((s) => (s.toastMessage === msg ? { toastMessage: null } : {}));
    }, 3200);
  },
}));

/** Seletor reativo que respeita o modo "Simular Visão de Jogador" do Mestre */
export function useEffectiveGM(): boolean {
  const isActualGM = useChronicleStore((s) => s.isActualGM);
  const isSimulatingPlayer = useChronicleStore((s) => s.isSimulatingPlayer);
  return isActualGM && !isSimulatingPlayer;
}
