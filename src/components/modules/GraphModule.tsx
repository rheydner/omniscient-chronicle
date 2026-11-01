'use client';

import React, { useCallback, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  type Edge,
  type Node,
  type NodeChange,
  type NodeProps,
} from '@xyflow/react';
import {
  AlertCircle,
  BookOpen,
  Eye,
  EyeOff,
  ExternalLink,
  GitCompareArrows,
  Network,
  Plus,
  Route,
  StickyNote,
  Trash2,
  User,
} from 'lucide-react';
import { useChronicleStore, useEffectiveGM } from '@/store/useChronicleStore';
import { deleteClue, deleteEdge, saveClue, saveEdge } from '@/lib/chronicle-actions';
import { extractMentions } from '@/lib/markdown-engine';
import type { ChronicleEdge, DetectiveClueNode, RelationKind } from '@/types/chronicle';

type ChronicleGraphNodeData = {
  kind: 'entity' | 'character' | 'clue';
  rawId: string;
  label: string;
  subtitle: string;
  tone?: 'brass' | 'crimson' | 'slate' | 'paper';
  isHighlighted: boolean;
  isSecretGM?: boolean;
  onOpen?: () => void;
  onDeleteClue?: () => void;
  [key: string]: unknown;
};

type ChronicleFlowNode = Node<ChronicleGraphNodeData, 'chronicleNode'>;

const RELATION_COLORS: Record<RelationKind, string> = {
  ally: '#06b6d4',
  enemy: '#ef4444',
  blood: '#06b6d4',
  marriage: '#22d3ee',
  faction: '#a1a1aa',
  suspect: '#ef4444',
  location: '#6f8ab8',
  theory: '#e06c6c',
};

const RELATION_LABELS: Record<RelationKind, string> = {
  ally: 'Aliado / Vínculo',
  enemy: 'Inimigo / Conflito',
  blood: 'Sangue / Linhagem',
  marriage: 'Aliança / União',
  faction: 'Membro de Facção',
  suspect: 'Suspeito / Investigado',
  location: 'Presença / Local',
  theory: 'Teoria da Mesa',
};

