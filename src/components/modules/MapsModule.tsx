'use client';

import React, { useMemo, useRef, useState } from 'react';
import {
  Compass,
  ExternalLink,
  ImagePlus,
  Map as MapIcon,
  MapPin as MapPinIcon,
  Minus,
  Navigation,
  Pentagon,
  Plus,
  Send,
  Trash2,
} from 'lucide-react';
import { useChronicleStore, useEffectiveGM } from '@/store/useChronicleStore';
import {
  deleteRegionalMap,
  moveVTTPlayersToScene,
  saveRegionalMap,
} from '@/lib/chronicle-actions';
import { uploadChronicleAsset } from '@/lib/storage';
import type {
  MapCoord,
  MapPin,
  MapPinKind,
  MapRegion,
  MapRoute,
  RegionalMap,
  TravelMode,
} from '@/types/chronicle';

const TRAVEL_SPEED_KMH: Record<TravelMode, { label: string; kmh: number }> = {
  foot: { label: 'Marcha a Pé (4 km/h)', kmh: 4 },
  mount: { label: 'Montaria (9 km/h)', kmh: 9 },
  ship: { label: 'Embarcação (14 km/h)', kmh: 14 },
  vehicle: { label: 'Veículo Urbano (45 km/h)', kmh: 45 },
};

const PIN_COLORS: Record<MapPinKind, string> = {
  city: '#d4a359',
  dungeon: '#c94a4a',
  landmark: '#4fa3b8',
  danger: '#e05252',
  hq: '#e2b56e',
};

