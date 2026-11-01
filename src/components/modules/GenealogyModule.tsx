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
import { useConfirmStore } from '@/store/useConfirmStore';
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
  alive: { label: 'Ativo / Vivo', cls: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' },
  deceased: { label: 'Falecido', cls: 'bg-zinc-800 text-zinc-400 border border-zinc-700' },
  missing: { label: 'Desaparecido', cls: 'bg-amber-500/15 text-amber-400 border border-amber-500/30' },
  unknown: { label: 'Incógnito', cls: 'bg-purple-500/15 text-purple-400 border border-purple-500/30' },
};

function GenealogyMemberCard({ data }: NodeProps<MemberFlowNode>) {
  const { member, maskedForPlayer, isGM, resolvedAvatarUrl } = data;
  const st = STATUS_BADGE[member.status] || STATUS_BADGE.unknown;

  return (
    <div
      className={`w-64 rounded-xl border p-3.5 shadow-xl transition-all ${
        maskedForPlayer
          ? 'bg-zinc-950 border-dashed border-zinc-800 text-zinc-500'
          : member.isIdentityHidden && isGM
          ? 'bg-zinc-900 border-amber-500/50 text-zinc-100 ring-1 ring-amber-500/20'
          : 'bg-zinc-900 border-zinc-800 text-zinc-100 hover:border-zinc-700'
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2.5 !h-2.5 !bg-cyan-500 !border-0"
      />
      <Handle
        type="target"
        id="left"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !bg-cyan-400 !border-0"
      />

      <div className="flex items-start gap-2.5">
        <div className="w-10 h-10 rounded-lg bg-zinc-950 border border-zinc-800 overflow-hidden shrink-0 flex items-center justify-center">
          {maskedForPlayer ? (
            <HelpCircle className="w-5 h-5 text-zinc-600" />
          ) : resolvedAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={resolvedAvatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <User className="w-4 h-4 text-cyan-400" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-xs font-bold truncate text-zinc-100">
            {maskedForPlayer ? member.hiddenAlias || '??? (Membro Oculto)' : member.name}
          </div>
          <div className="text-[11px] text-zinc-400 truncate">
            {maskedForPlayer ? 'Identidade Selada' : member.role}
          </div>
          <div className="flex items-center gap-1.5 mt-1.5">
            {!maskedForPlayer && (
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${st.cls}`}>
                {st.label}
              </span>
            )}
            <span className="text-[10px] font-mono text-zinc-500">
              Escalão {member.generation + 1}
            </span>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      {(isGM || (!maskedForPlayer && data.onOpenLink)) && (
        <div className="mt-2.5 pt-2 border-t border-zinc-800 flex items-center justify-between gap-1">
          <div>
            {!maskedForPlayer && data.onOpenLink && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  data.onOpenLink?.();
                }}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 hover:underline cursor-pointer"
              >
                <ExternalLink className="w-3 h-3" />
                <span>{member.characterId ? 'Abrir Ficha' : 'Abrir Registro'}</span>
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
                className="p-1 rounded bg-zinc-950 border border-zinc-800 text-xs text-zinc-400 hover:text-zinc-200 cursor-pointer"
                title={
                  member.isIdentityHidden
                    ? 'Oculto para jogadores (Clique para revelar)'
                    : 'Visível (Clique para mascarar como ???)'
                }
              >
                {member.isIdentityHidden ? (
                  <EyeOff className="w-3 h-3 text-red-400" />
                ) : (
                  <Eye className="w-3 h-3 text-cyan-400" />
                )}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  data.onRemove?.();
                }}
                className="p-1 rounded bg-zinc-950 border border-zinc-800 text-zinc-500 hover:text-red-400 cursor-pointer"
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
        className="!w-2.5 !h-2.5 !bg-cyan-500 !border-0"
      />
      <Handle
        type="source"
        id="right"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !bg-cyan-400 !border-0"
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
          ? 'Árvore genealógica e relações'
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
    showToast('Estrutura genealógica criada.');
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
      role: memRole.trim() || 'Operador / Membro',
      generation: Math.max(0, memGen),
      order: sameGenCount,
      entityId,
      characterId,
      avatarUrl: characterId ? characters[characterId]?.avatarUrl ?? null : null,
      status: memStatus,
      isIdentityHidden: memHidden,
      hiddenAlias: '??? (Membro Oculto)',
    };

    await saveGenealogyTree(roomId, {
      ...activeTree,
      members: [...activeTree.members, nextMem],
    });
    setMemName('');
    setMemRole('');
    setMemLinkKey('');
    showToast('Membro inserido na hierarquia.');
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
    showToast('Conexão registrada.');
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
          b.type === 'marriage' ? '#a1a1aa' : b.type === 'command' ? '#06b6d4' : '#38bdf8';
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
          labelStyle: { fill: '#f4f4f5', fontSize: 10 },
          labelBgStyle: { fill: '#18181b', fillOpacity: 0.9 },
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
    <div className="flex flex-col lg:flex-row h-full min-h-0 bg-zinc-950 text-zinc-100">
      {/* Tree Canvas */}
      <div className="flex-1 relative min-h-[440px]">
        {/* Top Tree Selector */}
        <div className="absolute top-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
          <div className="pointer-events-auto flex flex-wrap items-center gap-2 p-1.5 rounded-xl bg-zinc-950/90 backdrop-blur border border-zinc-800 shadow-lg">
            <GitFork className="w-4 h-4 text-cyan-400 ml-1.5" />
            {visibleTrees.length === 0 ? (
              <span className="text-xs text-zinc-400 px-2">Nenhuma linhagem criada</span>
            ) : (
              <select
                value={activeTree?.id || ''}
                onChange={(e) => setSelectedTreeId(e.target.value)}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 focus:border-cyan-500 outline-none"
              >
                {visibleTrees.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.kind === 'family' ? 'Genealogia' : 'Hierarquia'})
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
                  className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-400 hover:text-zinc-200 cursor-pointer"
                >
                  {activeTree.isPublicToPlayers ? 'Pública' : 'Oculta (GM)'}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const confirmed = await useConfirmStore.getState().ask({
                      title: 'Excluir Árvore Genealógica',
                      message: `Deseja realmente excluir a árvore "${activeTree.name}"? Todos os nós familiares e linhagens desta árvore serão removidos.`,
                      confirmLabel: 'Excluir Árvore',
                      cancelLabel: 'Cancelar',
                      variant: 'danger',
                    });
                    if (!confirmed) return;
                    await deleteGenealogyTree(roomId, activeTree.id);
                    setSelectedTreeId(null);
                  }}
                  className="p-1 text-zinc-500 hover:text-red-400 cursor-pointer"
                  title="Excluir árvore"
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
          <Background color="#27272a" gap={24} size={1} />
          <Controls className="!bg-zinc-900 !border-zinc-800 !text-zinc-200 [&>button]:!bg-zinc-900 [&>button]:!border-zinc-800 [&>button]:!fill-zinc-200 hover:[&>button]:!bg-zinc-800" />
        </ReactFlow>
      </div>

      {/* Right GM Authoring Panel */}
      {isGM && (
        <aside className="w-full lg:w-84 shrink-0 border-t lg:border-t-0 lg:border-l border-zinc-800 bg-zinc-950 overflow-y-auto custom-scrollbar p-4 space-y-4">
          {/* Create Tree */}
          <section className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-2.5">
            <div className="text-xs font-bold text-zinc-100">Nova Árvore / Hierarquia</div>
            <input
              type="text"
              value={newTreeName}
              onChange={(e) => setNewTreeName(e.target.value)}
              placeholder="Ex.: Família Alencastro ou Célula Delta"
              className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500 outline-none"
            />
            <div className="flex items-center gap-2">
              <select
                value={newTreeKind}
                onChange={(e) => setNewTreeKind(e.target.value as 'family' | 'faction')}
                className="flex-1 px-2.5 py-1.5 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 focus:border-cyan-500 outline-none"
              >
                <option value="family">Genealogia Familiar</option>
                <option value="faction">Hierarquia Operacional</option>
              </select>
              <button
                type="button"
                onClick={handleCreateTree}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Criar</span>
              </button>
            </div>
          </section>

          {activeTree && (
            <>
              {/* Add Member */}
              <section className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-2.5">
                <div className="text-xs font-bold text-zinc-100">
                  Adicionar Membro em {activeTree.name}
                </div>
                <input
                  type="text"
                  value={memName}
                  onChange={(e) => setMemName(e.target.value)}
                  placeholder="Nome do integrante..."
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500 outline-none"
                />
                <input
                  type="text"
                  value={memRole}
                  onChange={(e) => setMemRole(e.target.value)}
                  placeholder="Cargo / Papel (ex.: Líder, Investigador, Médico)..."
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500 outline-none"
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-0.5">
                      Escalão / Nível
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={memGen}
                      onChange={(e) => setMemGen(Number(e.target.value))}
                      className="w-full px-2.5 py-1 text-xs font-mono rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-0.5">Condição</label>
                    <select
                      value={memStatus}
                      onChange={(e) => setMemStatus(e.target.value as MemberStatus)}
                      className="w-full px-2 py-1 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200"
                    >
                      <option value="alive">Ativo / Vivo</option>
                      <option value="deceased">Falecido</option>
                      <option value="missing">Desaparecido</option>
                      <option value="unknown">Incógnito</option>
                    </select>
                  </div>
                </div>

                <select
                  value={memLinkKey}
                  onChange={(e) => setMemLinkKey(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200"
                >
                  <option value="">Vincular Ficha ou Registro Wiki (opcional)...</option>
                  <optgroup label="Fichas Omniscient Sheet">
                    {Object.values(characters).map((ch) => (
                      <option key={ch.id} value={`char:${ch.id}`}>
                        {ch.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Registros do Atlas">
                    {Object.values(entities).map((en) => (
                      <option key={en.id} value={`ent:${en.id}`}>
                        {en.title}
                      </option>
                    ))}
                  </optgroup>
                </select>

                <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={memHidden}
                    onChange={(e) => setMemHidden(e.target.checked)}
                    className="rounded bg-zinc-950 border-zinc-800 text-cyan-500"
                  />
                  <span>Ocultar identidade como &ldquo;???&rdquo; para jogadores</span>
                </label>

                <button
                  type="button"
                  onClick={handleAddMember}
                  className="w-full py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs cursor-pointer transition-colors"
                >
                  Inserir Membro
                </button>
              </section>

              {/* Add Bond */}
              <section className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-100">
                  <Link2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Conectar Relação / Comando</span>
                </div>
                <select
                  value={bondFrom}
                  onChange={(e) => setBondFrom(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200"
                >
                  <option value="">Origem (Ascendente / Líder)...</option>
                  {activeTree.members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <select
                  value={bondTo}
                  onChange={(e) => setBondTo(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200"
                >
                  <option value="">Destino (Descendente / Subordinado)...</option>
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
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200"
                >
                  <option value="parent">Filiação / Vínculo</option>
                  <option value="marriage">União / Aliança</option>
                  <option value="command">Comando Hierárquico</option>
                </select>
                <button
                  type="button"
                  onClick={handleAddBond}
                  className="w-full py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-cyan-500/40 text-xs font-semibold text-zinc-200 hover:text-white cursor-pointer transition-colors"
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
