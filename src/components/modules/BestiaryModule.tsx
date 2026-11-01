'use client';

import React, { useMemo, useState } from 'react';
import {
  Edit3,
  Eye,
  EyeOff,
  ImagePlus,
  Lock,
  Plus,
  Save,
  Send,
  Shield,
  Skull,
  Swords,
  Trash2,
  Zap,
} from 'lucide-react';
import { useChronicleStore, useEffectiveGM } from '@/store/useChronicleStore';
import {
  deleteCreature,
  saveCreature,
  spawnCreatureToVTTScene,
} from '@/lib/chronicle-actions';
import { uploadChronicleAsset } from '@/lib/storage';
import { RichChronicleRenderer } from '@/components/shared/RichChronicleRenderer';
import { RichChronicleEditor } from '@/components/shared/RichChronicleEditor';
import type { BestiaryCreature, CreatureAttackEntry } from '@/types/chronicle';

export function BestiaryModule() {
  const isGM = useEffectiveGM();
  const roomId = useChronicleStore((s) => s.roomId);
  const creatures = useChronicleStore((s) => s.creatures);
  const vttScenes = useChronicleStore((s) => s.vttScenes);
  const activeVttSceneId = useChronicleStore((s) => s.activeVttSceneId);
  const selectedCreatureId = useChronicleStore((s) => s.selectedCreatureId);
  const setSelectedCreatureId = useChronicleStore((s) => s.setSelectedCreatureId);
  const showToast = useChronicleStore((s) => s.showToast);

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<BestiaryCreature | null>(null);
  const [isUploadingToken, setIsUploadingToken] = useState(false);

  // VTT Spawn Controls
  const [targetSceneId, setTargetSceneId] = useState('');
  const [spawnCount, setSpawnCount] = useState(1);
  const [spawnLayer, setSpawnLayer] = useState<'token' | 'gm'>('token');
  const [isSpawning, setIsSpawning] = useState(false);

  const visibleCreatures = useMemo(
    () =>
      Object.values(creatures)
        .filter((c) => isGM || c.isKnownByPlayers)
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [creatures, isGM]
  );

  const activeCreature = useMemo(() => {
    if (selectedCreatureId && creatures[selectedCreatureId]) {
      const c = creatures[selectedCreatureId];
      if (isGM || c.isKnownByPlayers) return c;
    }
    return visibleCreatures[0] || null;
  }, [selectedCreatureId, creatures, isGM, visibleCreatures]);

  const resolvedSceneId =
    targetSceneId || activeVttSceneId || vttScenes[0]?.id || '';

  const handleCreateCreature = async () => {
    const cr: BestiaryCreature = {
      id: `cr_${crypto.randomUUID().slice(0, 8)}`,
      name: 'Nova Ameaça / Criatura',
      title: 'Subtítulo ou alcunha',
      threatGrade: 'Grau 2',
      creatureType: 'Anomalia',
      imageUrl: null,
      tokenUrl: null,
      hpMax: 120,
      energyMax: 40,
      defense: 20,
      initiative: 8,
      speed: '9m',
      sizeCells: 1,
      attacks: [
        {
          id: `atk_${Date.now()}`,
          name: 'Golpe Brutal',
          bonus: '+10',
          damage: '2d8 + 6',
        },
      ],
      traits: 'Visão no Escuro',
      lore: 'Registros de avistamento e fraquezas ocultas com Tarjas Pretas...',
      unlockedRedactions: [],
      isKnownByPlayers: false,
      showStatsToPlayers: false,
      updatedAt: Date.now(),
    };
    await saveCreature(roomId, cr);
    setSelectedCreatureId(cr.id);
    setDraft(cr);
    setIsEditing(true);
    showToast('Ficha de ameaça criada no Bestiário.');
  };

  const handleUploadToken = async (file: File) => {
    if (!draft) return;
    setIsUploadingToken(true);
    const url = await uploadChronicleAsset(roomId, 'bestiary', file);
    setIsUploadingToken(false);
    if (!url) {
      showToast('Erro no upload do token para Supabase vtt-assets.');
      return;
    }
    setDraft({ ...draft, tokenUrl: url, imageUrl: draft.imageUrl || url });
    showToast('Token salvo no Supabase Storage!');
  };

  const handleSpawnInVTT = async () => {
    if (!activeCreature || !resolvedSceneId) {
      showToast('Selecione uma cena válida do StarStream VTT.');
      return;
    }
    setIsSpawning(true);
    try {
      const count = await spawnCreatureToVTTScene(resolvedSceneId, activeCreature, {
        count: spawnCount,
        layer: spawnLayer,
      });
      const sceneName =
        vttScenes.find((s) => s.id === resolvedSceneId)?.name || 'Cena VTT';
      showToast(`${count}x "${activeCreature.name}" instanciado(s) em "${sceneName}"!`);
    } catch (err) {
      console.error(err);
      showToast('Falha ao instanciar token na cena do VTT.');
    } finally {
      setIsSpawning(false);
    }
  };

  const handleToggleLoreRedaction = async (redactionId: string) => {
    if (!activeCreature) return;
    const set = new Set(activeCreature.unlockedRedactions || []);
    if (set.has(redactionId)) set.delete(redactionId);
    else set.add(redactionId);
    await saveCreature(roomId, {
      ...activeCreature,
      unlockedRedactions: Array.from(set),
    });
  };

  return (
    <div className="flex flex-col lg:flex-row h-full min-h-0 bg-[#0b0d10]">
      {/* Left Bestiary Catalog */}
      <aside className="w-full lg:w-80 shrink-0 border-b lg:border-b-0 lg:border-r border-[#222834] bg-[#0e1116] flex flex-col max-h-[36vh] lg:max-h-none">
        <div className="p-3.5 border-b border-[#222834] flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-[#ece8df]">Bestiário & Ameaças</h2>
            <p className="text-xs text-[#a5a095]">Conectado às cenas do StarStream VTT</p>
          </div>
          {isGM && (
            <button
              type="button"
              onClick={handleCreateCreature}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#d4a359] hover:bg-[#e2b56e] text-[#0b0d10] font-semibold text-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Ameaça</span>
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
          {visibleCreatures.length === 0 ? (
            <div className="p-5 text-center text-xs text-[#6f6b62]">
              Nenhuma criatura registrada ou liberada para consulta dos jogadores.
            </div>
          ) : (
            visibleCreatures.map((cr) => {
              const selected = activeCreature?.id === cr.id;
              return (
                <button
                  key={cr.id}
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setDraft(null);
                    setSelectedCreatureId(cr.id);
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors cursor-pointer ${
                    selected
                      ? 'bg-[#191e27] border-[#313a4b] text-[#ece8df]'
                      : 'bg-transparent border-transparent hover:bg-[#13171e] text-[#a5a095] hover:text-[#ece8df]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold truncate">{cr.name}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#c94a4a]/15 text-[#e07b7b] shrink-0">
                      {cr.threatGrade}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-1 text-[11px] text-[#6f6b62]">
                    <span className="truncate">{cr.creatureType}</span>
                    {!cr.isKnownByPlayers && (
                      <span className="font-mono text-[#a5a095]">GM</span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Main Statblock & VTT Spawner */}
      <main className="flex-1 overflow-y-auto custom-scrollbar p-5 lg:p-8">
        {!activeCreature && !isEditing ? (
          <div className="max-w-md mx-auto my-16 p-6 rounded-xl bg-[#13171e] border border-[#222834] text-center space-y-3">
            <Skull className="w-8 h-8 text-[#c94a4a] mx-auto" />
            <h3 className="text-base font-bold text-[#ece8df]">Catálogo de Ameaças</h3>
            <p className="text-xs text-[#a5a095]">
              Cadastre monstros, maldições e antagonistas, censure fraquezas com Tarjas Pretas e
              instancie tokens direto no tabuleiro do StarStream VTT.
            </p>
          </div>
        ) : isEditing && draft ? (
          <div className="max-w-4xl mx-auto space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-[#222834]">
              <h2 className="text-lg font-bold text-[#ece8df]">Editando: {draft.name}</h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setDraft(null);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#13171e] border border-[#222834] text-xs text-[#a5a095] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await saveCreature(roomId, draft);
                    setIsEditing(false);
                    setDraft(null);
                    showToast('Criatura salva no Bestiário.');
                  }}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#d4a359] text-[#0b0d10] font-semibold text-xs cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Salvar Criatura</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-[#13171e] border border-[#222834] rounded-xl p-4">
              <div>
                <label className="block text-xs text-[#a5a095] mb-1">Nome</label>
                <input
                  type="text"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-[#0e1116] border border-[#222834] text-[#ece8df]"
                />
              </div>
              <div>
                <label className="block text-xs text-[#a5a095] mb-1">Grau de Ameaça</label>
                <input
                  type="text"
                  value={draft.threatGrade}
                  onChange={(e) => setDraft({ ...draft, threatGrade: e.target.value })}
                  placeholder="Grau 1 / Especial"
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-[#0e1116] border border-[#222834] text-[#ece8df]"
                />
              </div>
              <div>
                <label className="block text-xs text-[#a5a095] mb-1">Tipo / Classificação</label>
                <input
                  type="text"
                  value={draft.creatureType}
                  onChange={(e) => setDraft({ ...draft, creatureType: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-[#0e1116] border border-[#222834] text-[#ece8df]"
                />
              </div>

              <div>
                <label className="block text-xs text-[#a5a095] mb-1">HP Máximo</label>
                <input
                  type="number"
                  value={draft.hpMax}
                  onChange={(e) => setDraft({ ...draft, hpMax: Number(e.target.value) })}
                  className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg bg-[#0e1116] border border-[#222834]"
                />
              </div>
              <div>
                <label className="block text-xs text-[#a5a095] mb-1">Defesa</label>
                <input
                  type="number"
                  value={draft.defense}
                  onChange={(e) => setDraft({ ...draft, defense: Number(e.target.value) })}
                  className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg bg-[#0e1116] border border-[#222834]"
                />
              </div>
              <div>
                <label className="block text-xs text-[#a5a095] mb-1">Tamanho no Grid VTT</label>
                <select
                  value={draft.sizeCells}
                  onChange={(e) =>
                    setDraft({ ...draft, sizeCells: Number(e.target.value) as 1 | 2 | 3 })
                  }
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-[#0e1116] border border-[#222834]"
                >
                  <option value={1}>Médio (1x1 célula)</option>
                  <option value={2}>Grande (2x2 células)</option>
                  <option value={3}>Enorme (3x3 células)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-[#a5a095] mb-1">Deslocamento</label>
                <input
                  type="text"
                  value={draft.speed}
                  onChange={(e) => setDraft({ ...draft, speed: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-[#0e1116] border border-[#222834]"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-[#a5a095] mb-1">
                  Arte do Token / Retrato (Supabase vtt-assets)
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={draft.tokenUrl || ''}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        tokenUrl: e.target.value || null,
                        imageUrl: e.target.value || null,
                      })
                    }
                    placeholder="https://..."
                    className="flex-1 px-2.5 py-1.5 text-xs rounded-lg bg-[#0e1116] border border-[#222834]"
                  />
                  <label className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#191e27] border border-[#313a4b] text-xs cursor-pointer">
                    <ImagePlus className="w-3.5 h-3.5 text-[#d4a359]" />
                    <span>{isUploadingToken ? '...' : 'Upload'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleUploadToken(f);
                      }}
                    />
                  </label>
                </div>
              </div>

              <div className="md:col-span-3">
                <label className="block text-xs text-[#a5a095] mb-1">
                  Resistências, Sentidos & Traços Passivos
                </label>
                <input
                  type="text"
                  value={draft.traits}
                  onChange={(e) => setDraft({ ...draft, traits: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-[#0e1116] border border-[#222834]"
                />
              </div>
            </div>

            {/* Attacks Editor */}
            <div className="p-4 rounded-xl bg-[#13171e] border border-[#222834] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#ece8df]">Ações & Ataques</span>
                <button
                  type="button"
                  onClick={() => {
                    const nextAtk: CreatureAttackEntry = {
                      id: `atk_${Math.random().toString(36).slice(2, 7)}`,
                      name: 'Novo Ataque',
                      bonus: '+12',
                      damage: '2d8 + 5',
                    };
                    setDraft({ ...draft, attacks: [...draft.attacks, nextAtk] });
                  }}
                  className="text-xs text-[#d4a359] hover:underline cursor-pointer"
                >
                  + Adicionar Ataque
                </button>
              </div>
              {draft.attacks.map((atk, idx) => (
                <div key={atk.id} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-center">
                  <input
                    type="text"
                    value={atk.name}
                    onChange={(e) => {
                      const copy = [...draft.attacks];
                      copy[idx] = { ...atk, name: e.target.value };
                      setDraft({ ...draft, attacks: copy });
                    }}
                    placeholder="Nome"
                    className="px-2.5 py-1 text-xs rounded bg-[#0e1116] border border-[#222834]"
                  />
                  <input
                    type="text"
                    value={atk.bonus}
                    onChange={(e) => {
                      const copy = [...draft.attacks];
                      copy[idx] = { ...atk, bonus: e.target.value };
                      setDraft({ ...draft, attacks: copy });
                    }}
                    placeholder="Bônus / DT"
                    className="px-2.5 py-1 text-xs font-mono rounded bg-[#0e1116] border border-[#222834]"
                  />
                  <input
                    type="text"
                    value={atk.damage}
                    onChange={(e) => {
                      const copy = [...draft.attacks];
                      copy[idx] = { ...atk, damage: e.target.value };
                      setDraft({ ...draft, attacks: copy });
                    }}
                    placeholder="Dano / Efeito"
                    className="px-2.5 py-1 text-xs font-mono rounded bg-[#0e1116] border border-[#222834]"
                  />
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={atk.notes || ''}
                      onChange={(e) => {
                        const copy = [...draft.attacks];
                        copy[idx] = { ...atk, notes: e.target.value };
                        setDraft({ ...draft, attacks: copy });
                      }}
                      placeholder="Notas"
                      className="flex-1 px-2.5 py-1 text-xs rounded bg-[#0e1116] border border-[#222834]"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          attacks: draft.attacks.filter((x) => x.id !== atk.id),
                        })
                      }
                      className="text-[#6f6b62] hover:text-[#c94a4a] cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <RichChronicleEditor
              value={draft.lore}
              onChange={(lore) => setDraft({ ...draft, lore })}
              unlockedRedactions={draft.unlockedRedactions}
              minRows={7}
              placeholder="Ecologia, origem e fraquezas censuráveis com Tarjas Pretas..."
            />
          </div>
        ) : (
          activeCreature && (
            <div className="max-w-4xl mx-auto space-y-6">
              {/* Header */}
              <header className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-[#222834]">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl bg-[#13171e] border border-[#313a4b] overflow-hidden flex items-center justify-center shrink-0">
                    {activeCreature.tokenUrl || activeCreature.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={activeCreature.tokenUrl || activeCreature.imageUrl || ''}
                        alt={activeCreature.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Skull className="w-7 h-7 text-[#c94a4a]" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#c94a4a]/20 text-[#e07b7b]">
                        {activeCreature.threatGrade}
                      </span>
                      <span className="text-xs font-mono text-[#a5a095]">
                        {activeCreature.creatureType} · Grid {activeCreature.sizeCells}x
                        {activeCreature.sizeCells}
                      </span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-bold font-editorial text-[#ece8df] mt-1">
                      {activeCreature.name}
                    </h1>
                  </div>
                </div>

                {isGM && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        saveCreature(roomId, {
                          ...activeCreature,
                          isKnownByPlayers: !activeCreature.isKnownByPlayers,
                        })
                      }
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#13171e] border border-[#222834] text-xs text-[#ece8df] cursor-pointer"
                    >
                      {activeCreature.isKnownByPlayers ? (
                        <>
                          <Eye className="w-3.5 h-3.5 text-[#d4a359]" />
                          <span>Visível no Bestiário</span>
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-3.5 h-3.5 text-[#6f6b62]" />
                          <span>Oculto dos Jogadores</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        saveCreature(roomId, {
                          ...activeCreature,
                          showStatsToPlayers: !activeCreature.showStatsToPlayers,
                        })
                      }
                      className="px-2.5 py-1.5 rounded-lg bg-[#13171e] border border-[#222834] text-xs text-[#a5a095] hover:text-[#ece8df] cursor-pointer"
                    >
                      {activeCreature.showStatsToPlayers
                        ? 'Stats Abertos'
                        : 'Stats Sigilosos (GM)'}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setDraft({ ...activeCreature });
                        setIsEditing(true);
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#d4a359] text-[#0b0d10] font-semibold text-xs cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Editar</span>
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        if (!window.confirm(`Excluir "${activeCreature.name}"?`)) return;
                        await deleteCreature(roomId, activeCreature.id);
                        setSelectedCreatureId(null);
                      }}
                      className="p-1.5 rounded-lg bg-[#13171e] border border-[#222834] text-[#6f6b62] hover:text-[#c94a4a] cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </header>

              {/* GM Direct StarStream VTT Token Spawner */}
              {isGM && (
                <section className="p-4 rounded-xl bg-[#13171e] border border-[#4fa3b8]/45 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-mono uppercase text-[#4fa3b8]">
                      Ponte Direta · StarStream VTT
                    </div>
                    <div className="text-xs text-[#ece8df] font-semibold mt-0.5">
                      Instanciar tokens desta ameaça diretamente no tabuleiro ativo
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={resolvedSceneId}
                      onChange={(e) => setTargetSceneId(e.target.value)}
                      className="px-2.5 py-1.5 text-xs rounded-lg bg-[#0e1116] border border-[#313a4b] text-[#ece8df]"
                    >
                      {vttScenes.length === 0 ? (
                        <option value="">Nenhuma cena VTT encontrada</option>
                      ) : (
                        vttScenes.map((sc) => (
                          <option key={sc.id} value={sc.id}>
                            Cena: {sc.name}
                          </option>
                        ))
                      )}
                    </select>
                    <select
                      value={spawnCount}
                      onChange={(e) => setSpawnCount(Number(e.target.value))}
                      className="px-2 py-1.5 text-xs font-mono rounded-lg bg-[#0e1116] border border-[#313a4b] text-[#ece8df]"
                    >
                      {[1, 2, 3, 4, 5, 6].map((n) => (
                        <option key={n} value={n}>
                          {n}x
                        </option>
                      ))}
                    </select>
                    <select
                      value={spawnLayer}
                      onChange={(e) => setSpawnLayer(e.target.value as 'token' | 'gm')}
                      className="px-2.5 py-1.5 text-xs rounded-lg bg-[#0e1116] border border-[#313a4b] text-[#ece8df]"
                    >
                      <option value="token">Visível (Camada Tokens)</option>
                      <option value="gm">Invisível (Camada GM)</option>
                    </select>
                    <button
                      type="button"
                      disabled={isSpawning || !resolvedSceneId}
                      onClick={handleSpawnInVTT}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#4fa3b8] text-[#0b0d10] font-semibold text-xs hover:opacity-90 transition-opacity cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isSpawning ? 'Enviando...' : 'Spawnar no VTT'}</span>
                    </button>
                  </div>
                </section>
              )}

              {/* Combat Statblock (Gated for Players unless showStatsToPlayers) */}
              {isGM || activeCreature.showStatsToPlayers ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-xl bg-[#13171e] border border-[#222834]">
                      <div className="text-[11px] font-mono uppercase text-[#a5a095]">
                        Pontos de Vida
                      </div>
                      <div className="text-lg font-bold text-[#c94a4a] mt-0.5 tabular-nums">
                        {activeCreature.hpMax} HP
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-[#13171e] border border-[#222834]">
                      <div className="text-[11px] font-mono uppercase text-[#a5a095]">Defesa</div>
                      <div className="text-lg font-bold text-[#d4a359] mt-0.5 flex items-center gap-1.5 tabular-nums">
                        <Shield className="w-4 h-4" />
                        <span>{activeCreature.defense}</span>
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-[#13171e] border border-[#222834]">
                      <div className="text-[11px] font-mono uppercase text-[#a5a095]">
                        Energia / PE
                      </div>
                      <div className="text-lg font-bold text-[#4fa3b8] mt-0.5 flex items-center gap-1.5 tabular-nums">
                        <Zap className="w-4 h-4" />
                        <span>{activeCreature.energyMax}</span>
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-[#13171e] border border-[#222834]">
                      <div className="text-[11px] font-mono uppercase text-[#a5a095]">
                        Deslocamento
                      </div>
                      <div className="text-sm font-mono font-bold text-[#ece8df] mt-1">
                        {activeCreature.speed}
                      </div>
                    </div>
                  </div>

                  {activeCreature.traits && (
                    <div className="px-4 py-2.5 rounded-xl bg-[#13171e] border border-[#222834] text-xs">
                      <span className="font-mono uppercase text-[#a5a095] mr-2">Traços:</span>
                      <span className="text-[#ece8df] font-medium">{activeCreature.traits}</span>
                    </div>
                  )}

                  {activeCreature.attacks.length > 0 && (
                    <div className="p-4 rounded-xl bg-[#13171e] border border-[#222834] space-y-2.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[#ece8df]">
                        <Swords className="w-4 h-4 text-[#c94a4a]" />
                        <span>Ações Ofensivas & Habilidades</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {activeCreature.attacks.map((atk) => (
                          <div
                            key={atk.id}
                            className="p-3 rounded-lg bg-[#0e1116] border border-[#222834]"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-[#ece8df]">{atk.name}</span>
                              <span className="text-xs font-mono text-[#d4a359]">{atk.bonus}</span>
                            </div>
                            <div className="text-xs font-mono text-[#c94a4a] mt-1">
                              Dano: {atk.damage}
                            </div>
                            {atk.notes && (
                              <div className="text-[11px] text-[#a5a095] mt-0.5">{atk.notes}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-[#13171e] border border-[#222834] flex items-center gap-2.5 text-xs text-[#a5a095]">
                  <Lock className="w-4 h-4 text-[#c94a4a] shrink-0" />
                  <span>
                    Estatísticas de combate classificadas. Descubra os parâmetros em confronto ou
                    investigação.
                  </span>
                </div>
              )}

              {/* Lore & Censurable Weaknesses */}
              <section className="p-5 rounded-xl bg-[#13171e] border border-[#222834]">
                <div className="text-xs font-mono uppercase text-[#d4a359] mb-2">
                  Relatório Anatômico, Origem & Pontos Fracos
                </div>
                <RichChronicleRenderer
                  content={activeCreature.lore}
                  unlockedRedactions={activeCreature.unlockedRedactions}
                  onToggleRedaction={handleToggleLoreRedaction}
                />
              </section>
            </div>
          )
        )}
      </main>
    </div>
  );
}
