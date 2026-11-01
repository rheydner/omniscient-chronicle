import {
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { buildWorldClockPayload, sanitizeForFirestore } from './utils';
import { createMentionSyntax } from './markdown-engine';
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
  DocumentPossessionMode,
  GenealogyTree,
  GrimoireBook,
  RegionalMap,
  WorldCalendarConfig,
} from '@/types/chronicle';

function roomColDoc(roomId: string, subcol: string, id: string) {
  return doc(db, 'vtt_rooms', roomId || 'global-room', subcol, id);
}

// ---------------------------------------------------------------------------
// Pastas & Wiki / Atlas
// ---------------------------------------------------------------------------

export async function saveFolder(roomId: string, folder: ChronicleFolder): Promise<void> {
  await setDoc(roomColDoc(roomId, 'chronicle_folders', folder.id), sanitizeForFirestore(folder), {
    merge: true,
  });
}

export async function deleteFolder(roomId: string, folderId: string): Promise<void> {
  await deleteDoc(roomColDoc(roomId, 'chronicle_folders', folderId));
}

export async function saveEntity(roomId: string, entity: ChronicleEntity): Promise<void> {
  const payload: ChronicleEntity = {
    ...entity,
    updatedAt: Date.now(),
  };
  await setDoc(roomColDoc(roomId, 'chronicle_entities', entity.id), sanitizeForFirestore(payload), {
    merge: true,
  });
}

export async function deleteEntity(roomId: string, entityId: string): Promise<void> {
  await deleteDoc(roomColDoc(roomId, 'chronicle_entities', entityId));
}

export async function toggleEntityRedaction(
  roomId: string,
  entity: ChronicleEntity,
  redactionId: string
): Promise<void> {
  const set = new Set(entity.unlockedRedactions || []);
  if (set.has(redactionId)) {
    set.delete(redactionId);
  } else {
    set.add(redactionId);
  }
  await saveEntity(roomId, {
    ...entity,
    unlockedRedactions: Array.from(set),
  });
}

// ---------------------------------------------------------------------------
// Diário, Posse Física de Cartas & Projeção Cinematográfica no VTT
// ---------------------------------------------------------------------------

export async function saveDocument(roomId: string, documentItem: ChronicleDocument): Promise<void> {
  const payload: ChronicleDocument = {
    ...documentItem,
    updatedAt: Date.now(),
  };
  await setDoc(
    roomColDoc(roomId, 'chronicle_documents', documentItem.id),
    sanitizeForFirestore(payload),
    { merge: true }
  );

  // Se este documento estiver projetado ao vivo no VTT, sincroniza as tarjas/conteúdo em tempo real
  const activeHandout = useChronicleStore.getState().activeHandout;
  if (activeHandout?.active && activeHandout.docId === documentItem.id) {
    await projectDocumentToVTT(roomId, payload, true);
  }
}

export async function deleteDocument(roomId: string, docId: string): Promise<void> {
  const activeHandout = useChronicleStore.getState().activeHandout;
  if (activeHandout?.active && activeHandout.docId === docId) {
    await stopVTTProjection(roomId);
  }
  await deleteDoc(roomColDoc(roomId, 'chronicle_documents', docId));
}

export async function toggleDocumentRedaction(
  roomId: string,
  documentItem: ChronicleDocument,
  redactionId: string
): Promise<void> {
  const set = new Set(documentItem.unlockedRedactions || []);
  if (set.has(redactionId)) {
    set.delete(redactionId);
  } else {
    set.add(redactionId);
  }
  await saveDocument(roomId, {
    ...documentItem,
    unlockedRedactions: Array.from(set),
  });
}

export async function assignDocumentPossession(
  roomId: string,
  documentItem: ChronicleDocument,
  mode: DocumentPossessionMode,
  holder?: {
    characterId?: string | null;
    userId?: string | null;
    email?: string | null;
    name?: string | null;
  }
): Promise<void> {
  await saveDocument(roomId, {
    ...documentItem,
    possessionMode: mode,
    holderCharacterId: mode === 'single-holder' ? holder?.characterId ?? null : null,
    holderUserId: mode === 'single-holder' ? holder?.userId ?? null : null,
    holderEmail: mode === 'single-holder' ? holder?.email ?? null : null,
    holderName: mode === 'single-holder' ? holder?.name ?? null : null,
  });
}

