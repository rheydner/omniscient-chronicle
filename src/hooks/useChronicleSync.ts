import { useEffect } from 'react';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toCharacterSummary } from '@/lib/character-mapper';
import { DEFAULT_CALENDAR, useChronicleStore } from '@/store/useChronicleStore';
import type {
  BestiaryCreature,
  CharacterSummary,
  ChronicleDocument,
  ChronicleEdge,
  ChronicleEntity,
  ChronicleFolder,
  ChroniclePresentationPayload,
  ChronosEvent,
  DetectiveClueNode,
  GenealogyTree,
  GrimoireBook,
  RegionalMap,
  RegisteredUser,
  VTTSceneSummary,
  WorldCalendarConfig,
} from '@/types/chronicle';

export function useChronicleSync(roomId: string, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const safeRoom = roomId || 'global-room';
    const store = useChronicleStore.getState();

    const unsubs: Array<() => void> = [];

    // 1. Live Omniscient Sheet Characters (`characters`)
    unsubs.push(
      onSnapshot(
        collection(db, 'characters'),
        (snap) => {
          const map: Record<string, CharacterSummary> = {};
          snap.forEach((d) => {
            map[d.id] = toCharacterSummary(d.id, d.data());
          });
          useChronicleStore.getState().setCharacters(map);
        },
        (err) => console.warn('[Chronicle Sync] characters listener:', err)
      )
    );

    // 2. Registered Players (`users`)
    unsubs.push(
      onSnapshot(
        collection(db, 'users'),
        (snap) => {
          const list: RegisteredUser[] = [];
          snap.forEach((d) => {
            const data = d.data();
            list.push({
              uid: d.id,
              email: typeof data.email === 'string' ? data.email : '',
              name:
                (typeof data.displayName === 'string' && data.displayName) ||
                (typeof data.name === 'string' && data.name) ||
                (typeof data.email === 'string' ? data.email : 'Jogador'),
              photoURL: typeof data.photoURL === 'string' ? data.photoURL : null,
            });
          });
          useChronicleStore.getState().setRegisteredUsers(list);
        },
        (err) => console.warn('[Chronicle Sync] users listener:', err)
      )
    );

    // 3. Live StarStream VTT Scenes (`scenes`) + Active Room (`rooms/{roomId}`)
    unsubs.push(
      onSnapshot(
        collection(db, 'scenes'),
        (snap) => {
          const list: VTTSceneSummary[] = [];
          snap.forEach((d) => {
            const data = d.data();
            const tokens =
              data.tokens && typeof data.tokens === 'object' ? Object.keys(data.tokens).length : 0;
            list.push({
              id: d.id,
              name: typeof data.name === 'string' && data.name ? data.name : 'Cena VTT',
              folderId: typeof data.folderId === 'string' ? data.folderId : null,
              thumbnailUrl: typeof data.thumbnailUrl === 'string' ? data.thumbnailUrl : null,
              mapSrc:
                data.map && typeof data.map === 'object' && typeof data.map.src === 'string'
                  ? data.map.src
                  : null,
              tokenCount: tokens,
            });
          });
          useChronicleStore.getState().setVttScenes(list);
        },
        (err) => console.warn('[Chronicle Sync] scenes listener:', err)
      )
    );

    unsubs.push(
      onSnapshot(
        doc(db, 'rooms', safeRoom),
        (snap) => {
          if (snap.exists()) {
            const d = snap.data();
            const active =
              (typeof d.activeSceneId === 'string' && d.activeSceneId) ||
              (typeof d.playerSceneId === 'string' && d.playerSceneId) ||
              null;
            useChronicleStore
              .getState()
              .setVttScenes(useChronicleStore.getState().vttScenes, active);
          }
        },
        (err) => console.warn('[Chronicle Sync] rooms listener:', err)
      )
    );

    // 4. Chronicle Collections under `vtt_rooms/{roomId}/...`
    unsubs.push(
      onSnapshot(collection(db, 'vtt_rooms', safeRoom, 'chronicle_folders'), (snap) => {
        const map: Record<string, ChronicleFolder> = {};
        snap.forEach((d) => {
          map[d.id] = d.data() as ChronicleFolder;
        });
        useChronicleStore.getState().setFolders(map);
      })
    );

    unsubs.push(
      onSnapshot(collection(db, 'vtt_rooms', safeRoom, 'chronicle_entities'), (snap) => {
        const map: Record<string, ChronicleEntity> = {};
        snap.forEach((d) => {
          map[d.id] = d.data() as ChronicleEntity;
        });
        useChronicleStore.getState().setEntities(map);
        useChronicleStore.getState().setHydrated(true);
      })
    );

    unsubs.push(
      onSnapshot(collection(db, 'vtt_rooms', safeRoom, 'chronicle_documents'), (snap) => {
        const map: Record<string, ChronicleDocument> = {};
        snap.forEach((d) => {
          map[d.id] = d.data() as ChronicleDocument;
        });
        useChronicleStore.getState().setDocuments(map);
      })
    );

    unsubs.push(
      onSnapshot(collection(db, 'vtt_rooms', safeRoom, 'chronicle_edges'), (snap) => {
        const map: Record<string, ChronicleEdge> = {};
        snap.forEach((d) => {
          map[d.id] = d.data() as ChronicleEdge;
        });
        useChronicleStore.getState().setEdges(map);
      })
    );

    unsubs.push(
      onSnapshot(collection(db, 'vtt_rooms', safeRoom, 'chronicle_clues'), (snap) => {
        const map: Record<string, DetectiveClueNode> = {};
        snap.forEach((d) => {
          map[d.id] = d.data() as DetectiveClueNode;
        });
        useChronicleStore.getState().setClues(map);
      })
    );

    unsubs.push(
      onSnapshot(collection(db, 'vtt_rooms', safeRoom, 'chronicle_trees'), (snap) => {
        const map: Record<string, GenealogyTree> = {};
        snap.forEach((d) => {
          map[d.id] = d.data() as GenealogyTree;
        });
        useChronicleStore.getState().setTrees(map);
      })
    );

    unsubs.push(
      onSnapshot(collection(db, 'vtt_rooms', safeRoom, 'chronicle_maps'), (snap) => {
        const map: Record<string, RegionalMap> = {};
        snap.forEach((d) => {
          map[d.id] = d.data() as RegionalMap;
        });
        useChronicleStore.getState().setMaps(map);
      })
    );

    unsubs.push(
      onSnapshot(collection(db, 'vtt_rooms', safeRoom, 'chronicle_events'), (snap) => {
        const map: Record<string, ChronosEvent> = {};
        snap.forEach((d) => {
          map[d.id] = d.data() as ChronosEvent;
        });
        useChronicleStore.getState().setEvents(map);
      })
    );

    unsubs.push(
      onSnapshot(collection(db, 'vtt_rooms', safeRoom, 'chronicle_creatures'), (snap) => {
        const map: Record<string, BestiaryCreature> = {};
        snap.forEach((d) => {
          map[d.id] = d.data() as BestiaryCreature;
        });
        useChronicleStore.getState().setCreatures(map);
      })
    );

    unsubs.push(
      onSnapshot(collection(db, 'vtt_rooms', safeRoom, 'chronicle_books'), (snap) => {
        const map: Record<string, GrimoireBook> = {};
        snap.forEach((d) => {
          map[d.id] = d.data() as GrimoireBook;
        });
        useChronicleStore.getState().setBooks(map);
      })
    );

    unsubs.push(
      onSnapshot(doc(db, 'vtt_rooms', safeRoom, 'chronicle_meta', 'calendar'), (snap) => {
        if (snap.exists()) {
          useChronicleStore.getState().setCalendar(snap.data() as WorldCalendarConfig);
        } else {
          useChronicleStore.getState().setCalendar(DEFAULT_CALENDAR);
        }
      })
    );

    unsubs.push(
      onSnapshot(doc(db, 'vtt_rooms', safeRoom, 'chronicle_meta', 'active_handout'), (snap) => {
        if (snap.exists()) {
          const data = snap.data() as ChroniclePresentationPayload;
          useChronicleStore.getState().setActiveHandout(data.active ? data : null);
        } else {
          useChronicleStore.getState().setActiveHandout(null);
        }
      })
    );

    store.setHydrated(true);

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [roomId, enabled]);
}
