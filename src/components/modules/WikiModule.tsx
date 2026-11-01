'use client';

import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  Calendar,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  FileLock2,
  FileText,
  Folder,
  FolderPlus,
  ImagePlus,
  Link2,
  Lock,
  MapPin,
  Plus,
  Save,
  Search,
  Send,
  Shield,
  Sparkles,
  Tag,
  Trash2,
  Unlock,
  User,
  X,
} from 'lucide-react';
import { useChronicleStore, useEffectiveGM } from '@/store/useChronicleStore';
import {
  deleteEntity,
  deleteFolder,
  moveVTTPlayersToScene,
  saveEntity,
  saveFolder,
  seedStarterChronicleWorld,
  toggleEntityRedaction,
} from '@/lib/chronicle-actions';
import { extractMentions, extractRedactions } from '@/lib/markdown-engine';
import { uploadChronicleAsset } from '@/lib/storage';
import { RichChronicleRenderer } from '@/components/shared/RichChronicleRenderer';
import { RichChronicleEditor } from '@/components/shared/RichChronicleEditor';
import type {
  AudioClipBlock,
  ChronicleEntity,
  CustomField,
  EntityCategory,
  EventDateStamp,
} from '@/types/chronicle';

const CATEGORY_LABELS: Record<EntityCategory, string> = {
  character: 'Personagem / NPC',
  location: 'Local / Distrito',
  faction: 'Facção / Ordem',
  item: 'Item / Relíquia',
  case: 'Caso / Investigação',
  event: 'Evento Histórico',
  custom: 'Registro Custom',
};