export async function projectDocumentToVTT(
  roomId: string,
  documentItem: ChronicleDocument,
  keepTimestamp = false
): Promise<void> {
  const current = useChronicleStore.getState().activeHandout;
  const payload: ChroniclePresentationPayload = {
    active: true,
    mode: 'chronicle-doc',
    docId: documentItem.id,
    title: documentItem.title,
    code: documentItem.code || 'DOSSIÊ',
    paperTheme: documentItem.paperTheme,
    content: documentItem.content,
    unlockedRedactions: documentItem.unlockedRedactions || [],
    imageUrl: documentItem.imageUrl || undefined,
    possessionMode: documentItem.possessionMode,
    holderCharacterId: documentItem.holderCharacterId,
    holderUserId: documentItem.holderUserId,
    holderEmail: documentItem.holderEmail || null,
    holderName: documentItem.holderName,
    presentedAt: keepTimestamp && current?.presentedAt ? current.presentedAt : Date.now(),
  };

  await setDoc(
    roomColDoc(roomId, 'chronicle_meta', 'active_handout'),
    sanitizeForFirestore(payload)
  );
}

export async function stopVTTProjection(roomId: string): Promise<void> {
  await setDoc(roomColDoc(roomId, 'chronicle_meta', 'active_handout'), {
    active: false,
    presentedAt: 0,
  });
}

// ---------------------------------------------------------------------------
// Grafo, Quadro de Detetive, Genealogia & Cartografia
// ---------------------------------------------------------------------------

export async function saveEdge(roomId: string, edge: ChronicleEdge): Promise<void> {
  await setDoc(roomColDoc(roomId, 'chronicle_edges', edge.id), sanitizeForFirestore(edge), {
    merge: true,
  });
}

export async function deleteEdge(roomId: string, edgeId: string): Promise<void> {
  await deleteDoc(roomColDoc(roomId, 'chronicle_edges', edgeId));
}

export async function saveClue(roomId: string, clue: DetectiveClueNode): Promise<void> {
  await setDoc(roomColDoc(roomId, 'chronicle_clues', clue.id), sanitizeForFirestore(clue), {
    merge: true,
  });
}

export async function deleteClue(roomId: string, clueId: string): Promise<void> {
  await deleteDoc(roomColDoc(roomId, 'chronicle_clues', clueId));
}

export async function saveGenealogyTree(roomId: string, tree: GenealogyTree): Promise<void> {
  await setDoc(
    roomColDoc(roomId, 'chronicle_trees', tree.id),
    sanitizeForFirestore({ ...tree, updatedAt: Date.now() }),
    { merge: true }
  );
}

export async function deleteGenealogyTree(roomId: string, treeId: string): Promise<void> {
  await deleteDoc(roomColDoc(roomId, 'chronicle_trees', treeId));
}

export async function saveRegionalMap(roomId: string, map: RegionalMap): Promise<void> {
  await setDoc(
    roomColDoc(roomId, 'chronicle_maps', map.id),
    sanitizeForFirestore({ ...map, updatedAt: Date.now() }),
    { merge: true }
  );
}

export async function deleteRegionalMap(roomId: string, mapId: string): Promise<void> {
  await deleteDoc(roomColDoc(roomId, 'chronicle_maps', mapId));
}

