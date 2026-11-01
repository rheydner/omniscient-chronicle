'use client';

import React, { useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import {
  ExternalLink,
  Eye,
  EyeOff,
  GitFork,
  HelpCircle,
  Link2,
  Plus,
  Trash2,
  User,
} from 'lucide-react';
import { useChronicleStore, useEffectiveGM } from '@/store/useChronicleStore';
import { deleteGenealogyTree, saveGenealogyTree } from '@/lib/chronicle-actions';
import type {
  GenealogyBond,
  GenealogyMember,
  GenealogyTree,
  MemberStatus,
} from '@/types/chronicle';

type MemberNodeData = {
  member: GenealogyMember;
  maskedForPlayer: boolean;
  isGM: boolean;
  resolvedAvatarUrl: string | null;
  onToggleHidden?: () => void;
  onOpenLink?: () => void;
  onRemove?: () => void;
  [key: string]: unknown;
};

type MemberFlowNode = Node<MemberNodeData, 'genealogyMember'>;

const STATUS_BADGE: Record<MemberStatus, { label: string; cls: string }> = {
  alive: { label: 'Vivo', cls: 'bg-[#4fa3b8]/15 text-[#7cc6d8]' },
  deceased: { label: 'Falecido', cls: 'bg-[#222834] text-[#a5a095]' },
  missing: { label: 'Desaparecido', cls: 'bg-[#d4a359]/15 text-[#e2b56e]' },
  unknown: { label: 'Incógnito', cls: 'bg-[#c94a4a]/15 text-[#e07b7b]' },
};

function GenealogyMemberCard({ data }: NodeProps<MemberFlowNode>) {
  const { member, maskedForPlayer, isGM, resolvedAvatarUrl } = data;
  const st = STATUS_BADGE[member.status] || STATUS_BADGE.unknown;

  return (
    <div
      className={`w-60 rounded-xl border p-3.5 shadow-lg ${
        maskedForPlayer
          ? 'bg-[#0e1116] border-dashed border-[#313a4b] text-[#6f6b62]'
          : member.isIdentityHidden && isGM
          ? 'bg-[#191713] border-[#d4a359]/60 text-[#ece8df]'
          : 'bg-[#13171e] border-[#222834] text-[#ece8df]'
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2 !h-2 !bg-[#d4a359] !border-0"
      />
      <Handle
        type="target"
        id="left"
        position={Position.Left}
        className="!w-2 !h-2 !bg-[#e2b56e] !border-0"
      />

      <div className="flex items-start gap-2.5">
        <div className="w-10 h-10 rounded-lg bg-[#0e1116] border border-[#313a4b] overflow-hidden shrink-0 flex items-center justify-center">
          {maskedForPlayer ? (
            <HelpCircle className="w-5 h-5 text-[#6f6b62]" />
          ) : resolvedAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={resolvedAvatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <User className="w-4 h-4 text-[#d4a359]" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-xs font-bold truncate">
            {maskedForPlayer ? member.hiddenAlias || '??? (Membro Oculto)' : member.name}
          </div>
          <div className="text-[11px] text-[#a5a095] truncate">
            {maskedForPlayer ? 'Identidade Selada' : member.role}
          </div>
          <div className="flex items-center gap-1.5 mt-1.5">
            {!maskedForPlayer && (
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${st.cls}`}>
                {st.label}
              </span>
            )}
            <span className="text-[10px] font-mono text-[#6f6b62]">
              Ger. {member.generation + 1}
            </span>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      {(isGM || (!maskedForPlayer && data.onOpenLink)) && (
        <div className="mt-2.5 pt-2 border-t border-[#222834] flex items-center justify-between gap-1">
          <div>
            {!maskedForPlayer && data.onOpenLink && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  data.onOpenLink?.();
                }}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#d4a359] hover:underline cursor-pointer"
              >
                <ExternalLink className="w-3 h-3" />
                <span>{member.characterId ? 'Abrir Ficha' : 'Abrir Wiki'}</span>
              </button>
            )}
          </div>
          {isGM && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  data.onToggleHidden?.();
                }}
                className="p-1 rounded bg-[#0e1116] border border-[#222834] text-xs cursor-pointer"
                title={
                  member.isIdentityHidden
                    ? 'Oculto como ??? para jogadores (Clique para revelar)'
                    : 'Revelado (Clique para mascarar como ???)'
                }
              >
                {member.isIdentityHidden ? (
                  <EyeOff className="w-3 h-3 text-[#c94a4a]" />
                ) : (
                  <Eye className="w-3 h-3 text-[#d4a359]" />
                )}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  data.onRemove?.();
                }}
                className="p-1 rounded bg-[#0e1116] border border-[#222834] text-[#6f6b62] hover:text-[#c94a4a] cursor-pointer"
                title="Remover membro"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !bg-[#d4a359] !border-0"
      />
      <Handle
        type="source"
        id="right"
        position={Position.Right}
        className="!w-2 !h-2 !bg-[#e2b56e] !border-0"
      />
    </div>
  );
}

