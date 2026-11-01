'use client';

import React, { useMemo, useState } from 'react';
import {
  Edit3,
  FileLock2,
  FileText,
  Folder,
  FolderPlus,
  Hand,
  ImagePlus,
  Lock,
  MonitorPlay,
  MonitorX,
  Plus,
  RotateCcw,
  Save,
  Share2,
  Trash2,
  Unlock,
  Users,
  X,
} from 'lucide-react';
import { useChronicleStore, useEffectiveGM } from '@/store/useChronicleStore';
import { useConfirmStore } from '@/store/useConfirmStore';
import {
  assignDocumentPossession,
  deleteDocument,
  deleteFolder,
  projectDocumentToVTT,
  saveDocument,
  saveFolder,
  stopVTTProjection,
  toggleDocumentRedaction,
} from '@/lib/chronicle-actions';
import { extractRedactions } from '@/lib/markdown-engine';
import { uploadChronicleAsset } from '@/lib/storage';
import { RichChronicleRenderer } from '@/components/shared/RichChronicleRenderer';
import { RichChronicleEditor } from '@/components/shared/RichChronicleEditor';
import type {
  AudioClipBlock,
  ChronicleDocument,
  DocumentPaperTheme,
} from '@/types/chronicle';

const PAPER_THEME_LABELS: Record<DocumentPaperTheme, string> = {
  'dark-dossier': 'Dossiê Noturno',
  'sepia-parchment': 'Carta Física (Sépia)',
  'typewriter-report': 'Relatório Datilografado',
};