export function WikiModule() {
  const isGM = useEffectiveGM();
  const roomId = useChronicleStore((s) => s.roomId);
  const folders = useChronicleStore((s) => s.folders);
  const entities = useChronicleStore((s) => s.entities);
  const documents = useChronicleStore((s) => s.documents);
  const maps = useChronicleStore((s) => s.maps);
  const trees = useChronicleStore((s) => s.trees);
  const events = useChronicleStore((s) => s.events);
  const characters = useChronicleStore((s) => s.characters);
  const vttScenes = useChronicleStore((s) => s.vttScenes);
  const calendar = useChronicleStore((s) => s.calendar);

  const selectedEntityId = useChronicleStore((s) => s.selectedEntityId);
  const setSelectedEntityId = useChronicleStore((s) => s.setSelectedEntityId);
  const setActiveTab = useChronicleStore((s) => s.setActiveTab);
  const setSelectedDocumentId = useChronicleStore((s) => s.setSelectedDocumentId);
  const setSelectedMapId = useChronicleStore((s) => s.setSelectedMapId);
  const setSelectedTreeId = useChronicleStore((s) => s.setSelectedTreeId);
  const openFloatingSheet = useChronicleStore((s) => s.openFloatingSheet);
  const showToast = useChronicleStore((s) => s.showToast);

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<EntityCategory | 'all'>('all');
  const [selectedFolderFilter, setSelectedFolderFilter] = useState<string | 'all'>('all');
  const [newFolderName, setNewFolderName] = useState('');
  const [showFolderInput, setShowFolderInput] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);

  // Editor state
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<ChronicleEntity | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);

  const wikiFolders = useMemo(
    () =>
      Object.values(folders)
        .filter((f) => f.scope === 'wiki')
        .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)),
    [folders]
  );

  const visibleEntities = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return Object.values(entities)
      .filter((e) => {
        if (!isGM && !e.isPublicToPlayers) return false;
        if (categoryFilter !== 'all' && e.category !== categoryFilter) return false;
        if (selectedFolderFilter !== 'all') {
          if (selectedFolderFilter === 'unfiled' && e.folderId !== null) return false;
          if (selectedFolderFilter !== 'unfiled' && e.folderId !== selectedFolderFilter)
            return false;
        }
        if (!q) return true;
        return (
          e.title.toLowerCase().includes(q) ||
          (e.subtitle || '').toLowerCase().includes(q) ||
          e.tags.some((t) => t.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [entities, isGM, categoryFilter, selectedFolderFilter, searchQuery]);

  const activeEntity = useMemo(() => {
    if (selectedEntityId && entities[selectedEntityId]) {
      const candidate = entities[selectedEntityId];
      if (isGM || candidate.isPublicToPlayers) return candidate;
    }
    return visibleEntities[0] || null;
  }, [selectedEntityId, entities, isGM, visibleEntities]);

  const startEditing = (target: ChronicleEntity) => {
    setDraft({
      ...target,
      tags: [...(target.tags || [])],
      customFields: (target.customFields || []).map((cf) => ({ ...cf })),
      audioClips: (target.audioClips || []).map((ac) => ({ ...ac })),
      unlockedRedactions: [...(target.unlockedRedactions || [])],
    });
    setIsEditing(true);
  };

  const handleCreateEntity = async () => {
    const now = Date.now();
    const newEnt: ChronicleEntity = {
      id: `ent_${crypto.randomUUID().slice(0, 8)}`,
      title: 'Novo Registro do Atlas',
      subtitle: 'Resumo curto da entidade, local ou facção',
      category: categoryFilter === 'all' ? 'location' : categoryFilter,
      folderId:
        selectedFolderFilter !== 'all' && selectedFolderFilter !== 'unfiled'
          ? selectedFolderFilter
          : null,
      tags: [],
      imageUrl: null,
      bannerUrl: null,
      linkedCharacterId: null,
      linkedSceneId: null,
      content: 'Descreva a história, conexões com @Menções e segredos com Tarjas Pretas...',
      unlockedRedactions: [],
      gmSecretNotes: '',
      customFields: [{ id: `cf_${now}`, label: 'Status Atual', value: 'Ativo' }],
      audioClips: [],
      isPublicToPlayers: false,
      eventDate: null,
      updatedAt: now,
      createdAt: now,
    };
    await saveEntity(roomId, newEnt);
    setSelectedEntityId(newEnt.id);
    startEditing(newEnt);
    showToast('Nova página criada no Cofre do Mestre.');
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    const fld = {
      id: `fld_${crypto.randomUUID().slice(0, 8)}`,
      name: newFolderName.trim(),
      scope: 'wiki' as const,
      parentId: null,
      order: wikiFolders.length + 1,
      createdAt: Date.now(),
    };
    await saveFolder(roomId, fld);
    setNewFolderName('');
    setShowFolderInput(false);
    setSelectedFolderFilter(fld.id);
  };

  const handleSaveDraft = async () => {
    if (!draft) return;
    await saveEntity(roomId, {
      ...draft,
      title: draft.title.trim() || 'Sem Título',
    });
    setIsEditing(false);
    setDraft(null);
    showToast('Página do Atlas salva e sincronizada.');
  };

  const handleDeleteActive = async () => {
    if (!activeEntity) return;
    if (!window.confirm(`Excluir permanentemente "${activeEntity.title}" do Atlas?`)) return;
    await deleteEntity(roomId, activeEntity.id);
    setIsEditing(false);
    setDraft(null);
    setSelectedEntityId(null);
    showToast('Página removida do Atlas.');
  };

  const handleUploadMedia = async (file: File, kind: 'portrait' | 'banner') => {
    if (!draft) return;
    if (kind === 'portrait') setIsUploadingImage(true);
    else setIsUploadingBanner(true);

    const url = await uploadChronicleAsset(roomId, 'entities', file);
    if (kind === 'portrait') setIsUploadingImage(false);
    else setIsUploadingBanner(false);

    if (!url) {
      showToast('Falha no upload para o Supabase Storage (vtt-assets).');
      return;
    }
    setDraft((prev) =>
      prev
        ? kind === 'portrait'
          ? { ...prev, imageUrl: url }
          : { ...prev, bannerUrl: url }
        : null
    );
    showToast('Imagem enviada para o Supabase vtt-assets.');
  };

  const handleSeedWorld = async () => {
    setIsSeeding(true);
    try {
      await seedStarterChronicleWorld(roomId, characters);
      showToast('Mundo demonstrativo criado e conectado às fichas!');
    } catch (err) {
      console.error(err);
      showToast('Erro ao popular mundo demonstrativo.');
    } finally {
      setIsSeeding(false);
    }
  };

  // Automatic Backlinks across the entire Omniscient Chronicle
  const backlinks = useMemo(() => {
    if (!activeEntity) return [];
    const targetId = activeEntity.id;
    const refs: Array<{
      id: string;
      label: string;
      sourceKind: string;
      onOpen: () => void;
    }> = [];

    Object.values(entities).forEach((e) => {
      if (e.id === targetId) return;
      if (!isGM && !e.isPublicToPlayers) return;
      const mentions = extractMentions(e.content);
      if (mentions.some((m) => m.targetType === 'entity' && m.targetId === targetId)) {
        refs.push({
          id: `ent-${e.id}`,
          label: e.title,
          sourceKind: 'Página da Wiki',
          onOpen: () => {
            setIsEditing(false);
            setSelectedEntityId(e.id);
          },
        });
      }
    });

    Object.values(documents).forEach((d) => {
      if (!isGM && d.possessionMode !== 'party-public') return;
      const mentions = extractMentions(d.content);
      if (mentions.some((m) => m.targetType === 'entity' && m.targetId === targetId)) {
        refs.push({
          id: `doc-${d.id}`,
          label: d.title,
          sourceKind: 'Carta / Dossiê',
          onOpen: () => {
            setActiveTab('journal');
            setSelectedDocumentId(d.id);
          },
        });
      }
    });

    Object.values(maps).forEach((m) => {
      if (!isGM && !m.isPublicToPlayers) return;
      const matchingPin = m.pins.find(
        (p) => p.entityId === targetId && (isGM || p.isPublicToPlayers)
      );
      if (matchingPin) {
        refs.push({
          id: `map-${m.id}-${matchingPin.id}`,
          label: `${m.name} (${matchingPin.label})`,
          sourceKind: 'Pino Cartográfico',
          onOpen: () => {
            setActiveTab('maps');
            setSelectedMapId(m.id);
          },
        });
      }
    });

    Object.values(trees).forEach((t) => {
      if (!isGM && !t.isPublicToPlayers) return;
      const mem = t.members.find(
        (mb) => mb.entityId === targetId && (isGM || !mb.isIdentityHidden)
      );
      if (mem) {
        refs.push({
          id: `tree-${t.id}-${mem.id}`,
          label: `${t.name} (${mem.name})`,
          sourceKind: 'Árvore de Linhagem',
          onOpen: () => {
            setActiveTab('genealogy');
            setSelectedTreeId(t.id);
          },
        });
      }
    });

    Object.values(events).forEach((ev) => {
      if (!isGM && !ev.isPublicToPlayers) return;
      if (ev.linkedEntityId === targetId) {
        refs.push({
          id: `ev-${ev.id}`,
          label: `Ano ${ev.year}: ${ev.title}`,
          sourceKind: 'Linha do Tempo Cronos',
          onOpen: () => setActiveTab('chronos'),
        });
      }
    });

    return refs;
  }, [
    activeEntity,
    entities,
    documents,
    maps,
    trees,
    events,
    isGM,
    setSelectedEntityId,
    setActiveTab,
    setSelectedDocumentId,
    setSelectedMapId,
    setSelectedTreeId,
  ]);

  const activeRedactions = useMemo(
    () => (activeEntity ? extractRedactions(activeEntity.content) : []),
    [activeEntity]
  );

  const linkedChar =
    activeEntity?.linkedCharacterId ? characters[activeEntity.linkedCharacterId] : null;
  const linkedScene =
    activeEntity?.linkedSceneId
      ? vttScenes.find((s) => s.id === activeEntity.linkedSceneId) || null
      : null;

  return (
    <div className="flex flex-col lg:flex-row h-full min-h-0 bg-zinc-950">
      {/* Left Navigation Column */}
      <aside className="w-full lg:w-80 shrink-0 border-b lg:border-b-0 lg:border-r border-zinc-800 bg-zinc-950 flex flex-col max-h-[38vh] lg:max-h-none">
        <div className="p-3.5 border-b border-zinc-800 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-zinc-100">Atlas & Wiki Modular</h2>
              <p className="text-xs text-zinc-400">
                {visibleEntities.length} registro(s) acessível(is)
              </p>
            </div>
            {isGM && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowFolderInput((p) => !p)}
                  className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
                  title="Nova Pasta"
                >
                  <FolderPlus className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleCreateEntity}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-[#0b0d10] font-semibold text-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Página</span>
                </button>
              </div>
            )}
          </div>

          {showFolderInput && isGM && (
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                placeholder="Nome da pasta..."
                className="flex-1 px-2.5 py-1.5 text-xs rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 focus:outline-none focus:border-cyan-500"
              />
              <button
                type="button"
                onClick={handleCreateFolder}
                className="px-2.5 py-1.5 rounded-lg bg-cyan-600 text-[#0b0d10] text-xs font-semibold cursor-pointer"
              >
                Criar
              </button>
            </div>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filtrar título ou #tag..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Category filter pills */}
          <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar pb-1">
            <button
              type="button"
              onClick={() => setCategoryFilter('all')}
              className={`px-2 py-1 rounded-md text-xs font-medium shrink-0 transition-colors cursor-pointer ${
                categoryFilter === 'all'
                  ? 'bg-zinc-800 text-zinc-100 border border-zinc-700'
                  : 'text-zinc-400 hover:text-zinc-100'
              }`}
            >
              Todas
            </button>
            {(Object.keys(CATEGORY_LABELS) as EntityCategory[]).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`px-2 py-1 rounded-md text-xs font-medium shrink-0 transition-colors cursor-pointer ${
                  categoryFilter === cat
                    ? 'bg-zinc-800 text-cyan-400 border border-zinc-700'
                    : 'text-zinc-400 hover:text-zinc-100'
                }`}
              >
                {CATEGORY_LABELS[cat].split(' ')[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Folder Strip */}
        {wikiFolders.length > 0 && (
          <div className="px-3 py-2 border-b border-zinc-800 flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
            <button
              type="button"
              onClick={() => setSelectedFolderFilter('all')}
              className={`px-2 py-0.5 rounded text-xs font-mono shrink-0 cursor-pointer ${
                selectedFolderFilter === 'all'
                  ? 'bg-cyan-600/15 text-cyan-300 border border-cyan-500/35'
                  : 'text-zinc-400 hover:text-zinc-100'
              }`}
            >
              Tudo
            </button>
            {wikiFolders.map((fld) => (
              <div key={fld.id} className="flex items-center shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedFolderFilter(fld.id)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs cursor-pointer ${
                    selectedFolderFilter === fld.id
                      ? 'bg-zinc-800 text-zinc-100 border border-zinc-700'
                      : 'text-zinc-400 hover:text-zinc-100'
                  }`}
                >
                  <Folder className="w-3 h-3 text-cyan-400" />
                  <span>{fld.name}</span>
                </button>
                {isGM && selectedFolderFilter === fld.id && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (window.confirm(`Remover pasta "${fld.name}"?`)) {
                        await deleteFolder(roomId, fld.id);
                        setSelectedFolderFilter('all');
                      }
                    }}
                    className="ml-0.5 p-0.5 text-zinc-500 hover:text-red-400 cursor-pointer"
                    title="Excluir pasta"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Entities List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
          {visibleEntities.length === 0 ? (
            <div className="p-4 text-center space-y-3">
              <p className="text-xs text-zinc-500">
                Nenhuma página encontrada neste filtro do Atlas.
              </p>
            </div>
          ) : (
            visibleEntities.map((ent) => {
              const isSelected = activeEntity?.id === ent.id;
              const redactionCount = extractRedactions(ent.content).length;
              return (
                <button
                  key={ent.id}
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setDraft(null);
                    setSelectedEntityId(ent.id);
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-zinc-800 border-zinc-700 text-zinc-100'
                      : 'bg-transparent border-transparent hover:bg-zinc-900 text-zinc-400 hover:text-zinc-100'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold truncate">{ent.title}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {!ent.isPublicToPlayers && (
                        <span
                          className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-zinc-400"
                          title="Oculto no Cofre do Mestre"
                        >
                          GM
                        </span>
                      )}
                      {isGM && redactionCount > 0 && (
                        <span
                          className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#c94a4a]/15 text-red-300"
                          title="Contém Tarjas Pretas"
                        >
                          {redactionCount}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <span className="text-[11px] text-zinc-500 truncate">
                      {ent.customCategoryLabel || CATEGORY_LABELS[ent.category]}
                    </span>
                    {ent.linkedCharacterId && (
                      <span className="text-[10px] font-mono text-cyan-400">Ficha Live</span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto custom-scrollbar p-5 lg:p-8">
        {!activeEntity && !isEditing ? (
          <div className="max-w-lg mx-auto my-16 p-6 rounded-xl bg-zinc-900 border border-zinc-800 text-center space-y-4">
            <BookOpen className="w-8 h-8 text-cyan-400 mx-auto" />
            <div>
              <h3 className="text-base font-bold text-zinc-100">
                Arquivo Central Omniscient Chronicle
              </h3>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                {isGM
                  ? 'Crie sua primeira página de lore ou gere um mundo demonstrativo interligado com suas fichas atuais do Omniscient Sheet, cartas com posse exclusiva, grafo, linhagem, calendário e bestiário.'
                  : 'Aguardando o Mestre liberar os primeiros registros públicos da campanha.'}
              </p>
            </div>
            {isGM && (
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={handleCreateEntity}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-[#0b0d10] font-semibold text-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Criar Primeira Página</span>
                </button>
                <button
                  type="button"
                  disabled={isSeeding}
                  onClick={handleSeedWorld}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 hover:border-cyan-500 text-zinc-100 font-semibold text-xs transition-colors cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <span>
                    {isSeeding ? 'Criando Ecossistema...' : 'Popular Mundo Demonstrativo'}
                  </span>
                </button>
              </div>
            )}
          </div>
        ) : isEditing && draft ? (
          /* ---------------- EDIT MODE ---------------- */
          <div className="max-w-4xl mx-auto space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-zinc-800">
              <div>
                <span className="text-xs font-mono uppercase text-cyan-400">
                  Modo de Edição do Atlas
                </span>
                <h2 className="text-lg font-bold text-zinc-100">{draft.title || 'Sem Título'}</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setDraft(null);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-400 hover:text-zinc-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-[#0b0d10] font-semibold text-xs transition-colors cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Salvar Registro</span>
                </button>
              </div>
            </div>

            {/* Primary Meta Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Título</label>
                <input
                  type="text"
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Subtítulo / Resumo
                </label>
                <input
                  type="text"
                  value={draft.subtitle || ''}
                  onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Categoria</label>
                <select
                  value={draft.category}
                  onChange={(e) =>
                    setDraft({ ...draft, category: e.target.value as EntityCategory })
                  }
                  className="w-full px-3 py-2 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
                >
                  {(Object.keys(CATEGORY_LABELS) as EntityCategory[]).map((cat) => (
                    <option key={cat} value={cat}>
                      {CATEGORY_LABELS[cat]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Pasta</label>
                <select
                  value={draft.folderId || ''}
                  onChange={(e) =>
                    setDraft({ ...draft, folderId: e.target.value ? e.target.value : null })
                  }
                  className="w-full px-3 py-2 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
                >
                  <option value="">Sem Pasta (Raiz)</option>
                  {wikiFolders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Ecosystem Links: Omniscient Sheet & StarStream VTT */}
              <div>
                <label className="block text-xs font-medium text-cyan-400 mb-1">
                  Vincular Ficha Oficial (Omniscient Sheet)
                </label>
                <select
                  value={draft.linkedCharacterId || ''}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      linkedCharacterId: e.target.value ? e.target.value : null,
                    })
                  }
                  className="w-full px-3 py-2 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
                >
                  <option value="">Nenhuma ficha vinculada</option>
                  {Object.values(characters).map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      {ch.name} ({ch.className || 'Operador'} Nv.{ch.level})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-cyan-400 mb-1">
                  Vincular Cena do Mapa (StarStream VTT)
                </label>
                <select
                  value={draft.linkedSceneId || ''}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      linkedSceneId: e.target.value ? e.target.value : null,
                    })
                  }
                  className="w-full px-3 py-2 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
                >
                  <option value="">Nenhuma cena VTT vinculada</option>
                  {vttScenes.map((sc) => (
                    <option key={sc.id} value={sc.id}>
                      {sc.name} ({sc.tokenCount} tokens)
                    </option>
                  ))}
                </select>
              </div>

              {/* Images Upload (Supabase vtt-assets) */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Retrato / Brasão (Supabase Storage ou URL)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={draft.imageUrl || ''}
                    onChange={(e) =>
                      setDraft({ ...draft, imageUrl: e.target.value || null })
                    }
                    placeholder="https://..."
                    className="flex-1 px-2.5 py-1.5 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
                  />
                  <label className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-zinc-100 cursor-pointer shrink-0">
                    <ImagePlus className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{isUploadingImage ? '...' : 'Upload'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleUploadMedia(f, 'portrait');
                      }}
                    />
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Banner Panorâmico (Supabase Storage ou URL)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={draft.bannerUrl || ''}
                    onChange={(e) =>
                      setDraft({ ...draft, bannerUrl: e.target.value || null })
                    }
                    placeholder="https://..."
                    className="flex-1 px-2.5 py-1.5 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
                  />
                  <label className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-zinc-100 cursor-pointer shrink-0">
                    <ImagePlus className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{isUploadingBanner ? '...' : 'Upload'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleUploadMedia(f, 'banner');
                      }}
                    />
                  </label>
                </div>
              </div>

              {/* Visibility & Chronos Date Stamp */}
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-950 border border-zinc-800">
                <div>
                  <div className="text-xs font-semibold text-zinc-100">
                    Visibilidade para Jogadores
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    {draft.isPublicToPlayers
                      ? 'Visível no Atlas (Tarjas continuam protegidas)'
                      : 'Trancado no Cofre do Mestre'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setDraft({ ...draft, isPublicToPlayers: !draft.isPublicToPlayers })
                  }
                  className={`px-3 py-1 rounded-md text-xs font-semibold cursor-pointer ${
                    draft.isPublicToPlayers
                      ? 'bg-cyan-600 text-[#0b0d10]'
                      : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                  }`}
                >
                  {draft.isPublicToPlayers ? 'Pública' : 'Oculta (GM)'}
                </button>
              </div>

              <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-zinc-100">
                    Data na Linha do Tempo (Cronos)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const nextDate: EventDateStamp | null = draft.eventDate
                        ? null
                        : {
                            eraId: calendar.currentEraId,
                            year: calendar.currentYear,
                            monthIndex: calendar.currentMonthIndex,
                            day: calendar.currentDay,
                          };
                      setDraft({ ...draft, eventDate: nextDate });
                    }}
                    className="text-xs font-mono text-cyan-400 hover:underline cursor-pointer"
                  >
                    {draft.eventDate ? 'Remover Data' : '+ Vincular ao Cronos'}
                  </button>
                </div>
                {draft.eventDate && (
                  <div className="grid grid-cols-3 gap-1.5">
                    <input
                      type="number"
                      value={draft.eventDate.year}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          eventDate: {
                            ...draft.eventDate!,
                            year: Number(e.target.value) || 1,
                          },
                        })
                      }
                      placeholder="Ano"
                      className="px-2 py-1 text-xs rounded bg-zinc-900 border border-zinc-800 font-mono"
                    />
                    <select
                      value={draft.eventDate.monthIndex}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          eventDate: {
                            ...draft.eventDate!,
                            monthIndex: Number(e.target.value),
                          },
                        })
                      }
                      className="px-2 py-1 text-xs rounded bg-zinc-900 border border-zinc-800"
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
                      value={draft.eventDate.day}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          eventDate: {
                            ...draft.eventDate!,
                            day: Math.max(1, Number(e.target.value) || 1),
                          },
                        })
                      }
                      placeholder="Dia"
                      className="px-2 py-1 text-xs rounded bg-zinc-900 border border-zinc-800 font-mono"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Tags & Custom Metadata Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2.5">
                <label className="block text-xs font-semibold text-zinc-100">
                  Tags de Indexação
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && tagInput.trim()) {
                        e.preventDefault();
                        const clean = tagInput.trim().replace(/^#/, '');
                        if (!draft.tags.includes(clean)) {
                          setDraft({ ...draft, tags: [...draft.tags, clean] });
                        }
                        setTagInput('');
                      }
                    }}
                    placeholder="Digite uma tag e tecle Enter..."
                    className="flex-1 px-2.5 py-1.5 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {draft.tags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-xs font-mono text-zinc-400"
                    >
                      #{t}
                      <button
                        type="button"
                        onClick={() =>
                          setDraft({ ...draft, tags: draft.tags.filter((x) => x !== t) })
                        }
                        className="hover:text-red-400 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-100">
                    Campos Técnicos Customizados
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const nextField: CustomField = {
                        id: `cf_${Math.random().toString(36).slice(2, 7)}`,
                        label: 'Atributo',
                        value: 'Valor',
                      };
                      setDraft({
                        ...draft,
                        customFields: [...draft.customFields, nextField],
                      });
                    }}
                    className="text-xs text-cyan-400 hover:underline cursor-pointer"
                  >
                    + Campo
                  </button>
                </div>
                <div className="space-y-1.5 max-h-36 overflow-y-auto custom-scrollbar">
                  {draft.customFields.map((cf, idx) => (
                    <div key={cf.id} className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={cf.label}
                        onChange={(e) => {
                          const copy = [...draft.customFields];
                          copy[idx] = { ...cf, label: e.target.value };
                          setDraft({ ...draft, customFields: copy });
                        }}
                        placeholder="Rótulo"
                        className="w-1/3 px-2 py-1 text-xs rounded bg-zinc-950 border border-zinc-800 text-zinc-400"
                      />
                      <input
                        type="text"
                        value={cf.value}
                        onChange={(e) => {
                          const copy = [...draft.customFields];
                          copy[idx] = { ...cf, value: e.target.value };
                          setDraft({ ...draft, customFields: copy });
                        }}
                        placeholder="Valor"
                        className="flex-1 px-2 py-1 text-xs rounded bg-zinc-950 border border-zinc-800 text-zinc-100"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setDraft({
                            ...draft,
                            customFields: draft.customFields.filter((x) => x.id !== cf.id),
                          })
                        }
                        className="text-zinc-500 hover:text-red-400 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Rich Chronicle Editor */}
            <div>
              <label className="block text-xs font-semibold text-zinc-100 mb-1.5">
                Corpo do Documento (Suporta @Menções, Tarjas Pretas, Spoilers, Tabelas e Fitas YouTube)
              </label>
              <RichChronicleEditor
                value={draft.content}
                onChange={(content) => setDraft({ ...draft, content })}
                unlockedRedactions={draft.unlockedRedactions}
                audioClips={draft.audioClips}
                onChangeAudioClips={(clips: AudioClipBlock[]) =>
                  setDraft({ ...draft, audioClips: clips })
                }
              />
            </div>

            {/* GM Secret Notes */}
            <div className="bg-zinc-900 border border-[#c94a4a]/35 rounded-xl p-4">
              <label className="block text-xs font-mono uppercase text-red-400 mb-1.5">
                Notas Privadas do Mestre (Jamais visíveis para jogadores)
              </label>
              <textarea
                rows={3}
                value={draft.gmSecretNotes || ''}
                onChange={(e) => setDraft({ ...draft, gmSecretNotes: e.target.value })}
                placeholder="Gatilhos de sessão, testes ocultos, verdadeiros culpados..."
                className="w-full p-2.5 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-[#c94a4a]"
              />
            </div>
          </div>
        ) : (
          /* ---------------- VIEW MODE ---------------- */
          activeEntity && (
            <article className="max-w-4xl mx-auto space-y-6">
              {/* Optional Panoramic Banner */}
              {activeEntity.bannerUrl && (
                <div className="w-full h-48 rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={activeEntity.bannerUrl}
                    alt={activeEntity.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* Header */}
              <header className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-zinc-800">
                <div className="flex items-start gap-4">
                  {activeEntity.imageUrl && (
                    <div className="w-16 h-16 rounded-xl overflow-hidden border border-zinc-700 bg-zinc-900 shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={activeEntity.imageUrl}
                        alt={activeEntity.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-xs font-mono uppercase text-cyan-400">
                        {activeEntity.customCategoryLabel || CATEGORY_LABELS[activeEntity.category]}
                      </span>
                      {!activeEntity.isPublicToPlayers ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-400">
                          <EyeOff className="w-3 h-3" />
                          <span>Oculto (Cofre GM)</span>
                        </span>
                      ) : (
                        isGM && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-cyan-600/15 text-cyan-300">
                            <Eye className="w-3 h-3" />
                            <span>Público na Mesa</span>
                          </span>
                        )
                      )}
                      {activeEntity.eventDate && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
                          <Calendar className="w-3 h-3 text-cyan-400" />
                          <span>
                            Dia {activeEntity.eventDate.day}, Ano {activeEntity.eventDate.year}
                          </span>
                        </span>
                      )}
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-bold font-sans text-zinc-100 text-balance">
                      {activeEntity.title}
                    </h1>
                    {activeEntity.subtitle && (
                      <p className="text-sm text-zinc-400 mt-1 text-pretty">
                        {activeEntity.subtitle}
                      </p>
                    )}
                    {activeEntity.tags.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                        {activeEntity.tags.map((t) => (
                          <span
                            key={t}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[11px] font-mono text-zinc-400"
                          >
                            <Tag className="w-2.5 h-2.5 text-cyan-400" />
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {isGM && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        saveEntity(roomId, {
                          ...activeEntity,
                          isPublicToPlayers: !activeEntity.isPublicToPlayers,
                        })
                      }
                      className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs text-zinc-100 transition-colors cursor-pointer"
                    >
                      {activeEntity.isPublicToPlayers ? 'Ocultar dos Jogadores' : 'Tornar Pública'}
                    </button>
                    <button
                      type="button"
                      onClick={() => startEditing(activeEntity)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-[#0b0d10] font-semibold text-xs transition-colors cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Editar</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteActive}
                      className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-[#c94a4a] text-zinc-400 hover:text-red-400 transition-colors cursor-pointer"
                      title="Excluir Página"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </header>

              {/* Ecosystem Bridges: Omniscient Sheet Live Card & StarStream VTT Scene Card */}
              {(linkedChar || linkedScene) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {linkedChar && (
                    <div className="p-3.5 rounded-xl bg-zinc-900 border border-cyan-500/40 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-lg bg-zinc-950 border border-zinc-700 overflow-hidden shrink-0 flex items-center justify-center">
                          {linkedChar.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={linkedChar.avatarUrl}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <User className="w-5 h-5 text-cyan-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[11px] font-mono uppercase text-cyan-400">
                            Ficha Sincronizada · Omniscient Sheet
                          </div>
                          <div className="text-sm font-bold text-zinc-100 truncate">
                            {linkedChar.name}
                          </div>
                          <div className="text-xs font-mono text-zinc-400 flex items-center gap-2">
                            <span>
                              HP {linkedChar.hp.current}/{linkedChar.hp.max}
                            </span>
                            <span>·</span>
                            <span>
                              PE {linkedChar.energy.current}/{linkedChar.energy.max}
                            </span>
                            <span>·</span>
                            <span className="inline-flex items-center gap-0.5">
                              <Shield className="w-3 h-3 text-cyan-400" />
                              {linkedChar.defense ?? 10}
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => openFloatingSheet(linkedChar.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 text-[#0b0d10] font-semibold text-xs hover:opacity-90 transition-opacity cursor-pointer shrink-0"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Abrir Ficha</span>
                      </button>
                    </div>
                  )}

                  {linkedScene && (
                    <div className="p-3.5 rounded-xl bg-zinc-900 border border-cyan-500/40 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-lg bg-zinc-950 border border-zinc-700 flex items-center justify-center shrink-0">
                          <MapPin className="w-5 h-5 text-cyan-400" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[11px] font-mono uppercase text-cyan-400">
                            Cena Tática · StarStream VTT
                          </div>
                          <div className="text-sm font-bold text-zinc-100 truncate">
                            {linkedScene.name}
                          </div>
                          <div className="text-xs text-zinc-400">
                            {linkedScene.tokenCount} token(s) posicionado(s)
                          </div>
                        </div>
                      </div>
                      {isGM && (
                        <button
                          type="button"
                          onClick={async () => {
                            const ok = await moveVTTPlayersToScene(roomId, linkedScene.id);
                            showToast(
                              ok
                                ? `Jogadores movidos para "${linkedScene.name}" no StarStream VTT!`
                                : 'Falha ao atualizar cena ativa da sala VTT.'
                            );
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-[#0b0d10] font-semibold text-xs transition-colors cursor-pointer shrink-0"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Mover Mesa VTT</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Custom Metadata Grid */}
              {activeEntity.customFields.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {activeEntity.customFields.map((cf) => (
                    <div
                      key={cf.id}
                      className="px-3.5 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800"
                    >
                      <div className="text-[11px] font-mono uppercase text-zinc-500">
                        {cf.label}
                      </div>
                      <div className="text-xs font-semibold text-zinc-100 mt-0.5">{cf.value}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* GM Redaction Control Bar */}
              {isGM && activeRedactions.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 border border-[#c94a4a]/40">
                  <div className="flex items-center gap-2 text-xs">
                    <FileLock2 className="w-4 h-4 text-red-400" />
                    <span className="text-zinc-100 font-medium">
                      Controle de Tarjas Pretas ao Vivo:
                    </span>
                    <span className="font-mono text-zinc-400">
                      {
                        activeRedactions.filter((r) =>
                          (activeEntity.unlockedRedactions || []).includes(r.id)
                        ).length
                      }
                      /{activeRedactions.length} revelada(s)
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        saveEntity(roomId, {
                          ...activeEntity,
                          unlockedRedactions: activeRedactions.map((r) => r.id),
                        })
                      }
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-800 border border-zinc-700 hover:border-cyan-500 text-xs text-zinc-100 cursor-pointer"
                    >
                      <Unlock className="w-3 h-3 text-cyan-400" />
                      <span>Revelar Todas</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        saveEntity(roomId, {
                          ...activeEntity,
                          unlockedRedactions: [],
                        })
                      }
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-800 border border-zinc-700 hover:border-[#c94a4a] text-xs text-zinc-100 cursor-pointer"
                    >
                      <Lock className="w-3 h-3 text-red-400" />
                      <span>Censurar Todas</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Main Lore Body */}
              <div className="p-5 sm:p-6 rounded-xl bg-zinc-900 border border-zinc-800">
                <RichChronicleRenderer
                  content={activeEntity.content}
                  unlockedRedactions={activeEntity.unlockedRedactions}
                  audioClips={activeEntity.audioClips}
                  onToggleRedaction={(redactionId) =>
                    toggleEntityRedaction(roomId, activeEntity, redactionId)
                  }
                />
              </div>

              {/* GM Confidential Notes */}
              {isGM && activeEntity.gmSecretNotes && (
                <div className="p-4 rounded-xl bg-zinc-900 border border-dashed border-[#c94a4a]/50">
                  <div className="text-xs font-mono uppercase text-red-400 mb-1">
                    Anotações Exclusivas do Mestre
                  </div>
                  <p className="text-xs text-zinc-100 whitespace-pre-wrap leading-relaxed">
                    {activeEntity.gmSecretNotes}
                  </p>
                </div>
              )}

              {/* Automatic Backlinks */}
              <section className="pt-4 border-t border-zinc-800">
                <div className="flex items-center gap-2 mb-3">
                  <Link2 className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-400">
                    Referências Cruzadas & Backlinks ({backlinks.length})
                  </h3>
                </div>
                {backlinks.length === 0 ? (
                  <p className="text-xs text-zinc-500">
                    Nenhum outro documento público menciona esta página ainda. Cite{' '}
                    <span className="font-mono text-zinc-400">@{activeEntity.title}</span> em
                    outras páginas ou cartas para criar conexões automáticas aqui e no Grafo.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {backlinks.map((bl) => (
                      <button
                        key={bl.id}
                        type="button"
                        onClick={bl.onOpen}
                        className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-cyan-500 text-left transition-colors cursor-pointer"
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <FileText className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          <span className="text-xs font-semibold text-zinc-100 truncate">
                            {bl.label}
                          </span>
                        </span>
                        <span className="text-[11px] font-mono text-zinc-400 shrink-0">
                          {bl.sourceKind}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            </article>
          )
        )}
      </main>
    </div>
  );
}
