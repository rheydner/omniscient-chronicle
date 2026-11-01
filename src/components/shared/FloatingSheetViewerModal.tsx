'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ExternalLink,
  GripHorizontal,
  Loader2,
  Maximize2,
  Minimize2,
  RotateCw,
  X,
} from 'lucide-react';
import { useChronicleStore } from '@/store/useChronicleStore';

export function FloatingSheetViewerModal() {
  const charId = useChronicleStore((s) => s.floatingSheetCharacterId);
  const characters = useChronicleStore((s) => s.characters);
  const openFloatingSheet = useChronicleStore((s) => s.openFloatingSheet);

  const character = charId ? characters[charId] : null;

  const [position, setPosition] = useState({ x: 80, y: 45 });
  const [size, setSize] = useState({ width: 920, height: 700 });
  const [isMaximized, setIsMaximized] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [iframeKey, setIframeKey] = useState(0);

  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const currentPosRef = useRef({ x: 80, y: 45 });
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    currentPosRef.current = position;
  }, [position]);

  useEffect(() => {
    if (charId && typeof window !== 'undefined') {
      const w = Math.min(940, window.innerWidth - 48);
      const h = Math.min(720, window.innerHeight - 64);
      const sx = Math.max(24, (window.innerWidth - w) / 2);
      const sy = Math.max(24, (window.innerHeight - h) / 2);
      setSize({ width: w, height: h });
      setPosition({ x: sx, y: sy });
      currentPosRef.current = { x: sx, y: sy };
      setIsLoading(true);
    }
  }, [charId]);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const cx = e.clientX;
      const cy = e.clientY;
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(() => {
        const maxX = Math.max(10, window.innerWidth - size.width - 10);
        const maxY = Math.max(10, window.innerHeight - 60);
        const nx = Math.max(10, Math.min(maxX, cx - dragOffsetRef.current.x));
        const ny = Math.max(10, Math.min(maxY, cy - dragOffsetRef.current.y));
        currentPosRef.current = { x: nx, y: ny };
        setPosition({ x: nx, y: ny });
        rafIdRef.current = null;
      });
    },
    [size.width]
  );

  const handleMouseUp = useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove, { passive: true });
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  if (!charId || typeof document === 'undefined') return null;

  const sheetUrl = `https://omniscient-rpg.web.app/sheet/${charId}?embedded=vtt`;

  return createPortal(
    <>
      {isDragging && (
        <div
          className="fixed inset-0 z-[99999] cursor-grabbing select-none bg-transparent"
          style={{ pointerEvents: 'all' }}
        />
      )}
      <div
        style={
          isMaximized
            ? {
                top: 12,
                left: 12,
                width: 'calc(100vw - 24px)',
                height: 'calc(100vh - 24px)',
                transform: 'none',
              }
            : {
                top: 0,
                left: 0,
                width: size.width,
                height: size.height,
                transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
                willChange: isDragging ? 'transform' : 'auto',
              }
        }
        className={`fixed z-[9990] flex flex-col bg-zinc-950 border border-zinc-700 rounded-xl overflow-hidden select-none ${
          isDragging ? 'transition-none' : 'transition-[width,height] duration-150'
        }`}
      >
        <div
          onMouseDown={(e) => {
            if (isMaximized) return;
            if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('a')) {
              return;
            }
            e.preventDefault();
            setIsDragging(true);
            isDraggingRef.current = true;
            dragOffsetRef.current = {
              x: e.clientX - currentPosRef.current.x,
              y: e.clientY - currentPosRef.current.y,
            };
          }}
          className="flex items-center justify-between px-3.5 py-2.5 bg-zinc-900 border-b border-zinc-800 cursor-grab active:cursor-grabbing shrink-0"
        >
          <div className="flex items-center gap-2">
            <GripHorizontal className="w-4 h-4 text-zinc-500" />
            <span className="text-xs font-bold text-zinc-100">
              {character?.name || 'Ficha Omniscient'}
            </span>
            <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-cyan-600/15 text-cyan-300 border border-cyan-500/35">
              OMNISCIENT SHEET
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setIsLoading(true);
                setIframeKey((k) => k + 1);
              }}
              className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Recarregar Ficha"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
            <a
              href={`https://omniscient-rpg.web.app/sheet/${charId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-md text-zinc-400 hover:text-cyan-400 hover:bg-zinc-800 transition-colors"
              title="Abrir em Nova Aba"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button
              type="button"
              onClick={() => setIsMaximized((m) => !m)}
              className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => openFloatingSheet(null)}
              className="p-1.5 rounded-md text-zinc-400 hover:text-red-400 hover:bg-[#c94a4a]/15 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="relative flex-1 bg-zinc-950">
          {isLoading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-zinc-950/90">
              <Loader2 className="w-5 h-5 text-cyan-400 motion-safe:animate-spin" />
              <span className="text-xs font-mono text-zinc-400">
                Conectando ao Omniscient Sheet...
              </span>
            </div>
          )}
          <iframe
            key={iframeKey}
            src={sheetUrl}
            onLoad={() => setIsLoading(false)}
            className="w-full h-full border-0"
            allow="clipboard-write; fullscreen"
            title="Omniscient Sheet Embedded"
          />
        </div>
      </div>
    </>,
    document.body
  );
}