const NODE_TYPES = {
  genealogyMember: GenealogyMemberCard,
};

export function GenealogyModule() {
  const isGM = useEffectiveGM();
  const roomId = useChronicleStore((s) => s.roomId);
  const trees = useChronicleStore((s) => s.trees);
  const entities = useChronicleStore((s) => s.entities);
  const characters = useChronicleStore((s) => s.characters);
  const selectedTreeId = useChronicleStore((s) => s.selectedTreeId);
  const setSelectedTreeId = useChronicleStore((s) => s.setSelectedTreeId);
  const navigateToEntity = useChronicleStore((s) => s.navigateToEntity);
  const openFloatingSheet = useChronicleStore((s) => s.openFloatingSheet);
  const showToast = useChronicleStore((s) => s.showToast);

  // New Tree Form
  const [newTreeName, setNewTreeName] = useState('');
  const [newTreeKind, setNewTreeKind] = useState<'family' | 'faction'>('family');

  // Add Member Form
  const [memName, setMemName] = useState('');
  const [memRole, setMemRole] = useState('');
  const [memGen, setMemGen] = useState(0);
  const [memStatus, setMemStatus] = useState<MemberStatus>('alive');
  const [memHidden, setMemHidden] = useState(false);
  const [memLinkKey, setMemLinkKey] = useState('');

  // Add Bond Form
  const [bondFrom, setBondFrom] = useState('');
  const [bondTo, setBondTo] = useState('');
  const [bondType, setBondType] = useState<'parent' | 'marriage' | 'command'>('parent');

  const visibleTrees = useMemo(
    () =>
      Object.values(trees)
        .filter((t) => isGM || t.isPublicToPlayers)
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [trees, isGM]
  );

  const activeTree = useMemo(() => {
    if (selectedTreeId && trees[selectedTreeId]) {
      const t = trees[selectedTreeId];
      if (isGM || t.isPublicToPlayers) return t;
    }
    return visibleTrees[0] || null;
  }, [selectedTreeId, trees, isGM, visibleTrees]);

  const handleCreateTree = async () => {
    const title = newTreeName.trim() || 'Nova Linhagem / Hierarquia';
    const nextTree: GenealogyTree = {
      id: `tree_${crypto.randomUUID().slice(0, 8)}`,
      name: title,
      subtitle:
        newTreeKind === 'family'
          ? 'Árvore genealógica e sucessão dinástica'
          : 'Cadeia de comando e células operacionais',
      kind: newTreeKind,
      members: [],
      bonds: [],
      isPublicToPlayers: true,
      updatedAt: Date.now(),
    };
    await saveGenealogyTree(roomId, nextTree);
    setSelectedTreeId(nextTree.id);
    setNewTreeName('');
    showToast('Árvore criada.');
  };

  const handleAddMember = async () => {
    if (!activeTree || !memName.trim()) return;
    let entityId: string | null = null;
    let characterId: string | null = null;
    if (memLinkKey.startsWith('char:')) characterId = memLinkKey.slice(5);
    if (memLinkKey.startsWith('ent:')) entityId = memLinkKey.slice(4);

    const sameGenCount = activeTree.members.filter((m) => m.generation === memGen).length;
    const nextMem: GenealogyMember = {
      id: `mem_${crypto.randomUUID().slice(0, 8)}`,
      name: memName.trim(),
      role: memRole.trim() || 'Membro',
      generation: Math.max(0, memGen),
      order: sameGenCount,
      entityId,
      characterId,
      avatarUrl: characterId ? characters[characterId]?.avatarUrl ?? null : null,
      status: memStatus,
      isIdentityHidden: memHidden,
      hiddenAlias: '??? (Descendente Oculto)',
    };

    await saveGenealogyTree(roomId, {
      ...activeTree,
      members: [...activeTree.members, nextMem],
    });
    setMemName('');
    setMemRole('');
    setMemLinkKey('');
    showToast('Membro adicionado à árvore.');
  };

  const handleAddBond = async () => {
    if (!activeTree || !bondFrom || !bondTo || bondFrom === bondTo) return;
    const nextBond: GenealogyBond = {
      id: `bnd_${crypto.randomUUID().slice(0, 8)}`,
      fromMemberId: bondFrom,
      toMemberId: bondTo,
      type: bondType,
    };
    await saveGenealogyTree(roomId, {
      ...activeTree,
      bonds: [...activeTree.bonds, nextBond],
    });
    showToast('Vínculo genealógico registrado.');
  };

  const flowNodes = useMemo<MemberFlowNode[]>(() => {
    if (!activeTree) return [];
    const byGen = new Map<number, GenealogyMember[]>();
    activeTree.members.forEach((m) => {
      if (!byGen.has(m.generation)) byGen.set(m.generation, []);
      byGen.get(m.generation)!.push(m);
    });

    const nodes: MemberFlowNode[] = [];
    Array.from(byGen.entries())
      .sort((a, b) => a[0] - b[0])
      .forEach(([gen, list]) => {
        const sorted = [...list].sort((a, b) => a.order - b.order);
        const rowWidth = sorted.length * 290;
        const startX = -rowWidth / 2 + 145;

        sorted.forEach((mem, idx) => {
          const masked = !isGM && mem.isIdentityHidden;
          const charAvatar = mem.characterId ? characters[mem.characterId]?.avatarUrl : null;
          const entAvatar = mem.entityId ? entities[mem.entityId]?.imageUrl : null;

          nodes.push({
            id: mem.id,
            type: 'genealogyMember',
            position: { x: startX + idx * 290, y: gen * 210 },
            data: {
              member: mem,
              maskedForPlayer: masked,
              isGM,
              resolvedAvatarUrl: mem.avatarUrl || charAvatar || entAvatar || null,
              onToggleHidden: () => {
                const updated = activeTree.members.map((x) =>
                  x.id === mem.id ? { ...x, isIdentityHidden: !x.isIdentityHidden } : x
                );
                void saveGenealogyTree(roomId, { ...activeTree, members: updated });
              },
              onRemove: () => {
                const updatedMembers = activeTree.members.filter((x) => x.id !== mem.id);
                const updatedBonds = activeTree.bonds.filter(
                  (b) => b.fromMemberId !== mem.id && b.toMemberId !== mem.id
                );
                void saveGenealogyTree(roomId, {
                  ...activeTree,
                  members: updatedMembers,
                  bonds: updatedBonds,
                });
              },
              onOpenLink: mem.characterId
                ? () => openFloatingSheet(mem.characterId!)
                : mem.entityId
                ? () => navigateToEntity(mem.entityId!)
                : undefined,
            },
          });
        });
      });

    return nodes;
  }, [activeTree, isGM, characters, entities, roomId, openFloatingSheet, navigateToEntity]);

  const flowEdges = useMemo<Edge[]>(() => {
    if (!activeTree) return [];
    return activeTree.bonds
      .filter((b) => isGM || !b.isSecretGM)
      .map((b) => {
        const isMarriage = b.type === 'marriage';
        const color =
          b.type === 'marriage' ? '#e2b56e' : b.type === 'command' ? '#4fa3b8' : '#d4a359';
        return {
          id: b.id,
          source: b.fromMemberId,
          target: b.toMemberId,
          sourceHandle: isMarriage ? 'right' : undefined,
          targetHandle: isMarriage ? 'left' : undefined,
          type: isMarriage ? 'straight' : 'smoothstep',
          label:
            b.type === 'marriage'
              ? 'União'
              : b.type === 'command'
              ? 'Comando'
              : undefined,
          style: {
            stroke: color,
            strokeWidth: 2,
            strokeDasharray: isMarriage ? '5 4' : undefined,
          },
          labelStyle: { fill: '#ece8df', fontSize: 10 },
          labelBgStyle: { fill: '#0e1116', fillOpacity: 0.85 },
          markerEnd: isMarriage
            ? undefined
            : {
                type: MarkerType.ArrowClosed,
                color,
              },
        };
      });
  }, [activeTree, isGM]);

  return (
    <div className="flex flex-col lg:flex-row h-full min-h-0 bg-[#0b0d10]">
      {/* Tree Canvas */}
      <div className="flex-1 relative min-h-[440px]">
        {/* Top Tree Selector */}
        <div className="absolute top-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
          <div className="pointer-events-auto flex flex-wrap items-center gap-2 p-1.5 rounded-xl bg-[#0e1116]/95 border border-[#222834]">
            <GitFork className="w-4 h-4 text-[#d4a359] ml-1.5" />
            {visibleTrees.length === 0 ? (
              <span className="text-xs text-[#a5a095] px-2">Nenhuma linhagem criada</span>
            ) : (
              <select
                value={activeTree?.id || ''}
                onChange={(e) => setSelectedTreeId(e.target.value)}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-[#13171e] border border-[#313a4b] text-[#ece8df]"
              >
                {visibleTrees.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.kind === 'family' ? 'Família' : 'Facção'})
                  </option>
                ))}
              </select>
            )}
            {isGM && activeTree && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    saveGenealogyTree(roomId, {
                      ...activeTree,
                      isPublicToPlayers: !activeTree.isPublicToPlayers,
                    })
                  }
                  className="px-2.5 py-1 rounded-lg bg-[#13171e] border border-[#222834] text-xs text-[#a5a095] hover:text-[#ece8df] cursor-pointer"
                >
                  {activeTree.isPublicToPlayers ? 'Pública' : 'Oculta (GM)'}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!window.confirm(`Excluir árvore "${activeTree.name}"?`)) return;
                    await deleteGenealogyTree(roomId, activeTree.id);
                    setSelectedTreeId(null);
                  }}
                  className="p-1 text-[#6f6b62] hover:text-[#c94a4a] cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>

        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={NODE_TYPES}
          fitView
          minZoom={0.3}
          maxZoom={1.7}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#222834" gap={28} size={1} />
          <Controls />
        </ReactFlow>
      </div>

      {/* Right GM Authoring Panel */}
      {isGM && (
        <aside className="w-full lg:w-84 shrink-0 border-t lg:border-t-0 lg:border-l border-[#222834] bg-[#0e1116] overflow-y-auto custom-scrollbar p-4 space-y-5">
          {/* Create Tree */}
          <section className="p-3.5 rounded-xl bg-[#13171e] border border-[#222834] space-y-2.5">
            <div className="text-xs font-bold text-[#ece8df]">Nova Árvore / Hierarquia</div>
            <input
              type="text"
              value={newTreeName}
              onChange={(e) => setNewTreeName(e.target.value)}
              placeholder="Ex.: Casa Valerius ou 3ª Divisão"
              className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-[#0e1116] border border-[#222834] text-[#ece8df]"
            />
            <div className="flex items-center gap-2">
              <select
                value={newTreeKind}
                onChange={(e) => setNewTreeKind(e.target.value as 'family' | 'faction')}
                className="flex-1 px-2.5 py-1.5 text-xs rounded-lg bg-[#0e1116] border border-[#222834] text-[#ece8df]"
              >
                <option value="family">Genealogia Familiar</option>
                <option value="faction">Hierarquia de Facção</option>
              </select>
              <button
                type="button"
                onClick={handleCreateTree}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#d4a359] text-[#0b0d10] font-semibold text-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Criar</span>
              </button>
            </div>
          </section>

          {activeTree && (
            <>
              {/* Add Member */}
              <section className="p-3.5 rounded-xl bg-[#13171e] border border-[#222834] space-y-2.5">
                <div className="text-xs font-bold text-[#ece8df]">
                  Adicionar Membro em {activeTree.name}
                </div>
                <input
                  type="text"
                  value={memName}
                  onChange={(e) => setMemName(e.target.value)}
                  placeholder="Nome verdadeiro..."
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-[#0e1116] border border-[#222834] text-[#ece8df]"
                />
                <input
                  type="text"
                  value={memRole}
                  onChange={(e) => setMemRole(e.target.value)}
                  placeholder="Título / Papel (ex.: Patriarca, Capitão)..."
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-[#0e1116] border border-[#222834] text-[#ece8df]"
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-[#a5a095] mb-0.5">
                      Geração / Escalão
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={memGen}
                      onChange={(e) => setMemGen(Number(e.target.value))}
                      className="w-full px-2.5 py-1 text-xs font-mono rounded-lg bg-[#0e1116] border border-[#222834] text-[#ece8df]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#a5a095] mb-0.5">Condição</label>
                    <select
                      value={memStatus}
                      onChange={(e) => setMemStatus(e.target.value as MemberStatus)}
                      className="w-full px-2 py-1 text-xs rounded-lg bg-[#0e1116] border border-[#222834] text-[#ece8df]"
                    >
                      <option value="alive">Vivo</option>
                      <option value="deceased">Falecido</option>
                      <option value="missing">Desaparecido</option>
                      <option value="unknown">Incógnito</option>
                    </select>
                  </div>
                </div>

                <select
                  value={memLinkKey}
                  onChange={(e) => setMemLinkKey(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-[#0e1116] border border-[#222834] text-[#ece8df]"
                >
                  <option value="">Vincular Ficha ou Página Wiki (opcional)...</option>
                  <optgroup label="Fichas Omniscient Sheet">
                    {Object.values(characters).map((ch) => (
                      <option key={ch.id} value={`char:${ch.id}`}>
                        {ch.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Páginas do Atlas">
                    {Object.values(entities).map((en) => (
                      <option key={en.id} value={`ent:${en.id}`}>
                        {en.title}
                      </option>
                    ))}
                  </optgroup>
                </select>

                <label className="flex items-center gap-2 text-xs text-[#a5a095] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={memHidden}
                    onChange={(e) => setMemHidden(e.target.checked)}
                  />
                  <span>Ocultar identidade como &ldquo;???&rdquo; para jogadores</span>
                </label>

                <button
                  type="button"
                  onClick={handleAddMember}
                  className="w-full py-1.5 rounded-lg bg-[#d4a359] hover:bg-[#e2b56e] text-[#0b0d10] font-semibold text-xs cursor-pointer"
                >
                  Inserir Membro
                </button>
              </section>

              {/* Add Bond */}
              <section className="p-3.5 rounded-xl bg-[#13171e] border border-[#222834] space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#ece8df]">
                  <Link2 className="w-3.5 h-3.5 text-[#d4a359]" />
                  <span>Conectar Linhagem / Comando</span>
                </div>
                <select
                  value={bondFrom}
                  onChange={(e) => setBondFrom(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-[#0e1116] border border-[#222834] text-[#ece8df]"
                >
                  <option value="">De (Ascendente / Líder)...</option>
                  {activeTree.members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <select
                  value={bondTo}
                  onChange={(e) => setBondTo(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-[#0e1116] border border-[#222834] text-[#ece8df]"
                >
                  <option value="">Para (Descendente / Cônjuge / Subordinado)...</option>
                  {activeTree.members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <select
                  value={bondType}
                  onChange={(e) =>
                    setBondType(e.target.value as 'parent' | 'marriage' | 'command')
                  }
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-[#0e1116] border border-[#222834] text-[#ece8df]"
                >
                  <option value="parent">Filiação / Descendência</option>
                  <option value="marriage">Matrimônio / União</option>
                  <option value="command">Comando Hierárquico</option>
                </select>
                <button
                  type="button"
                  onClick={handleAddBond}
                  className="w-full py-1.5 rounded-lg bg-[#191e27] border border-[#313a4b] hover:border-[#d4a359] text-xs font-semibold text-[#ece8df] cursor-pointer"
                >
                  Criar Vínculo
                </button>
              </section>
            </>
          )}
        </aside>
      )}
    </div>
  );
}