export function MapsModule() {
  const isGM = useEffectiveGM();
  const roomId = useChronicleStore((s) => s.roomId);
  const maps = useChronicleStore((s) => s.maps);
  const entities = useChronicleStore((s) => s.entities);
  const vttScenes = useChronicleStore((s) => s.vttScenes);
  const selectedMapId = useChronicleStore((s) => s.selectedMapId);
  const setSelectedMapId = useChronicleStore((s) => s.setSelectedMapId);
  const navigateToEntity = useChronicleStore((s) => s.navigateToEntity);
  const showToast = useChronicleStore((s) => s.showToast);

  const mapFrameRef = useRef<HTMLDivElement>(null);
  const [imgNatural, setImgNatural] = useState({ width: 1200, height: 800 });

  const [zoom, setZoom] = useState(1);
  const [tool, setTool] = useState<'explore' | 'pin' | 'region' | 'route'>('explore');
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);

  // Create Map Form
  const [showNewMap, setShowNewMap] = useState(false);
  const [newMapName, setNewMapName] = useState('');
  const [newMapUrl, setNewMapUrl] = useState('');
  const [newMapScale, setNewMapScale] = useState(20);
  const [isUploading, setIsUploading] = useState(false);

  // Pin authoring defaults
  const [draftPinLabel, setDraftPinLabel] = useState('Novo Marco');
  const [draftPinKind, setDraftPinKind] = useState<MapPinKind>('landmark');
  const [draftPinEntityId, setDraftPinEntityId] = useState('');
  const [draftPinSceneId, setDraftPinSceneId] = useState('');
  const [draftPinPublic, setDraftPinPublic] = useState(true);

  // Region & Route in-progress points
  const [workingPoints, setWorkingPoints] = useState<MapCoord[]>([]);
  const [regionLabel, setRegionLabel] = useState('Território');
  const [regionColor, setRegionColor] = useState('#d4a359');
  const [routeLabel, setRouteLabel] = useState('Rota de Incursão');
  const [routeMode, setRouteMode] = useState<TravelMode>('foot');

  const visibleMaps = useMemo(
    () =>
      Object.values(maps)
        .filter((m) => isGM || m.isPublicToPlayers)
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [maps, isGM]
  );

  const activeMap = useMemo(() => {
    if (selectedMapId && maps[selectedMapId]) {
      const m = maps[selectedMapId];
      if (isGM || m.isPublicToPlayers) return m;
    }
    return visibleMaps[0] || null;
  }, [selectedMapId, maps, isGM, visibleMaps]);

  const selectedPin = useMemo(
    () => activeMap?.pins.find((p) => p.id === selectedPinId) || null,
    [activeMap, selectedPinId]
  );

  const handleUploadNewMapFile = async (file: File) => {
    setIsUploading(true);
    const url = await uploadChronicleAsset(roomId, 'maps', file);
    setIsUploading(false);
    if (!url) {
      showToast('Erro ao enviar mapa ao Supabase vtt-assets.');
      return;
    }
    setNewMapUrl(url);
    showToast('Imagem do mapa carregada no Supabase.');
  };

  const handleCreateMap = async () => {
    if (!newMapName.trim() || !newMapUrl.trim()) {
      showToast('Informe o nome e a imagem do mapa regional.');
      return;
    }
    const nextMap: RegionalMap = {
      id: `map_${crypto.randomUUID().slice(0, 8)}`,
      name: newMapName.trim(),
      imageUrl: newMapUrl.trim(),
      scaleKmPer100Px: Math.max(1, Number(newMapScale) || 20),
      isPublicToPlayers: true,
      pins: [],
      regions: [],
      routes: [],
      updatedAt: Date.now(),
    };
    await saveRegionalMap(roomId, nextMap);
    setSelectedMapId(nextMap.id);
    setNewMapName('');
    setNewMapUrl('');
    setShowNewMap(false);
    showToast('Mapa regional registrado!');
  };

  const handleMapClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (!activeMap || !isGM || tool === 'explore' || !mapFrameRef.current) return;
    const rect = mapFrameRef.current.getBoundingClientRect();
    const xPercent = Math.max(1, Math.min(99, ((e.clientX - rect.left) / rect.width) * 100));
    const yPercent = Math.max(1, Math.min(99, ((e.clientY - rect.top) / rect.height) * 100));

    if (tool === 'pin') {
      const newPin: MapPin = {
        id: `pin_${crypto.randomUUID().slice(0, 8)}`,
        label: draftPinLabel.trim() || 'Local Marcado',
        xPercent,
        yPercent,
        kind: draftPinKind,
        entityId: draftPinEntityId || null,
        vttSceneId: draftPinSceneId || null,
        isPublicToPlayers: draftPinPublic,
      };
      await saveRegionalMap(roomId, {
        ...activeMap,
        pins: [...activeMap.pins, newPin],
      });
      setSelectedPinId(newPin.id);
      setTool('explore');
      showToast('Pino fixado no mapa.');
      return;
    }

    if (tool === 'region' || tool === 'route') {
      setWorkingPoints((prev) => [...prev, { xPercent, yPercent }]);
    }
  };

  const handleFinishRegion = async () => {
    if (!activeMap || workingPoints.length < 3) {
      showToast('Clique em pelo menos 3 vértices no mapa para fechar um território.');
      return;
    }
    const reg: MapRegion = {
      id: `reg_${crypto.randomUUID().slice(0, 8)}`,
      label: regionLabel.trim() || 'Zona de Influência',
      color: regionColor,
      points: workingPoints,
      isPublicToPlayers: true,
    };
    await saveRegionalMap(roomId, {
      ...activeMap,
      regions: [...activeMap.regions, reg],
    });
    setWorkingPoints([]);
    setTool('explore');
    showToast('Território salvo no mapa.');
  };

  const handleFinishRoute = async () => {
    if (!activeMap || workingPoints.length < 2) {
      showToast('Marque ao menos 2 pontos para calcular uma rota.');
      return;
    }
    const rt: MapRoute = {
      id: `rt_${crypto.randomUUID().slice(0, 8)}`,
      label: routeLabel.trim() || 'Rota',
      mode: routeMode,
      points: workingPoints,
      isPublicToPlayers: true,
    };
    await saveRegionalMap(roomId, {
      ...activeMap,
      routes: [...activeMap.routes, rt],
    });
    setWorkingPoints([]);
    setTool('explore');
    showToast('Rota calculada e salva.');
  };

  const computeRouteMetrics = (points: MapCoord[], mode: TravelMode, scaleKmPer100Px: number) => {
    let totalPx = 0;
    for (let i = 1; i < points.length; i++) {
      const dx = ((points[i].xPercent - points[i - 1].xPercent) / 100) * imgNatural.width;
      const dy = ((points[i].yPercent - points[i - 1].yPercent) / 100) * imgNatural.height;
      totalPx += Math.hypot(dx, dy);
    }
    const km = (totalPx / 100) * scaleKmPer100Px;
    const hours = km / (TRAVEL_SPEED_KMH[mode]?.kmh || 4);
    const timeLabel =
      hours < 1
        ? `${Math.max(5, Math.round(hours * 60))} min`
        : hours >= 24
        ? `${(hours / 8).toFixed(1)} dias de marcha`
        : `${hours.toFixed(1)} h`;
    return { km: km.toFixed(1), timeLabel };
  };

  return (
    <div className="flex flex-col lg:flex-row h-full min-h-0 bg-[#0b0d10]">
      {/* Map Viewport */}
      <div className="flex-1 flex flex-col min-h-0 relative">
        {/* Top Toolbar */}
        <div className="px-4 py-2.5 border-b border-[#222834] bg-[#0e1116] flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <MapIcon className="w-4 h-4 text-[#d4a359]" />
            {visibleMaps.length > 0 ? (
              <select
                value={activeMap?.id || ''}
                onChange={(e) => {
                  setSelectedMapId(e.target.value);
                  setSelectedPinId(null);
                }}
                className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-[#13171e] border border-[#313a4b] text-[#ece8df]"
              >
                {visibleMaps.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.scaleKmPer100Px} km / 100px)
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-xs text-[#a5a095]">Nenhum mapa cadastrado</span>
            )}

            {isGM && (
              <button
                type="button"
                onClick={() => setShowNewMap((p) => !p)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#d4a359] text-[#0b0d10] font-semibold text-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Novo Mapa</span>
              </button>
            )}
          </div>

          {activeMap && (
            <div className="flex flex-wrap items-center gap-1.5">
              {isGM && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setTool('explore');
                      setWorkingPoints([]);
                    }}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs cursor-pointer ${
                      tool === 'explore'
                        ? 'bg-[#191e27] text-[#ece8df] border border-[#313a4b]'
                        : 'text-[#a5a095]'
                    }`}
                  >
                    <Compass className="w-3.5 h-3.5" />
                    <span>Explorar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTool('pin');
                      setWorkingPoints([]);
                    }}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs cursor-pointer ${
                      tool === 'pin'
                        ? 'bg-[#d4a359]/20 text-[#e2b56e] border border-[#d4a359]'
                        : 'text-[#a5a095]'
                    }`}
                  >
                    <MapPinIcon className="w-3.5 h-3.5" />
                    <span>+ Pino</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTool('region');
                      setWorkingPoints([]);
                    }}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs cursor-pointer ${
                      tool === 'region'
                        ? 'bg-[#d4a359]/20 text-[#e2b56e] border border-[#d4a359]'
                        : 'text-[#a5a095]'
                    }`}
                  >
                    <Pentagon className="w-3.5 h-3.5" />
                    <span>+ Território</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTool('route');
                      setWorkingPoints([]);
                    }}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs cursor-pointer ${
                      tool === 'route'
                        ? 'bg-[#4fa3b8]/20 text-[#7cc6d8] border border-[#4fa3b8]'
                        : 'text-[#a5a095]'
                    }`}
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    <span>+ Rota (km)</span>
                  </button>
                </>
              )}

              <div className="flex items-center gap-1 ml-2 bg-[#13171e] border border-[#222834] rounded-lg px-1.5 py-0.5">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.2).toFixed(2))))}
                  className="p-1 text-[#a5a095] hover:text-[#ece8df] cursor-pointer"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="text-xs font-mono text-[#ece8df] px-1">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(3, Number((z + 0.2).toFixed(2))))}
                  className="p-1 text-[#a5a095] hover:text-[#ece8df] cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* New Map Drawer */}
        {showNewMap && isGM && (
          <div className="p-4 border-b border-[#222834] bg-[#13171e] grid grid-cols-1 md:grid-cols-4 gap-2.5">
            <input
              type="text"
              value={newMapName}
              onChange={(e) => setNewMapName(e.target.value)}
              placeholder="Nome (ex.: Região Metropolitana Sul)"
              className="px-3 py-1.5 text-xs rounded-lg bg-[#0e1116] border border-[#222834] text-[#ece8df]"
            />
            <div className="flex items-center gap-1.5 md:col-span-2">
              <input
                type="text"
                value={newMapUrl}
                onChange={(e) => setNewMapUrl(e.target.value)}
                placeholder="URL da imagem ou faça Upload ao lado..."
                className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-[#0e1116] border border-[#222834] text-[#ece8df]"
              />
              <label className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#191e27] border border-[#313a4b] text-xs cursor-pointer shrink-0">
                <ImagePlus className="w-3.5 h-3.5 text-[#d4a359]" />
                <span>{isUploading ? '...' : 'Upload'}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleUploadNewMapFile(f);
                  }}
                />
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={newMapScale}
                onChange={(e) => setNewMapScale(Number(e.target.value))}
                className="w-20 px-2 py-1.5 text-xs font-mono rounded-lg bg-[#0e1116] border border-[#222834] text-[#ece8df]"
                title="Quilômetros a cada 100 pixels"
              />
              <span className="text-xs text-[#a5a095]">km/100px</span>
              <button
                type="button"
                onClick={handleCreateMap}
                className="px-3 py-1.5 rounded-lg bg-[#d4a359] text-[#0b0d10] font-semibold text-xs cursor-pointer ml-auto"
              >
                Salvar
              </button>
            </div>
          </div>
        )}

        {/* Map Canvas Scroll Container */}
        <div className="flex-1 overflow-auto custom-scrollbar p-6 flex items-center justify-center bg-[#080a0d]">
          {!activeMap ? (
            <div className="max-w-md p-6 rounded-xl bg-[#13171e] border border-[#222834] text-center space-y-3">
              <MapIcon className="w-8 h-8 text-[#d4a359] mx-auto" />
              <h3 className="text-base font-bold text-[#ece8df]">Cartografia Regional</h3>
              <p className="text-xs text-[#a5a095] leading-relaxed">
                Envie o mapa de continente, cidade ou distrito para fixar pinos conectados à Wiki,
                demarcar territórios de facções, calcular tempo de viagem e mover os jogadores
                diretamente para cenas do StarStream VTT.
              </p>
            </div>
          ) : (
            <div
              ref={mapFrameRef}
              onClick={handleMapClick}
              style={{
                width: imgNatural.width * zoom,
                height: imgNatural.height * zoom,
              }}
              className={`relative shrink-0 rounded-xl overflow-hidden border border-[#313a4b] select-none ${
                tool !== 'explore' ? 'cursor-crosshair' : 'cursor-default'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={activeMap.imageUrl}
                alt={activeMap.name}
                onLoad={(e) => {
                  const el = e.currentTarget;
                  if (el.naturalWidth && el.naturalHeight) {
                    setImgNatural({
                      width: Math.min(1400, el.naturalWidth),
                      height: Math.min(
                        1400 * (el.naturalHeight / el.naturalWidth),
                        el.naturalHeight
                      ),
                    });
                  }
                }}
                className="w-full h-full object-contain pointer-events-none"
              />

              {/* SVG Overlay for Polygons & Travel Routes */}
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className="absolute inset-0 w-full h-full pointer-events-none"
              >
                {activeMap.regions
                  .filter((r) => isGM || r.isPublicToPlayers)
                  .map((reg) => (
                    <polygon
                      key={reg.id}
                      points={reg.points.map((p) => `${p.xPercent},${p.yPercent}`).join(' ')}
                      fill={reg.color}
                      fillOpacity={0.22}
                      stroke={reg.color}
                      strokeWidth={0.45}
                    />
                  ))}

                {activeMap.routes
                  .filter((rt) => isGM || rt.isPublicToPlayers)
                  .map((rt) => (
                    <polyline
                      key={rt.id}
                      points={rt.points.map((p) => `${p.xPercent},${p.yPercent}`).join(' ')}
                      fill="none"
                      stroke="#4fa3b8"
                      strokeWidth={0.6}
                      strokeDasharray="1.4 0.9"
                    />
                  ))}

                {workingPoints.length > 0 && (
                  <polyline
                    points={workingPoints.map((p) => `${p.xPercent},${p.yPercent}`).join(' ')}
                    fill={tool === 'region' ? regionColor : 'none'}
                    fillOpacity={0.2}
                    stroke="#d4a359"
                    strokeWidth={0.6}
                  />
                )}
              </svg>

              {/* Interactive Pins */}
              {activeMap.pins
                .filter((p) => isGM || p.isPublicToPlayers)
                .map((pin) => {
                  const isSel = selectedPinId === pin.id;
                  return (
                    <button
                      key={pin.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPinId(pin.id);
                      }}
                      style={{
                        left: `${pin.xPercent}%`,
                        top: `${pin.yPercent}%`,
                      }}
                      className="absolute -translate-x-1/2 -translate-y-full group cursor-pointer"
                    >
                      <div
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border shadow-md whitespace-nowrap ${
                          isSel
                            ? 'bg-[#d4a359] text-[#0b0d10] border-[#ece8df]'
                            : 'bg-[#0e1116]/95 text-[#ece8df] border-[#313a4b]'
                        }`}
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: PIN_COLORS[pin.kind] }}
                        />
                        <span>{pin.label}</span>
                      </div>
                    </button>
                  );
                })}
            </div>
          )}
        </div>
      </div>

      {/* Right Cartography Inspector */}
      {activeMap && (
        <aside className="w-full lg:w-84 shrink-0 border-t lg:border-t-0 lg:border-l border-[#222834] bg-[#0e1116] overflow-y-auto custom-scrollbar p-4 space-y-4">
          {/* Active Tool Authoring Box */}
          {isGM && tool === 'pin' && (
            <section className="p-3.5 rounded-xl bg-[#13171e] border border-[#d4a359]/50 space-y-2.5">
              <div className="text-xs font-bold text-[#e2b56e]">
                Modo Pino: Configure e clique no mapa
              </div>
              <input
                type="text"
                value={draftPinLabel}
                onChange={(e) => setDraftPinLabel(e.target.value)}
                placeholder="Nome do local..."
                className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-[#0e1116] border border-[#222834] text-[#ece8df]"
              />
              <select
                value={draftPinKind}
                onChange={(e) => setDraftPinKind(e.target.value as MapPinKind)}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-[#0e1116] border border-[#222834] text-[#ece8df]"
              >
                <option value="city">Cidade / Distrito</option>
                <option value="dungeon">Zona de Ruptura / Masmorra</option>
                <option value="landmark">Marco Relevante</option>
                <option value="hq">Base / QG</option>
                <option value="danger">Alerta de Perigo</option>
              </select>
              <select
                value={draftPinEntityId}
                onChange={(e) => setDraftPinEntityId(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-[#0e1116] border border-[#222834] text-[#ece8df]"
              >
                <option value="">Vincular Página do Atlas (opcional)...</option>
                {Object.values(entities).map((en) => (
                  <option key={en.id} value={en.id}>
                    {en.title}
                  </option>
                ))}
              </select>
              <select
                value={draftPinSceneId}
                onChange={(e) => setDraftPinSceneId(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-[#0e1116] border border-[#222834] text-[#ece8df]"
              >
                <option value="">Vincular Cena do StarStream VTT (opcional)...</option>
                {vttScenes.map((sc) => (
                  <option key={sc.id} value={sc.id}>
                    {sc.name}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-xs text-[#a5a095] cursor-pointer">
                <input
                  type="checkbox"
                  checked={draftPinPublic}
                  onChange={(e) => setDraftPinPublic(e.target.checked)}
                />
                <span>Visível aos jogadores</span>
              </label>
            </section>
          )}

          {isGM && tool === 'region' && (
            <section className="p-3.5 rounded-xl bg-[#13171e] border border-[#d4a359]/50 space-y-2.5">
              <div className="text-xs font-bold text-[#e2b56e]">
                Desenhando Território ({workingPoints.length} vértices)
              </div>
              <input
                type="text"
                value={regionLabel}
                onChange={(e) => setRegionLabel(e.target.value)}
                placeholder="Nome da Zona / Facção"
                className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-[#0e1116] border border-[#222834] text-[#ece8df]"
              />
              <div className="flex items-center justify-between gap-2">
                <input
                  type="color"
                  value={regionColor}
                  onChange={(e) => setRegionColor(e.target.value)}
                  className="h-8 w-14 rounded bg-[#0e1116] border border-[#222834]"
                />
                <button
                  type="button"
                  onClick={handleFinishRegion}
                  className="flex-1 py-1.5 rounded-lg bg-[#d4a359] text-[#0b0d10] font-semibold text-xs cursor-pointer"
                >
                  Concluir Território
                </button>
              </div>
            </section>
          )}

          {isGM && tool === 'route' && (
            <section className="p-3.5 rounded-xl bg-[#13171e] border border-[#4fa3b8]/50 space-y-2.5">
              <div className="text-xs font-bold text-[#7cc6d8]">
                Traçando Rota ({workingPoints.length} pontos)
              </div>
              <input
                type="text"
                value={routeLabel}
                onChange={(e) => setRouteLabel(e.target.value)}
                placeholder="Nome da rota..."
                className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-[#0e1116] border border-[#222834] text-[#ece8df]"
              />
              <select
                value={routeMode}
                onChange={(e) => setRouteMode(e.target.value as TravelMode)}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-[#0e1116] border border-[#222834] text-[#ece8df]"
              >
                {(Object.keys(TRAVEL_SPEED_KMH) as TravelMode[]).map((m) => (
                  <option key={m} value={m}>
                    {TRAVEL_SPEED_KMH[m].label}
                  </option>
                ))}
              </select>
              {workingPoints.length >= 2 && (
                <div className="text-xs font-mono text-[#ece8df]">
                  Prévia:{' '}
                  {
                    computeRouteMetrics(workingPoints, routeMode, activeMap.scaleKmPer100Px)
                      .km
                  }{' '}
                  km (
                  {
                    computeRouteMetrics(workingPoints, routeMode, activeMap.scaleKmPer100Px)
                      .timeLabel
                  }
                  )
                </div>
              )}
              <button
                type="button"
                onClick={handleFinishRoute}
                className="w-full py-1.5 rounded-lg bg-[#4fa3b8] text-[#0b0d10] font-semibold text-xs cursor-pointer"
              >
                Salvar Rota Calculada
              </button>
            </section>
          )}

          {/* Selected Pin Details */}
          {selectedPin && (
            <section className="p-3.5 rounded-xl bg-[#13171e] border border-[#313a4b] space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-mono uppercase text-[#d4a359]">
                    Marcador Selecionado
                  </span>
                  <h4 className="text-sm font-bold text-[#ece8df]">{selectedPin.label}</h4>
                </div>
                {isGM && (
                  <button
                    type="button"
                    onClick={async () => {
                      await saveRegionalMap(roomId, {
                        ...activeMap,
                        pins: activeMap.pins.filter((p) => p.id !== selectedPin.id),
                      });
                      setSelectedPinId(null);
                    }}
                    className="p-1 text-[#6f6b62] hover:text-[#c94a4a] cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {selectedPin.entityId && entities[selectedPin.entityId] && (
                <button
                  type="button"
                  onClick={() => navigateToEntity(selectedPin.entityId!)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-[#0e1116] border border-[#222834] hover:border-[#d4a359] text-xs cursor-pointer"
                >
                  <span className="font-semibold text-[#ece8df] truncate">
                    {entities[selectedPin.entityId].title}
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 text-[#d4a359] shrink-0" />
                </button>
              )}

              {selectedPin.vttSceneId && isGM && (
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await moveVTTPlayersToScene(roomId, selectedPin.vttSceneId!);
                    showToast(
                      ok
                        ? 'Jogadores transportados para esta cena no StarStream VTT!'
                        : 'Erro ao mover cena ativa no VTT.'
                    );
                  }}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-[#d4a359] hover:bg-[#e2b56e] text-[#0b0d10] font-semibold text-xs cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Mover Jogadores no StarStream VTT</span>
                </button>
              )}
            </section>
          )}

          {/* Saved Travel Routes Summary */}
          <section className="p-3.5 rounded-xl bg-[#13171e] border border-[#222834] space-y-2">
            <div className="text-xs font-bold text-[#ece8df]">
              Rotas & Distâncias ({activeMap.routes.length})
            </div>
            {activeMap.routes.length === 0 ? (
              <p className="text-xs text-[#6f6b62]">
                Nenhuma rota medida neste mapa ainda.
              </p>
            ) : (
              activeMap.routes.map((rt) => {
                const metrics = computeRouteMetrics(
                  rt.points,
                  rt.mode,
                  activeMap.scaleKmPer100Px
                );
                return (
                  <div
                    key={rt.id}
                    className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-[#0e1116] border border-[#222834] text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-[#ece8df] truncate">{rt.label}</div>
                      <div className="font-mono text-[11px] text-[#4fa3b8]">
                        {metrics.km} km · {metrics.timeLabel}
                      </div>
                    </div>
                    {isGM && (
                      <button
                        type="button"
                        onClick={() =>
                          saveRegionalMap(roomId, {
                            ...activeMap,
                            routes: activeMap.routes.filter((x) => x.id !== rt.id),
                          })
                        }
                        className="text-[#6f6b62] hover:text-[#c94a4a] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </section>

          {isGM && (
            <button
              type="button"
              onClick={async () => {
                if (!window.confirm(`Excluir o mapa "${activeMap.name}"?`)) return;
                await deleteRegionalMap(roomId, activeMap.id);
                setSelectedMapId(null);
              }}
              className="w-full py-2 rounded-lg bg-[#13171e] border border-[#222834] hover:border-[#c94a4a] text-xs text-[#a5a095] hover:text-[#c94a4a] cursor-pointer"
            >
              Excluir Este Mapa Regional
            </button>
          )}
        </aside>
      )}
    </div>
  );
}
