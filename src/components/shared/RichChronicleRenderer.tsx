'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  Lock,
  Play,
  Shield,
  Square,
  Unlock,
  User,
  Volume2,
} from 'lucide-react';
import { useChronicleStore, useEffectiveGM } from '@/store/useChronicleStore';
import { extractYouTubeVideoId, formatSeconds } from '@/lib/utils';
import type { AudioClipBlock, DocumentPaperTheme } from '@/types/chronicle';

interface RichChronicleRendererProps {
  content: string;
  unlockedRedactions?: string[];
  onToggleRedaction?: (redactionId: string) => void;
  audioClips?: AudioClipBlock[];
  paperTheme?: DocumentPaperTheme;
}

interface TooltipTarget {
  type: 'entity' | 'character';
  id: string;
  label: string;
  x: number;
  y: number;
}

export function RichChronicleRenderer({
  content,
  unlockedRedactions = [],
  onToggleRedaction,
  audioClips = [],
  paperTheme = 'dark-dossier',
}: RichChronicleRendererProps) {
  const isGM = useEffectiveGM();
  const entities = useChronicleStore((s) => s.entities);
  const characters = useChronicleStore((s) => s.characters);
  const navigateToEntity = useChronicleStore((s) => s.navigateToEntity);
  const openFloatingSheet = useChronicleStore((s) => s.openFloatingSheet);

  const [tooltip, setTooltip] = useState<TooltipTarget | null>(null);
  const [openSpoilers, setOpenSpoilers] = useState<Record<number, boolean>>({});
  const [playingClipId, setPlayingClipId] = useState<string | null>(null);

  const isSepia = paperTheme === 'sepia-parchment';
  const isTypewriter = paperTheme === 'typewriter-report';
  const unlockedSet = new Set(unlockedRedactions);

  const renderInlineTokens = (line: string, keyPrefix: string): React.ReactNode[] => {
    const tokenRegex =
      /(@\[([^\]]+)\]\((entity|character):([A-Za-z0-9_-]+)\)|\[\[TARJA:([A-Za-z0-9_-]+)\|([^\]]+)\]\])/g;

    const nodes: React.ReactNode[] = [];
    let lastIndex = 0;
    let idx = 0;

    for (const match of line.matchAll(tokenRegex)) {
      const matchStart = match.index ?? 0;
      if (matchStart > lastIndex) {
        nodes.push(
          renderBasicFormatting(line.slice(lastIndex, matchStart), `${keyPrefix}-txt-${idx}`)
        );
      }

      if (match[2] && match[3] && match[4]) {
        // @Mention
        const label = match[2];
        const targetType = match[3] as 'entity' | 'character';
        const targetId = match[4];

        nodes.push(
          <button
            key={`${keyPrefix}-mnt-${idx}`}
            type="button"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setTooltip({
                type: targetType,
                id: targetId,
                label,
                x: Math.min(window.innerWidth - 320, Math.max(12, rect.left)),
                y: Math.min(window.innerHeight - 240, rect.bottom + 8),
              });
            }}
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded text-xs font-semibold transition-colors cursor-pointer align-baseline ${
              isSepia
                ? 'bg-[#e5d7b8] text-[#5c3d14] border border-[#bfa77a] hover:bg-[#dcc9a1]'
                : targetType === 'character'
                ? 'bg-cyan-600/15 text-cyan-300 border border-cyan-500/35 hover:bg-cyan-600/25'
                : 'bg-cyan-600/15 text-cyan-300 border border-cyan-500/35 hover:bg-cyan-600/25'
            }`}
          >
            <span>@{label}</span>
          </button>
        );
      } else if (match[5] && match[6]) {
        // [[TARJA:id|secretText]]
        const redactionId = match[5];
        const secretText = match[6];
        const isUnlocked = unlockedSet.has(redactionId);

        if (isGM) {
          nodes.push(
            <button
              key={`${keyPrefix}-rd-${idx}`}
              type="button"
              onClick={() => onToggleRedaction?.(redactionId)}
              title={
                isUnlocked
                  ? 'Revelado para os jogadores (Clique para censurar novamente)'
                  : 'Censurado com Tarja Preta para os jogadores (Clique para revelar ao vivo)'
              }
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 mx-0.5 rounded font-mono text-xs transition-colors cursor-pointer align-baseline ${
                isUnlocked
                  ? isSepia
                    ? 'bg-[#dfd2b5] text-[#221b13] border border-[#8c734b]'
                    : 'bg-cyan-600/20 text-zinc-100 border border-cyan-500/50'
                  : 'bg-[#08090c] text-cyan-400 border border-dashed border-[#c94a4a]/70 hover:border-cyan-500'
              }`}
            >
              {isUnlocked ? (
                <Unlock className="w-3 h-3 text-cyan-400 shrink-0" />
              ) : (
                <Lock className="w-3 h-3 text-red-400 shrink-0" />
              )}
              <span>{secretText}</span>
            </button>
          );
        } else if (isUnlocked) {
          nodes.push(
            <span
              key={`${keyPrefix}-rd-open-${idx}`}
              className={`inline-block px-1.5 py-0.5 mx-0.5 rounded text-xs font-medium ${
                isSepia
                  ? 'bg-[#e4d5b7] text-[#221b13] border-b border-[#8c734b]'
                  : 'bg-cyan-600/15 text-zinc-100 border-b border-cyan-500/50'
              }`}
              title="Trecho desclassificado pelo Mestre"
            >
              {secretText}
            </span>
          );
        } else {
          // Jogador comum com tarja trancada: NUNCA envia o texto real ao DOM
          const maskLen = Math.min(28, Math.max(8, secretText.length));
          const maskBar = '█'.repeat(maskLen);
          nodes.push(
            <span
              key={`${keyPrefix}-rd-closed-${idx}`}
              className={`inline-block px-1.5 py-0.5 mx-0.5 rounded font-mono text-xs tracking-tight select-none cursor-not-allowed ${
                isSepia
                  ? 'bg-[#1e1812] text-[#1e1812]'
                  : 'bg-[#ece8df] text-zinc-100 opacity-90'
              }`}
              title="Informação Confidencial Censurada"
              aria-label="Trecho censurado"
            >
              {maskBar}
            </span>
          );
        }
      }

      lastIndex = matchStart + match[0].length;
      idx += 1;
    }

    if (lastIndex < line.length) {
      nodes.push(renderBasicFormatting(line.slice(lastIndex), `${keyPrefix}-end`));
    }

    return nodes;
  };

  const renderBasicFormatting = (text: string, key: string): React.ReactNode => {
    const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
    return (
      <React.Fragment key={key}>
        {parts.map((part, i) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return (
              <strong key={i} className="font-semibold">
                {part.slice(2, -2)}
              </strong>
            );
          }
          if (part.startsWith('*') && part.endsWith('*')) {
            return (
              <em key={i} className="italic">
                {part.slice(1, -1)}
              </em>
            );
          }
          if (part.startsWith('`') && part.endsWith('`')) {
            return (
              <code
                key={i}
                className={`px-1 py-0.5 rounded font-mono text-xs ${
                  isSepia ? 'bg-[#e3d5b8] text-[#3a2c1a]' : 'bg-zinc-950 text-cyan-400'
                }`}
              >
                {part.slice(1, -1)}
              </code>
            );
          }
          return part;
        })}
      </React.Fragment>
    );
  };

  // Block parser: headings, spoilers, tables, blockquotes, lists, paragraphs
  const lines = (content || '').replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Spoiler block :::spoiler[Title]
    const spoilerMatch = line.match(/^:::spoiler\[([^\]]*)\]/);
    if (spoilerMatch) {
      const title = spoilerMatch[1] || 'Detalhes Ocultos';
      const spoilerIdx = i;
      const innerLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith(':::')) {
        innerLines.push(lines[i]);
        i += 1;
      }
      i += 1; // skip closing :::
      const isOpen = Boolean(openSpoilers[spoilerIdx]);
      blocks.push(
        <div
          key={`sp-${spoilerIdx}`}
          className={`my-3 rounded-lg border ${
            isSepia
              ? 'border-[#cbb894] bg-[#eadec4]'
              : 'border-zinc-800 bg-zinc-950'
          }`}
        >
          <button
            type="button"
            onClick={() =>
              setOpenSpoilers((prev) => ({ ...prev, [spoilerIdx]: !prev[spoilerIdx] }))
            }
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              {isOpen ? (
                <ChevronDown className="w-3.5 h-3.5 text-cyan-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-cyan-400" />
              )}
              <span>{title}</span>
            </span>
            <span className="text-xs font-mono opacity-65">
              {isOpen ? 'Recolher' : 'Clique para abrir'}
            </span>
          </button>
          {isOpen && (
            <div className="px-3 pb-3 pt-1 text-sm leading-relaxed border-t border-current/10 space-y-1.5">
              {innerLines.map((il, idx2) => (
                <p key={idx2}>{renderInlineTokens(il, `sp-${spoilerIdx}-${idx2}`)}</p>
              ))}
            </div>
          )}
        </div>
      );
      continue;
    }

    // Markdown Table
    if (line.trim().startsWith('|') && i + 1 < lines.length && lines[i + 1].includes('---')) {
      const tableStart = i;
      const headerCells = line
        .split('|')
        .map((c) => c.trim())
        .filter(Boolean);
      i += 2; // skip separator
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(
          lines[i]
            .split('|')
            .map((c) => c.trim())
            .filter(Boolean)
        );
        i += 1;
      }
      blocks.push(
        <div
          key={`tbl-${tableStart}`}
          className={`my-3 overflow-x-auto rounded-lg border ${
            isSepia ? 'border-[#cbb894]' : 'border-zinc-800'
          }`}
        >
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr
                className={
                  isSepia
                    ? 'bg-[#e4d5b6] text-[#221b13] border-b border-[#cbb894]'
                    : 'bg-zinc-950 text-cyan-400 border-b border-zinc-800'
                }
              >
                {headerCells.map((hc, hi) => (
                  <th key={hi} className="px-3 py-2 font-semibold">
                    {hc}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr
                  key={ri}
                  className={`border-b last:border-b-0 ${
                    isSepia
                      ? 'border-[#cbb894]/60 odd:bg-[#efe4cc]'
                      : 'border-zinc-800/70 odd:bg-zinc-900 even:bg-[#10141a]'
                  }`}
                >
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-2">
                      {renderInlineTokens(cell, `tbl-${tableStart}-${ri}-${ci}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Headings
    if (line.startsWith('### ')) {
      blocks.push(
        <h4 key={`h3-${i}`} className="text-sm font-bold mt-4 mb-1.5 tracking-tight">
          {renderInlineTokens(line.slice(4), `h3-${i}`)}
        </h4>
      );
      i += 1;
      continue;
    }
    if (line.startsWith('## ')) {
      blocks.push(
        <h3
          key={`h2-${i}`}
          className="text-base font-bold font-sans mt-5 mb-2 pb-1 border-b border-current/10"
        >
          {renderInlineTokens(line.slice(3), `h2-${i}`)}
        </h3>
      );
      i += 1;
      continue;
    }
    if (line.startsWith('# ')) {
      blocks.push(
        <h2 key={`h1-${i}`} className="text-lg font-bold font-sans mt-4 mb-2">
          {renderInlineTokens(line.slice(2), `h1-${i}`)}
        </h2>
      );
      i += 1;
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      blocks.push(
        <blockquote
          key={`bq-${i}`}
          className={`my-2.5 pl-3 py-1 border-l italic text-sm ${
            isSepia
              ? 'border-[#8c6d3f] text-[#473826]'
              : 'border-cyan-500 text-zinc-400'
          }`}
        >
          {renderInlineTokens(line.slice(2), `bq-${i}`)}
        </blockquote>
      );
      i += 1;
      continue;
    }

    // Bullet List
    if (line.startsWith('- ') || line.startsWith('* ')) {
      const listStart = i;
      const items: string[] = [];
      while (i < lines.length && (lines[i].startsWith('- ') || lines[i].startsWith('* '))) {
        items.push(lines[i].slice(2));
        i += 1;
      }
      blocks.push(
        <ul key={`ul-${listStart}`} className="my-2 pl-5 list-disc space-y-1 text-sm">
          {items.map((it, idx2) => (
            <li key={idx2}>{renderInlineTokens(it, `li-${listStart}-${idx2}`)}</li>
          ))}
        </ul>
      );
      continue;
    }

    if (line.trim() === '') {
      i += 1;
      continue;
    }

    blocks.push(
      <p
        key={`p-${i}`}
        className={`my-2 text-sm leading-relaxed ${isTypewriter ? 'font-mono text-xs' : ''}`}
      >
        {renderInlineTokens(line, `p-${i}`)}
      </p>
    );
    i += 1;
  }

  return (
    <div
      className={
        isSepia
          ? 'text-[#221b13]'
          : isTypewriter
          ? 'text-[#dcd8ce] font-mono'
          : 'text-zinc-100'
      }
    >
      {blocks.length > 0 ? (
        blocks
      ) : (
        <p className="text-xs italic opacity-60">Nenhum conteúdo registrado ainda.</p>
      )}

      {/* Diegetic YouTube Audio Clips (Fitas Interceptadas Zero-Storage) */}
      {audioClips.length > 0 && (
        <div className="mt-5 pt-4 border-t border-current/15 space-y-2.5">
          <div className="text-xs font-mono uppercase tracking-wider opacity-70 flex items-center gap-1.5">
            <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>Registros de Áudio & Fitas Anexadas</span>
          </div>
          {audioClips.map((clip) => {
            const ytId = extractYouTubeVideoId(clip.youtubeUrl);
            const isPlaying = playingClipId === clip.id;
            return (
              <div
                key={clip.id}
                className={`p-3 rounded-lg border ${
                  isSepia
                    ? 'bg-[#e8dbc0] border-[#cbb894]'
                    : 'bg-zinc-950 border-zinc-800'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold">{clip.title}</div>
                    <div className="text-xs font-mono opacity-70">
                      Trecho: {formatSeconds(clip.startSec)} até{' '}
                      {clip.endSec > clip.startSec ? formatSeconds(clip.endSec) : 'Fim'}
                      {clip.notes ? ` · ${clip.notes}` : ''}
                    </div>
                  </div>
                  {ytId && (
                    <button
                      type="button"
                      onClick={() => setPlayingClipId(isPlaying ? null : clip.id)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-cyan-600 text-[#0b0d10] hover:bg-cyan-500 transition-colors cursor-pointer"
                    >
                      {isPlaying ? (
                        <>
                          <Square className="w-3 h-3" />
                          <span>Parar Fita</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3" />
                          <span>Reproduzir Trecho</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
                {isPlaying && ytId && (
                  <div className="mt-2.5 rounded overflow-hidden border border-current/15 bg-black h-20">
                    <iframe
                      title={clip.title}
                      className="w-full h-full"
                      allow="autoplay; encrypted-media"
                      src={`https://www.youtube.com/embed/${ytId}?autoplay=1&start=${Math.max(
                        0,
                        Math.floor(clip.startSec)
                      )}${
                        clip.endSec > clip.startSec ? `&end=${Math.floor(clip.endSec)}` : ''
                      }`}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Smart Tooltip Portal */}
      {tooltip &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999]"
            onClick={() => setTooltip(null)}
          >
            <div
              style={{ left: tooltip.x, top: tooltip.y }}
              onClick={(e) => e.stopPropagation()}
              className="fixed w-76 bg-zinc-900 text-zinc-100 border border-zinc-700 rounded-xl p-3.5"
            >
              {tooltip.type === 'character' ? (
                (() => {
                  const ch = characters[tooltip.id];
                  if (!ch) {
                    return (
                      <div className="text-xs text-zinc-400">
                        Ficha de <strong>{tooltip.label}</strong> não encontrada no banco.
                      </div>
                    );
                  }
                  return (
                    <div>
                      <div className="flex items-center gap-2.5 pb-2.5 mb-2.5 border-b border-zinc-800">
                        <div className="w-10 h-10 rounded-lg bg-zinc-950 border border-zinc-700 overflow-hidden shrink-0 flex items-center justify-center">
                          {ch.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={ch.avatarUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-4 h-4 text-cyan-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-mono text-cyan-400 uppercase">
                            Omniscient Sheet Live
                          </div>
                          <div className="text-sm font-bold truncate">{ch.name}</div>
                          <div className="text-xs text-zinc-400 truncate">
                            {ch.className || 'Operador'} · Nv. {ch.level}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-1.5 text-xs mb-3">
                        <div className="p-1.5 rounded bg-zinc-950 border border-zinc-800">
                          <span className="text-zinc-400 block">HP</span>
                          <span className="font-mono font-bold">
                            {ch.hp.current}/{ch.hp.max}
                          </span>
                        </div>
                        <div className="p-1.5 rounded bg-zinc-950 border border-zinc-800">
                          <span className="text-zinc-400 block">PE</span>
                          <span className="font-mono font-bold">
                            {ch.energy.current}/{ch.energy.max}
                          </span>
                        </div>
                        <div className="p-1.5 rounded bg-zinc-950 border border-zinc-800">
                          <span className="text-zinc-400 block">Defesa</span>
                          <span className="font-mono font-bold flex items-center gap-1">
                            <Shield className="w-3 h-3 text-cyan-400" />
                            {ch.defense ?? 10}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          openFloatingSheet(ch.id);
                          setTooltip(null);
                        }}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-cyan-600 text-[#0b0d10] font-semibold text-xs hover:opacity-90 transition-opacity cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Abrir Ficha Oficial em Janela</span>
                      </button>
                    </div>
                  );
                })()
              ) : (
                (() => {
                  const ent = entities[tooltip.id];
                  if (!ent || (!ent.isPublicToPlayers && !isGM)) {
                    return (
                      <div className="text-xs text-zinc-400">
                        Registro confidencial ou ainda não publicado pelo Mestre.
                      </div>
                    );
                  }
                  return (
                    <div>
                      <div className="text-xs font-mono uppercase text-cyan-400 mb-0.5">
                        Atlas · {ent.customCategoryLabel || ent.category}
                      </div>
                      <div className="text-sm font-bold mb-1">{ent.title}</div>
                      {ent.subtitle && (
                        <p className="text-xs text-zinc-400 mb-2.5">{ent.subtitle}</p>
                      )}
                      {ent.customFields.length > 0 && (
                        <div className="space-y-1 mb-3 text-xs">
                          {ent.customFields.slice(0, 2).map((cf) => (
                            <div
                              key={cf.id}
                              className="flex items-center justify-between px-2 py-1 rounded bg-zinc-950 border border-zinc-800"
                            >
                              <span className="text-zinc-400">{cf.label}</span>
                              <span className="font-medium">{cf.value}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          navigateToEntity(ent.id);
                          setTooltip(null);
                        }}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-cyan-600 text-[#0b0d10] font-semibold text-xs hover:bg-cyan-500 transition-colors cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Abrir Página no Atlas</span>
                      </button>
                    </div>
                  );
                })()
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