export async function moveVTTPlayersToScene(roomId: string, sceneId: string): Promise<boolean> {
  try {
    const safeRoom = roomId || 'global-room';
    const roomRef = doc(db, 'rooms', safeRoom);
    const existing = await getDoc(roomRef);
    const payload: Record<string, unknown> = {
      playerSceneId: sceneId,
      activeSceneId: sceneId,
      updatedAt: Date.now(),
    };
    if (!existing.exists() && auth.currentUser?.uid) {
      payload.gmId = auth.currentUser.uid;
    }
    await setDoc(roomRef, payload, { merge: true });
    return true;
  } catch (err) {
    console.warn('[Chronicle -> VTT] Falha ao mover jogadores para cena:', err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Calendário, Relógio do Mundo no VTT, Cronos, Bestiário & Grimório
// ---------------------------------------------------------------------------

export async function saveCalendarConfig(
  roomId: string,
  config: WorldCalendarConfig
): Promise<void> {
  const updated: WorldCalendarConfig = {
    ...config,
    updatedAt: Date.now(),
  };
  await setDoc(roomColDoc(roomId, 'chronicle_meta', 'calendar'), sanitizeForFirestore(updated));

  const worldClock = buildWorldClockPayload(updated);
  await setDoc(
    roomColDoc(roomId, 'chronicle_meta', 'world_clock'),
    sanitizeForFirestore(worldClock)
  );
}

export async function stepCalendarDays(
  roomId: string,
  current: WorldCalendarConfig,
  deltaDays: number
): Promise<void> {
  if (!current.months.length) return;
  let year = current.currentYear;
  let mIdx = Math.max(0, Math.min(current.months.length - 1, current.currentMonthIndex));
  let day = current.currentDay + deltaDays;

  while (day > current.months[mIdx].days) {
    day -= current.months[mIdx].days;
    mIdx += 1;
    if (mIdx >= current.months.length) {
      mIdx = 0;
      year += 1;
    }
  }

  while (day < 1) {
    mIdx -= 1;
    if (mIdx < 0) {
      mIdx = current.months.length - 1;
      year = Math.max(1, year - 1);
    }
    day += current.months[mIdx].days;
  }

  await saveCalendarConfig(roomId, {
    ...current,
    currentYear: year,
    currentMonthIndex: mIdx,
    currentDay: day,
  });
}

export async function saveChronosEvent(roomId: string, ev: ChronosEvent): Promise<void> {
  await setDoc(roomColDoc(roomId, 'chronicle_events', ev.id), sanitizeForFirestore(ev), {
    merge: true,
  });
}

export async function deleteChronosEvent(roomId: string, evId: string): Promise<void> {
  await deleteDoc(roomColDoc(roomId, 'chronicle_events', evId));
}

export async function saveCreature(roomId: string, creature: BestiaryCreature): Promise<void> {
  await setDoc(
    roomColDoc(roomId, 'chronicle_creatures', creature.id),
    sanitizeForFirestore({ ...creature, updatedAt: Date.now() }),
    { merge: true }
  );
}

export async function deleteCreature(roomId: string, creatureId: string): Promise<void> {
  await deleteDoc(roomColDoc(roomId, 'chronicle_creatures', creatureId));
}

function buildFallbackCreatureTokenDataUri(creature: BestiaryCreature): string {
  const words = creature.name.trim().split(/\s+/).filter(Boolean);
  const initials = (
    words.length >= 2
      ? `${words[0][0]}${words[1][0]}`
      : (creature.name.slice(0, 2) || 'CR')
  ).toUpperCase();
  const gradeShort = (creature.threatGrade || 'Ameaça').slice(0, 10).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><defs><radialGradient id="g" cx="50%" cy="40%" r="60%"><stop offset="0%" stop-color="#1d222d"/><stop offset="100%" stop-color="#0b0d10"/></radialGradient></defs><circle cx="128" cy="128" r="120" fill="url(#g)" stroke="#d4953a" stroke-width="10"/><circle cx="128" cy="128" r="104" fill="none" stroke="#c94a4a" stroke-opacity="0.55" stroke-width="3" stroke-dasharray="10 6"/><text x="128" y="138" text-anchor="middle" fill="#ece8df" font-family="sans-serif" font-weight="800" font-size="74">${initials.replace(/[<>&"']/g, '')}</text><text x="128" y="188" text-anchor="middle" fill="#d4953a" font-family="monospace" font-weight="700" font-size="22">${gradeShort.replace(/[<>&"']/g, '')}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export async function spawnCreatureToVTTScene(
  sceneId: string,
  creature: BestiaryCreature,
  options: { count: number; layer: 'token' | 'gm' }
): Promise<number> {
  const sceneRef = doc(db, 'scenes', sceneId);
  const snap = await getDoc(sceneRef);
  if (!snap.exists()) {
    throw new Error('Cena do StarStream VTT não encontrada.');
  }

  const data = snap.data();
  const existingTokens =
    data.tokens && typeof data.tokens === 'object'
      ? ({ ...(data.tokens as Record<string, unknown>) } as Record<string, unknown>)
      : {};
  const existingOrder = Array.isArray(data.tokenOrder) ? [...(data.tokenOrder as string[])] : [];

  const count = Math.max(1, Math.min(8, options.count));
  const cellPx = 70;
  const sizePx = cellPx * (creature.sizeCells || 1);
  const resolvedTokenImg =
    creature.tokenUrl || creature.imageUrl || buildFallbackCreatureTokenDataUri(creature);

  for (let i = 0; i < count; i++) {
    const tokenId = crypto.randomUUID();
    const tokenName = count > 1 ? `${creature.name} ${i + 1}` : creature.name;
    existingTokens[tokenId] = {
      id: tokenId,
      type: 'generic',
      characterId: null,
      imgUrl: resolvedTokenImg,
      ownerId: null,
      allowedUsers: [],
      name: tokenName,
      showName: true,
      conditions: [],
      layer: options.layer,
      x: 350 + i * (sizePx + 14),
      y: 280 + (i % 2) * 35,
      width: sizePx,
      height: sizePx,
    };
    existingOrder.push(tokenId);
  }

  await updateDoc(sceneRef, {
    tokens: sanitizeForFirestore(existingTokens),
    tokenOrder: existingOrder,
    updatedAt: serverTimestamp(),
  });

  return count;
}

export async function saveBook(roomId: string, book: GrimoireBook): Promise<void> {
  await setDoc(
    roomColDoc(roomId, 'chronicle_books', book.id),
    sanitizeForFirestore({ ...book, updatedAt: Date.now() }),
    { merge: true }
  );
}

export async function deleteBook(roomId: string, bookId: string): Promise<void> {
  await deleteDoc(roomColDoc(roomId, 'chronicle_books', bookId));
}

// ---------------------------------------------------------------------------
// Inicializador de Mundo Demonstrativo Interconectado (1 Clique)
// ---------------------------------------------------------------------------

export async function seedStarterChronicleWorld(
  roomId: string,
  characters: Record<string, CharacterSummary>
): Promise<void> {
  const now = Date.now();
  const charList = Object.values(characters);
  const hero = charList[0] || null;
  const heroMention = hero
    ? createMentionSyntax(hero.name, 'character', hero.id)
    : '**Agente de Campo**';

  const folderLoc: ChronicleFolder = {
    id: 'fld-locais',
    name: 'Distritos & Zonas de Ruptura',
    scope: 'wiki',
    parentId: null,
    order: 1,
    createdAt: now,
  };
  const folderFac: ChronicleFolder = {
    id: 'fld-faccoes',
    name: 'Organizações & Ordens',
    scope: 'wiki',
    parentId: null,
    order: 2,
    createdAt: now,
  };
  const folderDossies: ChronicleFolder = {
    id: 'fld-dossies',
    name: 'Dossiês Interceptados',
    scope: 'journal',
    parentId: null,
    order: 1,
    createdAt: now,
  };

  await Promise.all([
    saveFolder(roomId, folderLoc),
    saveFolder(roomId, folderFac),
    saveFolder(roomId, folderDossies),
  ]);

  const entLargo: ChronicleEntity = {
    id: 'ent-largo-treze',
    title: 'Estação Subterrânea Largo Treze',
    subtitle: 'Zona de quarentena oculta na Zona Sul',
    category: 'location',
    folderId: folderLoc.id,
    tags: ['santo-amaro', 'ruptura', 'subsolo'],
    content: [
      `Ponto focal da primeira anomalia registrada em Bruma de 412. Durante a incursão tática liderada por ${heroMention}, sinais residuais do @[Culto da Vigília Carmim](entity:ent-culto-carmim) foram identificados nos trilhos desativados.`,
      '',
      `Relatórios periciais indicam que o verdadeiro selo sob a plataforma central pertence a [[TARJA:r_selo01|Lorde Valerius, fundador desaparecido da 1ª Divisão]], mantido sob vigilância direta de @[Bispo Silencioso](entity:ent-bispo).`,
      '',
      ':::spoiler[Registros Ambientais da Estação]',
      'A temperatura cai 11 graus abaixo do nível da rua sempre que a lua Carmim entra em fase cheia.',
      ':::',
    ].join('\n'),
    unlockedRedactions: [],
    gmSecretNotes: 'Se o grupo descer ao nível -3 sem lanterna consagrada, ativar emboscada do Espreitador.',
    customFields: [
      { id: 'cf1', label: 'Nível de Risco', value: 'Grau 1 (Crítico)' },
      { id: 'cf2', label: 'Jurisdição', value: '3ª Divisão Metropolitana' },
    ],
    audioClips: [],
    isPublicToPlayers: true,
    eventDate: { eraId: 'era-ruptura', year: 412, monthIndex: 2, day: 12 },
    updatedAt: now,
    createdAt: now,
  };

  const entCulto: ChronicleEntity = {
    id: 'ent-culto-carmim',
    title: 'Culto da Vigília Carmim',
    subtitle: 'Sociedade cismática obcecada pela abertura das Fendas',
    category: 'faction',
    folderId: folderFac.id,
    tags: ['antagonista', 'ocultismo', 'cisma'],
    content: [
      'Facção clandestina que opera em células independentes desde o Grande Cisma do Ano 389.',
      '',
      `Seu emissário mais ativo nos arredores da @[Estação Subterrânea Largo Treze](entity:ent-largo-treze) atende pelo codinome @[Bispo Silencioso](entity:ent-bispo). Fontes internas suspeitam que seu financiamento provém de [[TARJA:r_fin02|contratos desviados do próprio Conselho Superior]].`,
    ].join('\n'),
    unlockedRedactions: [],
    customFields: [
      { id: 'cf3', label: 'Símbolo', value: 'Olho vertical sobre cálice partido' },
      { id: 'cf4', label: 'Efetivo Estimado', value: 'Desconhecido' },
    ],
    audioClips: [],
    isPublicToPlayers: true,
    updatedAt: now,
    createdAt: now,
  };

  const entBispo: ChronicleEntity = {
    id: 'ent-bispo',
    title: 'Bispo Silencioso',
    subtitle: 'Intermediário mascarado do distrito sul',
    category: 'character',
    folderId: folderFac.id,
    tags: ['npc', 'suspeito', 'mascarado'],
    content: [
      `Figura vista negociando relíquias próximas à @[Estação Subterrânea Largo Treze](entity:ent-largo-treze). Demonstrou interesse incomum nos passos de ${heroMention}.`,
      '',
      'Identidade civil real: [[TARJA:r_idbispo|Irmão mais velho dado como morto no incêndio de Pirituba]].',
    ].join('\n'),
    unlockedRedactions: [],
    customFields: [
      { id: 'cf5', label: 'Afiliação Pública', value: 'Mercador Independente' },
      { id: 'cf6', label: 'Condição', value: 'Ativo / Procurado' },
    ],
    audioClips: [],
    isPublicToPlayers: true,
    updatedAt: now,
    createdAt: now,
  };

  await Promise.all([
    saveEntity(roomId, entLargo),
    saveEntity(roomId, entCulto),
    saveEntity(roomId, entBispo),
  ]);

  const sampleDoc: ChronicleDocument = {
    id: 'doc-carta-orfanato',
    title: 'Carta Selada encontrada no Vagão 04',
    code: 'DOSSIÊ #047-B',
    folderId: folderDossies.id,
    paperTheme: 'sepia-parchment',
    possessionMode: hero ? 'single-holder' : 'party-public',
    holderCharacterId: hero?.id ?? null,
    holderUserId: hero?.userId || hero?.ownerId || null,
    holderEmail: hero?.userEmail || hero?.ownerEmail || null,
    holderName: hero?.name ?? null,
    content: [
      `Destinatário encontrado no envelope: ${heroMention}.`,
      '',
      'Se você está lendo estas linhas, o relógio da @[Estação Subterrânea Largo Treze](entity:ent-largo-treze) já parou pela segunda vez.',
      '',
      'Não confie em quem carrega o selo prateado: o traidor que entregou a chave ao @[Culto da Vigília Carmim](entity:ent-culto-carmim) é [[TARJA:r_carta1|o Arquivista-Chefe da Torre Norte]]. Queime este papel antes da Noite das Velas Apagadas.',
    ].join('\n'),
    unlockedRedactions: [],
    audioClips: [],
    updatedAt: now,
    createdAt: now,
  };

  await saveDocument(roomId, sampleDoc);

  // Secret GM Edge in Graph
  await saveEdge(roomId, {
    id: 'edge-secret-1',
    sourceId: entBispo.id,
    sourceType: 'entity',
    targetId: entCulto.id,
    targetType: 'entity',
    label: 'Comandante Secreto da 3ª Célula',
    kind: 'faction',
    isSecretGM: true,
    isPlayerTheory: false,
    createdAt: now,
  });

  // Genealogy Tree
  await saveGenealogyTree(roomId, {
    id: 'tree-linhagem-valerius',
    name: 'Casa Valerius & Cisma da Vigília',
    subtitle: 'Linhagem fundadora e ramificações ocultas',
    kind: 'family',
    isPublicToPlayers: true,
    members: [
      {
        id: 'mem-1',
        name: 'Lorde Valerius',
        role: 'Patriarca Fundador',
        generation: 0,
        order: 0,
        status: 'missing',
        isIdentityHidden: false,
      },
      {
        id: 'mem-2',
        name: 'Helena Valerius',
        role: 'Matriarca',
        generation: 0,
        order: 1,
        status: 'deceased',
        isIdentityHidden: false,
      },
      {
        id: 'mem-3',
        name: hero ? hero.name : 'Herdeiro da Vigília',
        role: 'Descendente Direto',
        generation: 1,
        order: 0,
        characterId: hero?.id ?? null,
        avatarUrl: hero?.avatarUrl ?? null,
        status: 'alive',
        isIdentityHidden: false,
      },
      {
        id: 'mem-4',
        name: 'Bispo Silencioso (Kaelen)',
        role: 'Primogênito Deserdado',
        generation: 1,
        order: 1,
        entityId: entBispo.id,
        status: 'alive',
        isIdentityHidden: true,
        hiddenAlias: '??? (Descendente Oculto)',
      },
    ],
    bonds: [
      { id: 'b-1', fromMemberId: 'mem-1', toMemberId: 'mem-2', type: 'marriage' },
      { id: 'b-2', fromMemberId: 'mem-1', toMemberId: 'mem-3', type: 'parent' },
      { id: 'b-3', fromMemberId: 'mem-1', toMemberId: 'mem-4', type: 'parent', isSecretGM: false },
    ],
    updatedAt: now,
  });

  // Calendar & Chronos Events
  await saveCalendarConfig(roomId, DEFAULT_CALENDAR);

  await Promise.all([
    saveChronosEvent(roomId, {
      id: 'ev-1',
      title: 'O Grande Cisma da Vigília',
      summary: 'Ruptura interna que deu origem às células do Culto Carmim.',
      eraId: 'era-ruptura',
      year: 389,
      monthIndex: 0,
      day: 19,
      category: 'war',
      linkedEntityId: entCulto.id,
      isPublicToPlayers: true,
      createdAt: now,
    }),
    saveChronosEvent(roomId, {
      id: 'ev-2',
      title: 'Incursão na Estação Largo Treze',
      summary: 'Descoberta do vagão lacrado e recuperação da Carta #047-B.',
      eraId: 'era-ruptura',
      year: 412,
      monthIndex: 2,
      day: 12,
      category: 'session',
      linkedEntityId: entLargo.id,
      isPublicToPlayers: true,
      createdAt: now,
    }),
  ]);

  // Bestiary Creature
  await saveCreature(roomId, {
    id: 'cr-espreitador',
    name: 'Espreitador da Fenda',
    title: 'Anomalia Predadora dos Trilhos',
    threatGrade: 'Grau 1',
    creatureType: 'Maldição / Aberração',
    hpMax: 185,
    energyMax: 60,
    defense: 23,
    initiative: 12,
    speed: '12m (Escalada 9m)',
    sizeCells: 2,
    attacks: [
      {
        id: 'atk-1',
        name: 'Garras de Ferro Torcido',
        bonus: '+14',
        damage: '2d10 + 9 cortante',
        notes: 'Crítico 19-20',
      },
      {
        id: 'atk-2',
        name: 'Sussurro Paralítico',
        bonus: 'DT 21 Vontade',
        damage: '2d8 mental + Abalado',
        notes: 'Alcance 9m em cone',
      },
    ],
    traits: 'Resistência Balística 10 · Visão no Escuro Total',
    lore: 'Criatura formada pelo acúmulo de pavor nos túneis interditados. Ponto fraco real: [[TARJA:r_fraq1|sofre dano dobrado quando exposto ao som de sinos de bronze consagrado]].',
    unlockedRedactions: [],
    isKnownByPlayers: true,
    showStatsToPlayers: false,
    updatedAt: now,
  });

  // Grimoire Book
  await saveBook(roomId, {
    id: 'book-codex-ruptura',
    title: 'Tratado das Fendas & Exposição Oculta',
    subtitle: 'Manual de Campo para Operadores e Investigadores',
    author: 'Arquivo Central Omniscient',
    accentColor: '#d4a359',
    isPublicToPlayers: true,
    chapters: [
      {
        id: 'ch-1',
        title: 'I. Leis da Canalização e Ruptura',
        order: 1,
        content: [
          'Toda manifestação anômala deixa vestígios físicos mensuráveis no perímetro urbano. Operadores em campo devem registrar variações térmicas antes de romper qualquer selo.',
          '',
          `Casos recentes documentados na @[Estação Subterrânea Largo Treze](entity:ent-largo-treze) comprovam que objetos selados mantêm memória residual de seus portadores.`,
          '',
          '| Grau de Ameaça | Protocolo Recomendado | Equipe Mínima |',
          '| --- | --- | --- |',
          '| Grau 3 | Contenção silenciosa | 2 Operadores |',
          '| Grau 2 | Isolamento de quarteirão | 4 Operadores |',
          '| Grau 1 | Intervenção imediata | Esquadrão Completo |',
        ].join('\n'),
        unlockedRedactions: [],
      },
      {
        id: 'ch-2',
        title: 'II. Protocolos de Censura e Sigilo',
        order: 2,
        content: [
          'Documentos classificados recebem tarjas de contenção cognitiva. Apenas o Mestre da Operação pode suspender o sigilo à medida que provas concretas são obtidas em sessão.',
          '',
          'Cláusula Zero: [[TARJA:r_clausula0|Caso uma Fenda atinja estágio irreversível, a estação inteira deve ser selada por colapso estrutural]].',
        ].join('\n'),
        unlockedRedactions: [],
      },
    ],
    glossary: [
      {
        id: 'gl-1',
        term: 'Zona de Ruptura',
        category: 'Fenômeno',
        definition: 'Área física onde a fronteira dimensional sofreu desgaste severo, alterando clima, gravidade ou acústica.',
      },
      {
        id: 'gl-2',
        term: 'Grau de Ameaça',
        category: 'Classificação',
        definition: 'Escala tática de risco que vai do Grau 4 (menor risco) até o Grau Especial (risco catastrófico).',
      },
      {
        id: 'gl-3',
        term: 'Posse Exclusiva',
        category: 'Regra de Mesa',
        definition: 'Indica que uma pista ou carta física está nas mãos de um único personagem até que ele decida revelá-la ao grupo.',
      },
    ],
    updatedAt: now,
  });
}
