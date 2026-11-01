'use client';

import React, { useRef, useState } from 'react';
import {
  AtSign,
  Eye,
  EyeOff,
  FileLock2,
  Mic,
  MicOff,
  Plus,
  Table2,
  Trash2,
  Volume2,
} from 'lucide-react';
import { useChronicleStore } from '@/store/useChronicleStore';
import { createMentionSyntax, createRedactionSyntax } from '@/lib/markdown-engine';
import { RichChronicleRenderer } from './RichChronicleRenderer';
import type { AudioClipBlock } from '@/types/chronicle';

interface RichChronicleEditorProps {
  value: string;
  onChange: (next: string) => void;
  unlockedRedactions?: string[];
  audioClips?: AudioClipBlock[];
  onChangeAudioClips?: (clips: AudioClipBlock[]) => void;
  placeholder?: string;
  minRows?: number;
}

const RPG_TABLE_TEMPLATES: Record<string, string> = {
  atributos: [
    '| FOR | DES | CON | INT | SAB | PRE |',
    '| --- | --- | --- | --- | --- | --- |',
    '| 10 (+0) | 14 (+2) | 12 (+1) | 16 (+3) | 10 (+0) | 18 (+4) |',
  ].join('\n'),
  inventario: [
    '| Item / Relíquia | Qtd | Grau / Peso | Efeito Resumido |',
    '| --- | --- | --- | --- |',
    '| Lanterna de Bronze | 1 | Grau 3 | Revela rastros ectoplásmicos a 9m |',
  ].join('\n'),
  encontros: [
    '| d100 | Evento / Encontro | Risco | Notas |',
    '| --- | --- | --- | --- |',
    '| 01-40 | Patrulha silenciosa nos trilhos | Baixo | Evitável com Furtividade DT 15 |',
    '| 41-85 | Sussurros da Fenda | Médio | Teste de Vontade DT 18 |',
    '| 86-100 | Aparição do Espreitador | Crítico | Inicia combate imediato |',
  ].join('\n'),
  npcs: [
    '| Nome | Afiliação | Papel | Relação com o Grupo |',
    '| --- | --- | --- | --- |',
    '| Helena K. | 3ª Divisão | Informante | Neutra / Desconfiada |',
  ].join('\n'),
};

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionInstanceLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export function RichChronicleEditor({
  value,
  onChange,
  unlockedRedactions = [],
  audioClips = [],
  onChangeAudioClips,
  placeholder = 'Escreva a lore, use @ para mencionar fichas ou páginas, e aplique Tarjas Pretas nos segredos...',
  minRows = 11,
}: RichChronicleEditorProps) {
  const entities = useChronicleStore((s) => s.entities);
  const characters = useChronicleStore((s) => s.characters);
  const showToast = useChronicleStore((s) => s.showToast);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstanceLike | null>(null);

  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [showTableMenu, setShowTableMenu] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showAudioAdder, setShowAudioAdder] = useState(false);
  const [isDictating, setIsDictating] = useState(false);

  const [clipTitle, setClipTitle] = useState('');
  const [clipUrl, setClipUrl] = useState('');
  const [clipStart, setClipStart] = useState(0);
  const [clipEnd, setClipEnd] = useState(30);

  const insertAtCursor = (snippet: string) => {
    const el = textareaRef.current;
    if (!el) {
      onChange(`${value}${value.endsWith('\n') || !value ? '' : ' '}${snippet}`);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = value.slice(0, start) + snippet + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + snippet.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const handleApplyRedaction = () => {
    const el = textareaRef.current;
    if (el && el.selectionStart !== el.selectionEnd) {
      const selected = value.slice(el.selectionStart, el.selectionEnd);
      const wrapped = createRedactionSyntax(selected);
      const next = value.slice(0, el.selectionStart) + wrapped + value.slice(el.selectionEnd);
      onChange(next);
      return;
    }
    insertAtCursor(createRedactionSyntax('Trecho confidencial censurado'));
  };

  const handleInsertSpoiler = () => {
    insertAtCursor('\n:::spoiler[Registro Oculto]\nEscreva o detalhe retrátil aqui...\n:::\n');
  };

  const toggleVoiceDictation = () => {
    if (isDictating && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsDictating(false);
      return;
    }

    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionInstanceLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionInstanceLike;
    };
    const SpeechCtor = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechCtor) {
      showToast('Ditado por voz não suportado neste navegador (use Chrome ou Edge).');
      return;
    }

    const rec = new SpeechCtor();
    rec.lang = 'pt-BR';
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (ev) => {
      let transcript = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        if (ev.results[i].isFinal) {
          transcript += ev.results[i][0].transcript + ' ';
        }
      }
      if (transcript.trim()) {
        insertAtCursor(transcript);
      }
    };
    rec.onerror = () => setIsDictating(false);
    rec.onend = () => setIsDictating(false);
    recognitionRef.current = rec;
    rec.start();
    setIsDictating(true);
    showToast('Microfone ativo: fale em português para transcrever na página.');
  };

  const mentionCandidates = [
    ...Object.values(characters).map((c) => ({
      type: 'character' as const,
      id: c.id,
      label: c.name,
      meta: `Ficha Live · ${c.className || 'Operador'} Nv.${c.level}`,
    })),
    ...Object.values(entities).map((e) => ({
      type: 'entity' as const,
      id: e.id,
      label: e.title,
      meta: `Atlas · ${e.customCategoryLabel || e.category}`,
    })),
  ].filter((item) => item.label.toLowerCase().includes(mentionQuery.toLowerCase()));

  const handleAddAudioClip = () => {
    if (!clipTitle.trim() || !clipUrl.trim() || !onChangeAudioClips) return;
    const nextClip: AudioClipBlock = {
      id: `clip_${Math.random().toString(36).slice(2, 8)}`,
      title: clipTitle.trim(),
      youtubeUrl: clipUrl.trim(),
      startSec: Math.max(0, Number(clipStart) || 0),
      endSec: Math.max(0, Number(clipEnd) || 0),
    };
    onChangeAudioClips([...audioClips, nextClip]);
    setClipTitle('');
    setClipUrl('');
    setShowAudioAdder(false);
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-[#10141a]">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 px-3 py-2 border-b border-zinc-800 bg-zinc-950 rounded-t-xl">
        <div className="flex flex-wrap items-center gap-1.5">
          {/* @Mention Picker */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowMentionMenu((p) => !p);
                setShowTableMenu(false);
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-zinc-900 border border-zinc-800 hover:border-cyan-500 text-zinc-100 transition-colors cursor-pointer"
              title="Citar Ficha do Omniscient Sheet ou Página da Wiki (@)"
            >
              <AtSign className="w-3.5 h-3.5 text-cyan-400" />
              <span>Mencionar</span>
            </button>

            {showMentionMenu && (
              <div className="absolute left-0 top-full mt-1.5 w-72 bg-zinc-900 border border-zinc-700 rounded-xl p-2 z-50">
                <input
                  type="text"
                  value={mentionQuery}
                  onChange={(e) => setMentionQuery(e.target.value)}
                  placeholder="Filtrar personagem ou página..."
                  autoFocus
                  className="w-full px-2.5 py-1.5 mb-1.5 text-xs rounded-md bg-zinc-950 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-cyan-500"
                />
                <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1">
                  {mentionCandidates.length === 0 ? (
                    <div className="text-xs text-zinc-500 px-2 py-2">Nenhum item encontrado.</div>
                  ) : (
                    mentionCandidates.slice(0, 20).map((cand) => (
                      <button
                        key={`${cand.type}-${cand.id}`}
                        type="button"
                        onClick={() => {
                          insertAtCursor(createMentionSyntax(cand.label, cand.type, cand.id));
                          setShowMentionMenu(false);
                          setMentionQuery('');
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-zinc-800 transition-colors cursor-pointer flex items-center justify-between gap-2"
                      >
                        <span className="text-xs font-semibold truncate">{cand.label}</span>
                        <span className="text-xs font-mono text-zinc-400 shrink-0">
                          {cand.type === 'character' ? 'Ficha' : 'Atlas'}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Tarja Preta */}
          <button
            type="button"
            onClick={handleApplyRedaction}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-zinc-900 border border-[#c94a4a]/45 hover:border-[#c94a4a] text-zinc-100 transition-colors cursor-pointer"
            title="Selecione um trecho do texto e clique para aplicar Tarja Preta censurada"
          >
            <FileLock2 className="w-3.5 h-3.5 text-red-400" />
            <span>Tarja Preta</span>
          </button>

          {/* Spoiler */}
          <button
            type="button"
            onClick={handleInsertSpoiler}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
          >
            <EyeOff className="w-3.5 h-3.5" />
            <span>Spoiler</span>
          </button>

          {/* Tabelas RPG */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowTableMenu((p) => !p);
                setShowMentionMenu(false);
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
            >
              <Table2 className="w-3.5 h-3.5" />
              <span>Tabela RPG</span>
            </button>
            {showTableMenu && (
              <div className="absolute left-0 top-full mt-1.5 w-52 bg-zinc-900 border border-zinc-700 rounded-xl p-1.5 z-50 space-y-1">
                {[
                  { key: 'atributos', label: 'Bloco de Atributos' },
                  { key: 'inventario', label: 'Tabela de Inventário / Relíquias' },
                  { key: 'encontros', label: 'Tabela de Encontros (d100)' },
                  { key: 'npcs', label: 'Relação de NPCs' },
                ].map((tpl) => (
                  <button
                    key={tpl.key}
                    type="button"
                    onClick={() => {
                      insertAtCursor(`\n${RPG_TABLE_TEMPLATES[tpl.key]}\n`);
                      setShowTableMenu(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 text-xs rounded-md hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    {tpl.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Fita K7 YouTube */}
          {onChangeAudioClips && (
            <button
              type="button"
              onClick={() => setShowAudioAdder((p) => !p)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-zinc-900 border border-zinc-800 hover:border-cyan-500 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
            >
              <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>Fita Áudio (YouTube)</span>
            </button>
          )}

          {/* Ditado por Voz */}
          <button
            type="button"
            onClick={toggleVoiceDictation}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
              isDictating
                ? 'bg-[#c94a4a]/20 border-[#c94a4a] text-zinc-100'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-100'
            }`}
            title="Ditar Lore por Voz (Português)"
          >
            {isDictating ? <MicOff className="w-3.5 h-3.5 text-red-400" /> : <Mic className="w-3.5 h-3.5" />}
            <span>{isDictating ? 'Ouvindo...' : 'Ditar'}</span>
          </button>
        </div>

        {/* Toggle Split Preview */}
        <button
          type="button"
          onClick={() => setShowPreview((p) => !p)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
            showPreview
              ? 'bg-cyan-600/20 border-cyan-500 text-cyan-300'
              : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-100'
          }`}
        >
          <Eye className="w-3.5 h-3.5" />
          <span>{showPreview ? 'Ocultar Prévia' : 'Prévia Lado a Lado'}</span>
        </button>
      </div>

      {/* Add YouTube Audio Clip Drawer */}
      {showAudioAdder && onChangeAudioClips && (
        <div className="p-3 bg-zinc-900 border-b border-zinc-800 space-y-2">
          <div className="text-xs font-semibold text-cyan-400">
            Anexar Fita K7 / Trecho de Áudio via YouTube (Zero Storage)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <input
              type="text"
              value={clipTitle}
              onChange={(e) => setClipTitle(e.target.value)}
              placeholder="Título (ex.: Fita #12 - Interrogatório)"
              className="sm:col-span-2 px-2.5 py-1.5 text-xs rounded-md bg-zinc-950 border border-zinc-800 text-zinc-100"
            />
            <input
              type="text"
              value={clipUrl}
              onChange={(e) => setClipUrl(e.target.value)}
              placeholder="Link do YouTube..."
              className="sm:col-span-2 px-2.5 py-1.5 text-xs rounded-md bg-zinc-950 border border-zinc-800 text-zinc-100"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs">
              <label className="text-zinc-400">Início (seg):</label>
              <input
                type="number"
                min={0}
                value={clipStart}
                onChange={(e) => setClipStart(Number(e.target.value))}
                className="w-20 px-2 py-1 rounded bg-zinc-950 border border-zinc-800 font-mono"
              />
              <label className="text-zinc-400">Fim (seg):</label>
              <input
                type="number"
                min={0}
                value={clipEnd}
                onChange={(e) => setClipEnd(Number(e.target.value))}
                className="w-20 px-2 py-1 rounded bg-zinc-950 border border-zinc-800 font-mono"
              />
            </div>
            <button
              type="button"
              onClick={handleAddAudioClip}
              className="flex items-center gap-1 px-3 py-1 rounded-md text-xs font-semibold bg-cyan-600 text-[#0b0d10] hover:bg-cyan-500 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Anexar Fita</span>
            </button>
          </div>
        </div>
      )}

      {/* Editor Body (+ Optional Split Preview) */}
      <div className={showPreview ? 'grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[#222834]' : ''}>
        <textarea
          ref={textareaRef}
          rows={minRows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full p-3.5 bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none resize-y font-sans leading-relaxed"
        />
        {showPreview && (
          <div className="p-3.5 bg-zinc-900/60 max-h-[380px] overflow-y-auto custom-scrollbar">
            <div className="text-xs font-mono uppercase text-zinc-500 mb-2">
              Prévia Interativa
            </div>
            <RichChronicleRenderer
              content={value}
              unlockedRedactions={unlockedRedactions}
              audioClips={audioClips}
            />
          </div>
        )}
      </div>

      {/* Attached Audio Clips List in Editor */}
      {audioClips.length > 0 && onChangeAudioClips && (
        <div className="px-3.5 py-2.5 border-t border-zinc-800 bg-zinc-950/70 flex flex-wrap gap-2 rounded-b-xl">
          {audioClips.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-xs"
            >
              <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
              <span className="font-medium">{c.title}</span>
              <span className="font-mono text-zinc-400">
                ({c.startSec}s-{c.endSec}s)
              </span>
              <button
                type="button"
                onClick={() => onChangeAudioClips(audioClips.filter((x) => x.id !== c.id))}
                className="text-zinc-400 hover:text-red-400 cursor-pointer"
                title="Remover fita"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