function ChronicleCustomNode({ data }: NodeProps<ChronicleFlowNode>) {
  const isClue = data.kind === 'clue';
  const isChar = data.kind === 'character';

  const clueToneClasses =
    data.tone === 'paper'
      ? 'bg-[#f3ead6] text-[#221b13] border-[#cbb894]'
      : data.tone === 'crimson'
      ? 'bg-[#231215] text-zinc-100 border-[#c94a4a]/60'
      : data.tone === 'brass'
      ? 'bg-[#211b11] text-zinc-100 border-cyan-500/60'
      : 'bg-zinc-900 text-zinc-100 border-zinc-700';

  return (
    <div
      className={`w-56 rounded-xl border p-3 shadow-lg ${
        isClue
          ? clueToneClasses
          : data.isHighlighted
          ? 'bg-zinc-800 border-cyan-500 text-zinc-100 ring-2 ring-cyan-500/40'
          : isChar
          ? 'bg-zinc-900 border-cyan-500/50 text-zinc-100'
          : 'bg-zinc-900 border-zinc-800 text-zinc-100'
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2 !h-2 !bg-cyan-600 !border-0"
      />
      <div className="flex items-center justify-between gap-1.5 mb-1">
        <span
          className={`text-[10px] font-mono uppercase flex items-center gap-1 ${
            data.tone === 'paper'
              ? 'text-[#6e5227]'
              : isChar
              ? 'text-cyan-400'
              : isClue
              ? 'text-red-300'
              : 'text-cyan-400'
          }`}
        >
          {isChar ? (
            <>
              <User className="w-3 h-3" />
              <span>Ficha Live</span>
            </>
          ) : isClue ? (
            <>
              <StickyNote className="w-3 h-3" />
              <span>Pista / Teoria</span>
            </>
          ) : (
            <>
              <BookOpen className="w-3 h-3" />
              <span>Atlas</span>
            </>
          )}
        </span>

        <div className="flex items-center gap-1">
          {data.isSecretGM && (
            <span className="text-[9px] font-mono px-1 rounded bg-[#c94a4a]/20 text-red-300">
              GM
            </span>
          )}
          {data.onOpen && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                data.onOpen?.();
              }}
              className="p-0.5 rounded hover:bg-black/20 cursor-pointer"
              title="Abrir Registro"
            >
              <ExternalLink className="w-3 h-3" />
            </button>
          )}
          {data.onDeleteClue && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                data.onDeleteClue?.();
              }}
              className="p-0.5 rounded hover:text-red-400 cursor-pointer"
              title="Remover Pista"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      <div className="text-xs font-bold leading-snug">{data.label}</div>
      {data.subtitle && (
        <div
          className={`text-[11px] mt-1 line-clamp-3 leading-relaxed ${
            data.tone === 'paper' ? 'text-[#4a3b28]' : 'text-zinc-400'
          }`}
        >
          {data.subtitle}
        </div>
      )}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2 !h-2 !bg-cyan-600 !border-0"
      />
    </div>
  );
}

const NODE_TYPES = {
  chronicleNode: ChronicleCustomNode,
};

export function GraphModule() {
  const isGM = useEffectiveGM();
  const roomId = useChronicleStore((s) => s.roomId);
  const userDisplayName = useChronicleStore((s) => s.userDisplayName);
  const entities = useChronicleStore((s) => s.entities);
  const characters = useChronicleStore((s) => s.characters);
  const edgesMap = useChronicleStore((s) => s.edges);
  const cluesMap = useChronicleStore((s) => s.clues);

  const navigateToEntity = useChronicleStore((s) => s.navigateToEntity);
  const openFloatingSheet = useChronicleStore((s) => s.openFloatingSheet);
  const showToast = useChronicleStore((s) => s.showToast);

  const [boardMode, setBoardMode] = useState<'canonical' | 'detective'>('canonical');
  const [localOffsets, setLocalOffsets] = useState<Record<string, { x: number; y: number }>>({});

  // Manual edge form
  const [sourceNodeKey, setSourceNodeKey] = useState('');
  const [targetNodeKey, setTargetNodeKey] = useState('');
  const [edgeKind, setEdgeKind] = useState<RelationKind>('ally');
  const [edgeLabel, setEdgeLabel] = useState('');
  const [edgeSecretGM, setEdgeSecretGM] = useState(false);

  // Shortest Path BFS
  const [pathStartKey, setPathStartKey] = useState('');
  const [pathEndKey, setPathEndKey] = useState('');

  // Detective Clue form
  const [clueTitle, setClueTitle] = useState('');
  const [clueBody, setClueBody] = useState('');
  const [clueTone, setClueTone] = useState<'brass' | 'crimson' | 'slate' | 'paper'>('paper');
  const [clueSecretGM, setClueSecretGM] = useState(false);

  const visibleEntities = useMemo(
    () => Object.values(entities).filter((e) => isGM || e.isPublicToPlayers),
    [entities, isGM]
  );

  const visibleClues = useMemo(
    () =>
      boardMode === 'detective'
        ? Object.values(cluesMap).filter((c) => isGM || !c.isSecretGM)
        : [],
    [boardMode, cluesMap, isGM]
  );

  // Build unified catalog of addressable nodes (`entity:id`, `character:id`, `clue:id`)
  const nodeCatalog = useMemo(() => {
    const items: Array<{
      key: string;
      kind: 'entity' | 'character' | 'clue';
      rawId: string;
      label: string;
      subtitle: string;
      tone?: 'brass' | 'crimson' | 'slate' | 'paper';
      isSecretGM?: boolean;
      defaultPos: { x: number; y: number };
    }> = [];

    const charList = Object.values(characters);
    charList.forEach((ch, idx) => {
      items.push({
        key: `character:${ch.id}`,
        kind: 'character',
        rawId: ch.id,
        label: ch.name,
        subtitle: `${ch.className || 'Operador'} · Nv. ${ch.level}`,
        defaultPos: { x: 80, y: 90 + idx * 145 },
      });
    });

    visibleEntities.forEach((ent, idx) => {
      const col = idx % 3;
      const row = Math.floor(idx / 3);
      items.push({
        key: `entity:${ent.id}`,
        kind: 'entity',
        rawId: ent.id,
        label: ent.title,
        subtitle: ent.subtitle || ent.category,
        isSecretGM: !ent.isPublicToPlayers,
        defaultPos: { x: 410 + col * 300, y: 80 + row * 165 },
      });
    });

    visibleClues.forEach((cl) => {
      items.push({
        key: `clue:${cl.id}`,
        kind: 'clue',
        rawId: cl.id,
        label: cl.title,
        subtitle: `${cl.body}${cl.authorName ? ` (${cl.authorName})` : ''}`,
        tone: cl.tone,
        isSecretGM: cl.isSecretGM,
        defaultPos: { x: cl.x, y: cl.y },
      });
    });

    return items;
  }, [characters, visibleEntities, visibleClues]);

  const validKeys = useMemo(() => new Set(nodeCatalog.map((n) => n.key)), [nodeCatalog]);

  // Combine Auto-@Mention edges + Stored Manual/Theory edges
  const combinedEdges = useMemo(() => {
    const list: Array<{
      id: string;
      source: string;
      target: string;
      label: string;
      color: string;
      dashed: boolean;
      manualEdge?: ChronicleEdge;
    }> = [];

    // 1. Automatic @Mentions inside visible Wiki pages
    visibleEntities.forEach((ent) => {
      const srcKey = `entity:${ent.id}`;
      const mentions = extractMentions(ent.content);
      mentions.forEach((m) => {
        const tgtKey = `${m.targetType}:${m.targetId}`;
        if (srcKey !== tgtKey && validKeys.has(tgtKey)) {
          list.push({
            id: `auto-${srcKey}->${tgtKey}`,
            source: srcKey,
            target: tgtKey,
            label: 'Menção (@)',
            color: '#4b5568',
            dashed: false,
          });
        }
      });
    });

    // 2. Stored ChronicleEdges
    Object.values(edgesMap).forEach((ed) => {
      if (ed.isSecretGM && !isGM) return;
      if (ed.isPlayerTheory && boardMode !== 'detective') return;
      const srcKey = `${ed.sourceType}:${ed.sourceId}`;
      const tgtKey = `${ed.targetType}:${ed.targetId}`;
      if (!validKeys.has(srcKey) || !validKeys.has(tgtKey)) return;
      list.push({
        id: ed.id,
        source: srcKey,
        target: tgtKey,
        label: ed.isSecretGM ? `[GM] ${ed.label}` : ed.label,
        color: RELATION_COLORS[ed.kind] || '#06b6d4',
        dashed: ed.isSecretGM || ed.isPlayerTheory,
        manualEdge: ed,
      });
    });

    return list;
  }, [visibleEntities, edgesMap, isGM, boardMode, validKeys]);

  // BFS Shortest Path Finder
  const bfsPathResult = useMemo(() => {
    if (!pathStartKey || !pathEndKey || pathStartKey === pathEndKey) return null;
    if (!validKeys.has(pathStartKey) || !validKeys.has(pathEndKey)) return null;

    const adj = new Map<string, Array<{ neighbor: string; edgeId: string }>>();
    combinedEdges.forEach((e) => {
      if (!adj.has(e.source)) adj.set(e.source, []);
      if (!adj.has(e.target)) adj.set(e.target, []);
      adj.get(e.source)!.push({ neighbor: e.target, edgeId: e.id });
      adj.get(e.target)!.push({ neighbor: e.source, edgeId: e.id });
    });

    const queue: string[] = [pathStartKey];
    const visited = new Set<string>([pathStartKey]);
    const parent = new Map<string, { prev: string; edgeId: string }>();

    while (queue.length > 0) {
      const curr = queue.shift()!;
      if (curr === pathEndKey) {
        const pathNodes: string[] = [curr];
        const pathEdges = new Set<string>();
        let step = curr;
        while (parent.has(step)) {
          const p = parent.get(step)!;
          pathEdges.add(p.edgeId);
          pathNodes.unshift(p.prev);
          step = p.prev;
        }
        return {
          found: true,
          nodeSet: new Set(pathNodes),
          edgeSet: pathEdges,
          orderedNodes: pathNodes,
        };
      }
      for (const next of adj.get(curr) || []) {
        if (!visited.has(next.neighbor)) {
          visited.add(next.neighbor);
          parent.set(next.neighbor, { prev: curr, edgeId: next.edgeId });
          queue.push(next.neighbor);
        }
      }
    }

    return { found: false, nodeSet: new Set<string>(), edgeSet: new Set<string>(), orderedNodes: [] };
  }, [pathStartKey, pathEndKey, combinedEdges, validKeys]);

  // Orphan Wiki Entities Detector (0 incoming and 0 outgoing connections)
  const orphanEntities = useMemo(() => {
    const connected = new Set<string>();
    combinedEdges.forEach((e) => {
      connected.add(e.source);
      connected.add(e.target);
    });
    return visibleEntities.filter((ent) => !connected.has(`entity:${ent.id}`));
  }, [visibleEntities, combinedEdges]);

  const flowNodes = useMemo<ChronicleFlowNode[]>(() => {
    return nodeCatalog.map((item) => {
      const pos = localOffsets[item.key] || item.defaultPos;
      const isHighlighted = Boolean(bfsPathResult?.nodeSet.has(item.key));

      return {
        id: item.key,
        type: 'chronicleNode',
        position: pos,
        data: {
          kind: item.kind,
          rawId: item.rawId,
          label: item.label,
          subtitle: item.subtitle,
          tone: item.tone,
          isHighlighted,
          isSecretGM: item.isSecretGM,
          onOpen:
            item.kind === 'entity'
              ? () => navigateToEntity(item.rawId)
              : item.kind === 'character'
              ? () => openFloatingSheet(item.rawId)
              : undefined,
          onDeleteClue:
            item.kind === 'clue'
              ? () => {
                  void deleteClue(roomId, item.rawId);
                }
              : undefined,
        },
      };
    });
  }, [nodeCatalog, localOffsets, bfsPathResult, navigateToEntity, openFloatingSheet, roomId]);

  const flowEdges = useMemo<Edge[]>(() => {
    return combinedEdges.map((e) => {
      const inBfs = Boolean(bfsPathResult?.edgeSet.has(e.id));
      const stroke = inBfs ? '#06b6d4' : e.color;
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label,
        animated: inBfs,
        style: {
          stroke,
          strokeWidth: inBfs ? 3 : 1.7,
          strokeDasharray: e.dashed ? '6 4' : undefined,
        },
        labelStyle: {
          fill: '#f4f4f5',
          fontSize: 10,
          fontFamily: 'var(--font-jetbrains), monospace',
        },
        labelBgStyle: {
          fill: '#09090b',
          fillOpacity: 0.9,
        },
        labelBgPadding: [5, 3],
        labelBgBorderRadius: 4,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: stroke,
        },
      };
    });
  }, [combinedEdges, bfsPathResult]);

  const handleNodesChange = useCallback(
    (changes: NodeChange<ChronicleFlowNode>[]) => {
      changes.forEach((ch) => {
        if (ch.type === 'position' && ch.position) {
          const nextPos = ch.position;
          setLocalOffsets((prev) => ({ ...prev, [ch.id]: nextPos }));
          // Persist Detective Clue position when drag finishes
          if (ch.dragging === false && ch.id.startsWith('clue:')) {
            const clueId = ch.id.slice(5);
            const existing = cluesMap[clueId];
            if (existing) {
              void saveClue(roomId, {
                ...existing,
                x: Math.round(nextPos.x),
                y: Math.round(nextPos.y),
              });
            }
          }
        }
      });
    },
    [cluesMap, roomId]
  );

  const handleCreateManualEdge = async () => {
    if (!sourceNodeKey || !targetNodeKey || sourceNodeKey === targetNodeKey) {
      showToast('Escolha dois nós distintos para criar o vínculo.');
      return;
    }
    const [sType, sId] = sourceNodeKey.split(':') as ['entity' | 'character' | 'clue', string];
    const [tType, tId] = targetNodeKey.split(':') as ['entity' | 'character' | 'clue', string];
    const isTheory = !isGM || boardMode === 'detective';

    const newEdge: ChronicleEdge = {
      id: `ed_${crypto.randomUUID().slice(0, 8)}`,
      sourceId: sId,
      sourceType: sType,
      targetId: tId,
      targetType: tType,
      kind: isTheory && !isGM ? 'theory' : edgeKind,
      label: edgeLabel.trim() || RELATION_LABELS[edgeKind],
      isSecretGM: isGM ? edgeSecretGM : false,
      isPlayerTheory: !isGM,
      authorName: userDisplayName || 'Mesa',
      createdAt: Date.now(),
    };

    await saveEdge(roomId, newEdge);
    setEdgeLabel('');
    showToast('Conexão adicionada ao grafo em tempo real.');
  };

  const handleCreateClue = async () => {
    if (!clueTitle.trim()) return;
    const count = Object.keys(cluesMap).length;
    const nextClue: DetectiveClueNode = {
      id: `clue_${crypto.randomUUID().slice(0, 8)}`,
      title: clueTitle.trim(),
      body: clueBody.trim() || 'Hipótese levantada durante a sessão.',
      tone: clueTone,
      x: 340 + (count % 4) * 240,
      y: 260 + Math.floor(count / 4) * 160,
      isSecretGM: isGM ? clueSecretGM : false,
      authorName: userDisplayName || 'Investigador',
      createdAt: Date.now(),
    };
    await saveClue(roomId, nextClue);
    setClueTitle('');
    setClueBody('');
    showToast('Nota adicionada ao Quadro de Detetive.');
  };

  const labelByKey = useMemo(() => {
    const m = new Map<string, string>();
    nodeCatalog.forEach((n) => m.set(n.key, n.label));
    return m;
  }, [nodeCatalog]);

  return (
    <div className="flex flex-col lg:flex-row h-full min-h-0 bg-zinc-950">
      {/* Interactive Canvas */}
      <div className="flex-1 relative min-h-[440px]">
        {/* Top Mode Bar */}
        <div className="absolute top-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
          <div className="pointer-events-auto inline-flex items-center p-1 rounded-xl bg-zinc-950/95 border border-zinc-800">
            <button
              type="button"
              onClick={() => setBoardMode('canonical')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                boardMode === 'canonical'
                  ? 'bg-zinc-800 text-cyan-400 border border-zinc-700'
                  : 'text-zinc-400 hover:text-zinc-100'
              }`}
            >
              <Network className="w-3.5 h-3.5" />
              <span>Grafo Canônico (@Menções)</span>
            </button>
            <button
              type="button"
              onClick={() => setBoardMode('detective')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                boardMode === 'detective'
                  ? 'bg-zinc-800 text-red-300 border border-zinc-700'
                  : 'text-zinc-400 hover:text-zinc-100'
              }`}
            >
              <StickyNote className="w-3.5 h-3.5" />
              <span>Quadro de Detetive Colaborativo</span>
            </button>
          </div>

          <div className="pointer-events-auto px-3 py-1.5 rounded-xl bg-zinc-950/95 border border-zinc-800 text-xs font-mono text-zinc-400">
            {flowNodes.length} nós · {flowEdges.length} conexões
          </div>
        </div>

        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={NODE_TYPES}
          onNodesChange={handleNodesChange}
          fitView
          minZoom={0.25}
          maxZoom={1.8}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#27272a" gap={26} size={1} />
          <Controls />
        </ReactFlow>
      </div>

      {/* Right Analytical & Authoring Sidebar */}
      <aside className="w-full lg:w-88 shrink-0 border-t lg:border-t-0 lg:border-l border-zinc-800 bg-zinc-950 overflow-y-auto custom-scrollbar p-4 space-y-5">
        {/* Detective Mode Clue Creator (Open to Players & GM) */}
        {boardMode === 'detective' && (
          <section className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-100">
              <StickyNote className="w-4 h-4 text-cyan-400" />
              <span>Fixar Nova Pista / Post-it na Mesa</span>
            </div>
            <input
              type="text"
              value={clueTitle}
              onChange={(e) => setClueTitle(e.target.value)}
              placeholder="Título da pista ou suspeita..."
              className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
            />
            <textarea
              rows={2}
              value={clueBody}
              onChange={(e) => setClueBody(e.target.value)}
              placeholder="Anotação investigativa..."
              className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
            />
            <div className="flex items-center justify-between gap-2">
              <select
                value={clueTone}
                onChange={(e) =>
                  setClueTone(e.target.value as 'brass' | 'crimson' | 'slate' | 'paper')
                }
                className="px-2 py-1 text-xs rounded bg-zinc-950 border border-zinc-800 text-zinc-100"
              >
                <option value="paper">Papel Sépia</option>
                <option value="crimson">Fio Carmim</option>
                <option value="brass">Âmbar / Ouro</option>
                <option value="slate">Ardósia</option>
              </select>
              {isGM && (
                <label className="flex items-center gap-1 text-xs text-zinc-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={clueSecretGM}
                    onChange={(e) => setClueSecretGM(e.target.checked)}
                  />
                  <span>Só GM</span>
                </label>
              )}
              <button
                type="button"
                onClick={handleCreateClue}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-600 text-[#0b0d10] font-semibold text-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Fixar</span>
              </button>
            </div>
          </section>
        )}

        {/* Shortest Path BFS */}
        <section className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-100">
            <Route className="w-4 h-4 text-cyan-400" />
            <span>Busca de Menor Caminho (BFS)</span>
          </div>
          <div className="grid grid-cols-1 gap-2">
            <select
              value={pathStartKey}
              onChange={(e) => setPathStartKey(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
            >
              <option value="">Origem...</option>
              {nodeCatalog.map((n) => (
                <option key={n.key} value={n.key}>
                  {n.label}
                </option>
              ))}
            </select>
            <select
              value={pathEndKey}
              onChange={(e) => setPathEndKey(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
            >
              <option value="">Destino...</option>
              {nodeCatalog.map((n) => (
                <option key={n.key} value={n.key}>
                  {n.label}
                </option>
              ))}
            </select>
          </div>
          {bfsPathResult && (
            <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs">
              {bfsPathResult.found ? (
                <div className="space-y-1">
                  <div className="font-mono text-cyan-400">
                    {bfsPathResult.orderedNodes.length - 1} grau(s) de separação:
                  </div>
                  <div className="text-zinc-100 leading-relaxed">
                    {bfsPathResult.orderedNodes
                      .map((k) => labelByKey.get(k) || k)
                      .join(' → ')}
                  </div>
                </div>
              ) : (
                <span className="text-red-400">
                  Nenhum caminho conhecido conecta estes dois pontos.
                </span>
              )}
            </div>
          )}
        </section>

        {/* Add Connection / Theory */}
        {(isGM || boardMode === 'detective') && (
          <section className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-100">
              <GitCompareArrows className="w-4 h-4 text-cyan-400" />
              <span>{isGM ? 'Traçar Vínculo ou Segredo' : 'Traçar Fio de Teoria'}</span>
            </div>
            <select
              value={sourceNodeKey}
              onChange={(e) => setSourceNodeKey(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
            >
              <option value="">Nó A (Origem)...</option>
              {nodeCatalog.map((n) => (
                <option key={n.key} value={n.key}>
                  {n.label}
                </option>
              ))}
            </select>
            <select
              value={targetNodeKey}
              onChange={(e) => setTargetNodeKey(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
            >
              <option value="">Nó B (Alvo)...</option>
              {nodeCatalog.map((n) => (
                <option key={n.key} value={n.key}>
                  {n.label}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={edgeKind}
                onChange={(e) => setEdgeKind(e.target.value as RelationKind)}
                className="px-2 py-1.5 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
              >
                {(Object.keys(RELATION_LABELS) as RelationKind[]).map((rk) => (
                  <option key={rk} value={rk}>
                    {RELATION_LABELS[rk]}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={edgeLabel}
                onChange={(e) => setEdgeLabel(e.target.value)}
                placeholder="Rótulo (opcional)"
                className="px-2.5 py-1.5 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
              />
            </div>
            {isGM && (
              <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={edgeSecretGM}
                  onChange={(e) => setEdgeSecretGM(e.target.checked)}
                />
                <span>Conexão Secreta do Mestre (Invisível aos jogadores)</span>
              </label>
            )}
            <button
              type="button"
              onClick={handleCreateManualEdge}
              className="w-full py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-[#0b0d10] font-semibold text-xs transition-colors cursor-pointer"
            >
              Conectar Nós
            </button>
          </section>
        )}

        {/* Active Manual & Secret Connections List */}
        {Object.keys(edgesMap).length > 0 && (
          <section className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2">
            <div className="text-xs font-bold text-zinc-100">Vínculos Manuais & Segredos</div>
            <div className="space-y-1.5 max-h-44 overflow-y-auto custom-scrollbar">
              {Object.values(edgesMap)
                .filter((ed) => isGM || !ed.isSecretGM)
                .map((ed) => {
                  const sLabel = labelByKey.get(`${ed.sourceType}:${ed.sourceId}`) || ed.sourceId;
                  const tLabel = labelByKey.get(`${ed.targetType}:${ed.targetId}`) || ed.targetId;
                  return (
                    <div
                      key={ed.id}
                      className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded bg-zinc-950 border border-zinc-800 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-zinc-100 truncate">
                          {sLabel} → {tLabel}
                        </div>
                        <div className="text-[11px] font-mono text-zinc-400 truncate">
                          {ed.label}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {isGM && (
                          <button
                            type="button"
                            onClick={() =>
                              saveEdge(roomId, { ...ed, isSecretGM: !ed.isSecretGM })
                            }
                            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 cursor-pointer"
                            title={
                              ed.isSecretGM
                                ? 'Secreta (Clique para revelar aos jogadores)'
                                : 'Pública (Clique para ocultar)'
                            }
                          >
                            {ed.isSecretGM ? (
                              <EyeOff className="w-3.5 h-3.5 text-red-400" />
                            ) : (
                              <Eye className="w-3.5 h-3.5 text-cyan-400" />
                            )}
                          </button>
                        )}
                        {(isGM || ed.isPlayerTheory) && (
                          <button
                            type="button"
                            onClick={() => deleteEdge(roomId, ed.id)}
                            className="p-1 rounded hover:text-red-400 text-zinc-500 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </section>
        )}

        {/* Orphan Detector */}
        <section className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-bold text-zinc-100">
              <AlertCircle className="w-4 h-4 text-cyan-400" />
              <span>Detector de Páginas Órfãs</span>
            </span>
            <span className="text-xs font-mono text-zinc-400">{orphanEntities.length}</span>
          </div>
          {orphanEntities.length === 0 ? (
            <p className="text-xs text-zinc-500">
              Todas as páginas visíveis do Atlas estão conectadas à teia.
            </p>
          ) : (
            <div className="space-y-1">
              {orphanEntities.map((ent) => (
                <button
                  key={ent.id}
                  type="button"
                  onClick={() => navigateToEntity(ent.id)}
                  className="w-full text-left px-2.5 py-1.5 rounded bg-zinc-950 border border-zinc-800 hover:border-cyan-500 text-xs text-zinc-100 truncate cursor-pointer"
                >
                  {ent.title}
                </button>
              ))}
            </div>
          )}
        </section>
      </aside>
    </div>
  );
}