export function JournalModule() {
  const isGM = useEffectiveGM();
  const roomId = useChronicleStore((s) => s.roomId);
  const userUid = useChronicleStore((s) => s.userUid);
  const userEmail = useChronicleStore((s) => s.userEmail);

  const folders = useChronicleStore((s) => s.folders);
  const documents = useChronicleStore((s) => s.documents);
  const characters = useChronicleStore((s) => s.characters);
  const registeredUsers = useChronicleStore((s) => s.registeredUsers);
  const activeHandout = useChronicleStore((s) => s.activeHandout);

  const selectedDocumentId = useChronicleStore((s) => s.selectedDocumentId);
  const setSelectedDocumentId = useChronicleStore((s) => s.setSelectedDocumentId);
  const showToast = useChronicleStore((s) => s.showToast);

  const [selectedFolder, setSelectedFolder] = useState<string | 'all'>('all');
  const [showFolderInput, setShowFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<ChronicleDocument | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const journalFolders = useMemo(
    () =>
      Object.values(folders)
        .filter((f) => f.scope === 'journal')
        .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)),
    [folders]
  );

  // Check if current logged-in player holds a specific document
  const isPlayerHolder = (docItem: ChronicleDocument): boolean => {
    if (docItem.possessionMode !== 'single-holder') return false;
    if (userUid && docItem.holderUserId && docItem.holderUserId === userUid) return true;
    if (
      userEmail &&
      docItem.holderEmail &&
      docItem.holderEmail.toLowerCase() === userEmail.toLowerCase()
    ) {
      return true;
    }
    if (docItem.holderCharacterId) {
      const ch = characters[docItem.holderCharacterId];
      if (ch) {
        if (userUid && (ch.userId === userUid || ch.ownerId === userUid)) return true;
        if (userUid && ch.allowedUsers?.includes(userUid)) return true;
        if (
          userEmail &&
          ((ch.userEmail && ch.userEmail.toLowerCase() === userEmail.toLowerCase()) ||
            (ch.ownerEmail && ch.ownerEmail.toLowerCase() === userEmail.toLowerCase()))
        ) {
          return true;
        }
      }
    }
    return false;
  };

  const visibleDocuments = useMemo(() => {
    return Object.values(documents)
      .filter((d) => {
        if (selectedFolder !== 'all' && d.folderId !== selectedFolder) return false;
        if (isGM) return true;
        if (d.possessionMode === 'party-public') return true;
        return isPlayerHolder(d);
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documents, selectedFolder, isGM, userUid, userEmail, characters]);

  const activeDoc = useMemo(() => {
    if (selectedDocumentId && documents[selectedDocumentId]) {
      const cand = documents[selectedDocumentId];
      if (isGM || cand.possessionMode === 'party-public' || isPlayerHolder(cand)) {
        return cand;
      }
    }
    return visibleDocuments[0] || null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDocumentId, documents, isGM, visibleDocuments, userUid, userEmail]);

  const handleCreateDocument = async () => {
    const now = Date.now();
    const nextDoc: ChronicleDocument = {
      id: `doc_${crypto.randomUUID().slice(0, 8)}`,
      title: 'Nova Carta ou Evidência',
      code: `DOC-${String(Object.keys(documents).length + 1).padStart(3, '0')}`,
      folderId: selectedFolder !== 'all' ? selectedFolder : null,
      paperTheme: 'sepia-parchment',
      possessionMode: 'gm-vault',
      holderCharacterId: null,
      holderUserId: null,
      holderEmail: null,
      holderName: null,
      imageUrl: null,
      content:
        'Escreva a mensagem encontrada. Use Tarjas Pretas para trechos ilegíveis ou censurados...',
      unlockedRedactions: [],
      audioClips: [],
      updatedAt: now,
      createdAt: now,
    };
    await saveDocument(roomId, nextDoc);
    setSelectedDocumentId(nextDoc.id);
    setDraft(nextDoc);
    setIsEditing(true);
    showToast('Documento criado no Cofre do Mestre.');
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    const fld = {
      id: `jfld_${crypto.randomUUID().slice(0, 8)}`,
      name: newFolderName.trim(),
      scope: 'journal' as const,
      parentId: null,
      order: journalFolders.length + 1,
      createdAt: Date.now(),
    };
    await saveFolder(roomId, fld);
    setNewFolderName('');
    setShowFolderInput(false);
    setSelectedFolder(fld.id);
  };

  const handleSaveDraft = async () => {
    if (!draft) return;
    await saveDocument(roomId, {
      ...draft,
      title: draft.title.trim() || 'Documento Sem Título',
    });
    setIsEditing(false);
    setDraft(null);
    showToast('Documento salvo.');
  };

  const handleUploadAttachment = async (file: File) => {
    if (!draft) return;
    setIsUploading(true);
    const url = await uploadChronicleAsset(roomId, 'documents', file);
    setIsUploading(false);
    if (!url) {
      showToast('Falha ao enviar anexo ao Supabase Storage.');
      return;
    }
    setDraft({ ...draft, imageUrl: url });
    showToast('Imagem anexada ao documento.');
  };

  const isCurrentlyProjected =
    Boolean(activeHandout?.active) && activeHandout?.docId === activeDoc?.id;

  const activeRedactions = useMemo(
    () => (activeDoc ? extractRedactions(activeDoc.content) : []),
    [activeDoc]
  );

  // Build unified list of recipients for physical possession assignment
  const holderCandidates = useMemo(() => {
    const opts: Array<{
      key: string;
      label: string;
      characterId: string | null;
      userId: string | null;
      email: string | null;
      name: string;
    }> = [];

    Object.values(characters).forEach((ch) => {
      opts.push({
        key: `char:${ch.id}`,
        label: `Personagem: ${ch.name} (${ch.className || 'Ficha'})`,
        characterId: ch.id,
        userId: ch.userId || ch.ownerId || null,
        email: ch.userEmail || ch.ownerEmail || null,
        name: ch.name,
      });
    });

    registeredUsers.forEach((u) => {
      opts.push({
        key: `user:${u.uid}`,
        label: `Jogador: ${u.name} (${u.email})`,
        characterId: null,
        userId: u.uid,
        email: u.email || null,
        name: u.name,
      });
    });

    return opts;
  }, [characters, registeredUsers]);

  const currentHolderSelectValue = useMemo(() => {
    if (!activeDoc) return 'gm-vault';
    if (activeDoc.possessionMode === 'gm-vault') return 'gm-vault';
    if (activeDoc.possessionMode === 'party-public') return 'party-public';
    if (activeDoc.holderCharacterId) return `char:${activeDoc.holderCharacterId}`;
    if (activeDoc.holderUserId) return `user:${activeDoc.holderUserId}`;
    return 'gm-vault';
  }, [activeDoc]);

  return (
    <div className="flex flex-col lg:flex-row h-full min-h-0 bg-zinc-950">
      {/* Left Document List */}
      <aside className="w-full lg:w-80 shrink-0 border-b lg:border-b-0 lg:border-r border-zinc-800 bg-zinc-950 flex flex-col max-h-[36vh] lg:max-h-none">
        <div className="p-3.5 border-b border-zinc-800 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-zinc-100">Diário, Dossiês & Cartas</h2>
              <p className="text-xs text-zinc-400">
                Posse física de pistas e projeção no VTT
              </p>
            </div>
            {isGM && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowFolderInput((p) => !p)}
                  className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-100 cursor-pointer"
                  title="Nova Pasta de Dossiês"
                >
                  <FolderPlus className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleCreateDocument}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-[#0b0d10] font-semibold text-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Carta</span>
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
                className="flex-1 px-2.5 py-1.5 text-xs rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100"
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

          {journalFolders.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pt-1">
              <button
                type="button"
                onClick={() => setSelectedFolder('all')}
                className={`px-2 py-0.5 rounded text-xs font-mono shrink-0 cursor-pointer ${
                  selectedFolder === 'all'
                    ? 'bg-cyan-600/15 text-cyan-300 border border-cyan-500/35'
                    : 'text-zinc-400'
                }`}
              >
                Todas
              </button>
              {journalFolders.map((f) => (
                <div key={f.id} className="flex items-center shrink-0">
                  <button
                    type="button"
                    onClick={() => setSelectedFolder(f.id)}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs cursor-pointer ${
                      selectedFolder === f.id
                        ? 'bg-zinc-800 text-zinc-100 border border-zinc-700'
                        : 'text-zinc-400'
                    }`}
                  >
                    <Folder className="w-3 h-3 text-cyan-400" />
                    <span>{f.name}</span>
                  </button>
                  {isGM && selectedFolder === f.id && (
                    <button
                      type="button"
                      onClick={async () => {
                        await deleteFolder(roomId, f.id);
                        setSelectedFolder('all');
                      }}
                      className="ml-0.5 p-0.5 text-zinc-500 hover:text-red-400 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
          {visibleDocuments.length === 0 ? (
            <div className="p-5 text-center text-xs text-zinc-500">
              {isGM
                ? 'Nenhuma carta ou dossiê registrado.'
                : 'Você ainda não possui cartas em mãos nem documentos públicos na mesa.'}
            </div>
          ) : (
            visibleDocuments.map((d) => {
              const selected = activeDoc?.id === d.id;
              const projectingThis =
                Boolean(activeHandout?.active) && activeHandout?.docId === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setDraft(null);
                    setSelectedDocumentId(d.id);
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors cursor-pointer ${
                    selected
                      ? 'bg-zinc-800 border-zinc-700 text-zinc-100'
                      : 'bg-transparent border-transparent hover:bg-zinc-900 text-zinc-400 hover:text-zinc-100'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold truncate">{d.title}</span>
                    {projectingThis && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-600/20 text-cyan-300 shrink-0">
                        VTT LIVE
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <span className="text-[11px] font-mono text-zinc-500">
                      {d.code || 'DOSSIÊ'}
                    </span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                        d.possessionMode === 'gm-vault'
                          ? 'bg-zinc-950 text-zinc-400 border border-zinc-800'
                          : d.possessionMode === 'single-holder'
                          ? 'bg-cyan-600/15 text-cyan-300'
                          : 'bg-cyan-600/15 text-cyan-300'
                      }`}
                    >
                      {d.possessionMode === 'gm-vault'
                        ? 'Cofre GM'
                        : d.possessionMode === 'single-holder'
                        ? `Mãos: ${d.holderName || '1 Jogador'}`
                        : 'Mesa Toda'}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Main Letter / Dossier Desk */}
      <main className="flex-1 overflow-y-auto custom-scrollbar p-5 lg:p-8">
        {!activeDoc && !isEditing ? (
          <div className="max-w-md mx-auto my-16 p-6 rounded-xl bg-zinc-900 border border-zinc-800 text-center space-y-3">
            <FileText className="w-8 h-8 text-cyan-400 mx-auto" />
            <h3 className="text-base font-bold text-zinc-100">Mesa de Cartas & Evidências</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {isGM
                ? 'Entregue uma carta selada nas mãos de um único personagem, revele tarjas pretas em tempo real ou projete dossiês diretamente na tela do StarStream VTT.'
                : 'Quando o Mestre entregar uma carta física ao seu personagem ou revelar um dossiê para o grupo, ele aparecerá aqui.'}
            </p>
            {isGM && (
              <button
                type="button"
                onClick={handleCreateDocument}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-[#0b0d10] font-semibold text-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Redigir Primeira Carta</span>
              </button>
            )}
          </div>
        ) : isEditing && draft ? (
          <div className="max-w-4xl mx-auto space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-zinc-800">
              <div>
                <span className="text-xs font-mono uppercase text-cyan-400">
                  Editor de Evidência & Carta Física
                </span>
                <h2 className="text-lg font-bold text-zinc-100">{draft.title}</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setDraft(null);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-400 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-[#0b0d10] font-semibold text-xs cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Salvar Documento</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Título da Carta / Dossiê
                </label>
                <input
                  type="text"
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Código / Protocolo
                </label>
                <input
                  type="text"
                  value={draft.code || ''}
                  onChange={(e) => setDraft({ ...draft, code: e.target.value })}
                  placeholder="DOSSIÊ #047-B"
                  className="w-full px-3 py-2 text-sm font-mono rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Estética do Papel
                </label>
                <select
                  value={draft.paperTheme}
                  onChange={(e) =>
                    setDraft({ ...draft, paperTheme: e.target.value as DocumentPaperTheme })
                  }
                  className="w-full px-3 py-2 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
                >
                  {(Object.keys(PAPER_THEME_LABELS) as DocumentPaperTheme[]).map((th) => (
                    <option key={th} value={th}>
                      {PAPER_THEME_LABELS[th]}
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
                  <option value="">Sem Pasta</option>
                  {journalFolders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Imagem Escaneada / Selo (Opcional)
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={draft.imageUrl || ''}
                    onChange={(e) => setDraft({ ...draft, imageUrl: e.target.value || null })}
                    placeholder="https://..."
                    className="flex-1 px-2.5 py-1.5 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
                  />
                  <label className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-xs cursor-pointer shrink-0">
                    <ImagePlus className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{isUploading ? '...' : 'Upload'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleUploadAttachment(f);
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>

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
        ) : (
          activeDoc && (
            <div className="max-w-3xl mx-auto space-y-5">
              {/* Top Action Bar: Physical Possession + Live StarStream VTT Projection */}
              {isGM ? (
                <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Hand className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs font-semibold text-zinc-100">
                        Liberar na Biblioteca do VTT:
                      </span>
                      <select
                        value={currentHolderSelectValue}
                        onChange={async (e) => {
                          const val = e.target.value;
                          if (val === 'gm-vault') {
                            await assignDocumentPossession(roomId, activeDoc, 'gm-vault');
                            showToast('Documento recolhido para o Cofre do Mestre (Oculto no VTT).');
                          } else if (val === 'party-public') {
                            await assignDocumentPossession(roomId, activeDoc, 'party-public');
                            showToast('Documento liberado na Biblioteca de todos os jogadores!');
                          } else {
                            const found = holderCandidates.find((c) => c.key === val);
                            if (found) {
                              await assignDocumentPossession(roomId, activeDoc, 'single-holder', {
                                characterId: found.characterId,
                                userId: found.userId,
                                email: found.email,
                                name: found.name,
                              });
                              showToast(`Carta liberada exclusivamente na Biblioteca de ${found.name}!`);
                            }
                          }
                        }}
                        className="px-2.5 py-1.5 text-xs rounded-lg bg-zinc-950 border border-zinc-700 text-zinc-100"
                      >
                        <option value="gm-vault">Cofre do Mestre (Oculto no VTT)</option>
                        <option value="party-public">Liberar para Todos os Jogadores</option>
                        {holderCandidates.length > 0 && (
                          <optgroup label="Entregar em Mãos (Posse Exclusiva)">
                            {holderCandidates.map((cand) => (
                              <option key={cand.key} value={cand.key}>
                                Entregar para {cand.label}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {isCurrentlyProjected ? (
                        <button
                          type="button"
                          onClick={async () => {
                            await stopVTTProjection(roomId);
                            showToast('Projeção encerrada no StarStream VTT.');
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#c94a4a] text-zinc-100 font-semibold text-xs cursor-pointer"
                        >
                          <MonitorX className="w-3.5 h-3.5" />
                          <span>Encerrar Projeção VTT</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={async () => {
                            await projectDocumentToVTT(roomId, activeDoc);
                            showToast(
                              activeDoc.possessionMode === 'single-holder'
                                ? `Projetado no StarStream VTT apenas para ${activeDoc.holderName}!`
                                : 'Dossiê projetado ao vivo na tela do StarStream VTT!'
                            );
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 text-[#0b0d10] font-semibold text-xs hover:opacity-90 transition-opacity cursor-pointer"
                        >
                          <MonitorPlay className="w-3.5 h-3.5" />
                          <span>Projetar no StarStream VTT</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setDraft({ ...activeDoc });
                          setIsEditing(true);
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 hover:border-cyan-500 text-xs text-zinc-100 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Editar</span>
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          const confirmed = await useConfirmStore.getState().ask({
                            title: 'Excluir Documento',
                            message: `Deseja realmente excluir "${activeDoc.title}"? O documento será removido do Chronicle e da biblioteca do VTT.`,
                            confirmLabel: 'Excluir',
                            cancelLabel: 'Cancelar',
                            variant: 'danger',
                          });
                          if (!confirmed) return;
                          await deleteDocument(roomId, activeDoc.id);
                          setSelectedDocumentId(null);
                        }}
                        className="p-1.5 rounded-lg bg-zinc-950 border border-zinc-800 hover:border-[#c94a4a] text-zinc-400 hover:text-red-400 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* GM Redaction quick actions */}
                  {activeRedactions.length > 0 && (
                    <div className="pt-2.5 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="flex items-center gap-1.5 text-zinc-400">
                        <FileLock2 className="w-3.5 h-3.5 text-red-400" />
                        <span>
                          Tarjas Pretas neste documento:{' '}
                          <strong className="text-zinc-100">
                            {
                              activeRedactions.filter((r) =>
                                (activeDoc.unlockedRedactions || []).includes(r.id)
                              ).length
                            }
                            /{activeRedactions.length}
                          </strong>{' '}
                          revelada(s) (clique direto na tarja abaixo para revelar ao vivo)
                        </span>
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            saveDocument(roomId, {
                              ...activeDoc,
                              unlockedRedactions: activeRedactions.map((r) => r.id),
                            })
                          }
                          className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-950 border border-zinc-800 hover:border-cyan-500 text-zinc-100 cursor-pointer"
                        >
                          <Unlock className="w-3 h-3 text-cyan-400" />
                          <span>Revelar Tudo</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            saveDocument(roomId, {
                              ...activeDoc,
                              unlockedRedactions: [],
                            })
                          }
                          className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-950 border border-zinc-800 hover:border-[#c94a4a] text-zinc-100 cursor-pointer"
                        >
                          <Lock className="w-3 h-3 text-red-400" />
                          <span>Censurar Tudo</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Exclusive Holding Player Controls */
                activeDoc.possessionMode === 'single-holder' &&
                isPlayerHolder(activeDoc) && (
                  <div className="p-4 rounded-xl bg-zinc-900 border border-cyan-500/45 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold text-cyan-300 flex items-center gap-1.5">
                        <Hand className="w-4 h-4" />
                        <span>Esta carta está em sua posse exclusiva ({activeDoc.holderName})</span>
                      </div>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        Os outros jogadores não conseguem vê-la até que você decida mostrá-la na
                        mesa.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          await assignDocumentPossession(roomId, activeDoc, 'party-public');
                          showToast('Você colocou a carta aberta sobre a mesa para todo o grupo!');
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-[#0b0d10] font-semibold text-xs cursor-pointer"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>Revelar para a Mesa</span>
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const confirmed = await useConfirmStore.getState().ask({
                            title: 'Devolver Carta ao Mestre',
                            message: 'Deseja devolver esta carta física ao Cofre do Mestre? Ela deixará de estar em suas mãos.',
                            confirmLabel: 'Devolver',
                            cancelLabel: 'Cancelar',
                            variant: 'warning',
                          });
                          if (!confirmed) return;
                          await assignDocumentPossession(roomId, activeDoc, 'gm-vault');
                          showToast('Carta devolvida ao Mestre.');
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-zinc-100 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Devolver ao Mestre</span>
                      </button>
                    </div>
                  </div>
                )
              )}

              {/* Diegetic Paper Surface */}
              <div
                className={`rounded-xl border p-6 sm:p-9 ${
                  activeDoc.paperTheme === 'sepia-parchment'
                    ? 'bg-[#f3ead6] text-[#221b13] border-[#cbb894] font-sans'
                    : activeDoc.paperTheme === 'typewriter-report'
                    ? 'bg-[#12151b] text-[#dcd8ce] border-zinc-700 font-mono'
                    : 'bg-zinc-900 text-zinc-100 border-zinc-800'
                }`}
              >
                <div
                  className={`flex flex-wrap items-center justify-between gap-2 pb-4 mb-5 border-b ${
                    activeDoc.paperTheme === 'sepia-parchment'
                      ? 'border-[#cbb894]'
                      : 'border-zinc-800'
                  }`}
                >
                  <div>
                    <div
                      className={`text-xs font-mono uppercase tracking-wider ${
                        activeDoc.paperTheme === 'sepia-parchment'
                          ? 'text-[#6e5227]'
                          : 'text-cyan-400'
                      }`}
                    >
                      {activeDoc.code || 'REGISTRO ARQUIVADO'}
                    </div>
                    <h1 className="text-2xl font-bold mt-0.5 text-balance">{activeDoc.title}</h1>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-mono">
                    {activeDoc.possessionMode === 'party-public' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-black/10">
                        <Users className="w-3.5 h-3.5" />
                        <span>Mesa Toda</span>
                      </span>
                    ) : activeDoc.possessionMode === 'single-holder' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-black/10">
                        <Hand className="w-3.5 h-3.5" />
                        <span>Posse: {activeDoc.holderName || 'Exclusiva'}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-black/20">
                        <Lock className="w-3.5 h-3.5" />
                        <span>Cofre do Mestre</span>
                      </span>
                    )}
                  </div>
                </div>

                {activeDoc.imageUrl && (
                  <div className="mb-5 rounded-lg overflow-hidden border border-current/15 max-h-80 flex items-center justify-center bg-black/10">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={activeDoc.imageUrl}
                      alt={activeDoc.title}
                      className="max-h-80 w-auto object-contain"
                    />
                  </div>
                )}

                <RichChronicleRenderer
                  content={activeDoc.content}
                  unlockedRedactions={activeDoc.unlockedRedactions}
                  audioClips={activeDoc.audioClips}
                  paperTheme={activeDoc.paperTheme}
                  onToggleRedaction={(redactionId) =>
                    toggleDocumentRedaction(roomId, activeDoc, redactionId)
                  }
                />
              </div>
            </div>
          )
        )}
      </main>
    </div>
  );
}
