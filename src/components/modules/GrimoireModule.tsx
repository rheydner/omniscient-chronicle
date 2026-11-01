'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  BookMarked,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Library,
  Maximize2,
  Minimize2,
  Plus,
  Save,
  Search,
  Trash2,
} from 'lucide-react';
import { useChronicleStore, useEffectiveGM } from '@/store/useChronicleStore';
import { useConfirmStore } from '@/store/useConfirmStore';
import { deleteBook, saveBook } from '@/lib/chronicle-actions';
import { RichChronicleRenderer } from '@/components/shared/RichChronicleRenderer';
import { RichChronicleEditor } from '@/components/shared/RichChronicleEditor';
import type { BookChapter, GlossaryTerm, GrimoireBook } from '@/types/chronicle';

export function GrimoireModule() {
  const isGM = useEffectiveGM();
  const roomId = useChronicleStore((s) => s.roomId);
  const userUid = useChronicleStore((s) => s.userUid);
  const books = useChronicleStore((s) => s.books);
  const selectedBookId = useChronicleStore((s) => s.selectedBookId);
  const setSelectedBookId = useChronicleStore((s) => s.setSelectedBookId);
  const showToast = useChronicleStore((s) => s.showToast);

  const [chapterIdx, setChapterIdx] = useState(0);
  const [readerTheme, setReaderTheme] = useState<'dark' | 'sepia' | 'light'>('dark');
  const [measureWidth, setMeasureWidth] = useState<'narrow' | 'normal' | 'wide'>('normal');
  const [fontScale, setFontScale] = useState<'sm' | 'base' | 'lg'>('base');
  const [focusMode, setFocusMode] = useState(false);

  // Glossary filter & adder
  const [glossaryQuery, setGlossaryQuery] = useState('');
  const [newTerm, setNewTerm] = useState('');
  const [newTermCat, setNewTermCat] = useState('Regra');
  const [newTermDef, setNewTermDef] = useState('');

  // Chapter Editor (GM)
  const [isEditingChapter, setIsEditingChapter] = useState(false);
  const [chapterDraft, setChapterDraft] = useState<BookChapter | null>(null);

  // Personal Reader Margin Note (stored per user + chapter in localStorage)
  const [marginNote, setMarginNote] = useState('');

  const visibleBooks = useMemo(
    () =>
      Object.values(books)
        .filter((b) => isGM || b.isPublicToPlayers)
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [books, isGM]
  );

  const activeBook = useMemo(() => {
    if (selectedBookId && books[selectedBookId]) {
      const b = books[selectedBookId];
      if (isGM || b.isPublicToPlayers) return b;
    }
    return visibleBooks[0] || null;
  }, [selectedBookId, books, isGM, visibleBooks]);

  const sortedChapters = useMemo(
    () =>
      activeBook ? [...activeBook.chapters].sort((a, b) => a.order - b.order) : [],
    [activeBook]
  );

  const safeIdx = Math.max(0, Math.min(sortedChapters.length - 1, chapterIdx));
  const activeChapter = sortedChapters[safeIdx] || null;

  const noteStorageKey =
    activeBook && activeChapter
      ? `chronicle_note_${userUid || 'anon'}_${activeBook.id}_${activeChapter.id}`
      : null;

  useEffect(() => {
    if (!noteStorageKey || typeof window === 'undefined') {
      setMarginNote('');
      return;
    }
    setMarginNote(window.localStorage.getItem(noteStorageKey) || '');
  }, [noteStorageKey]);

  const handleSaveMarginNote = (val: string) => {
    setMarginNote(val);
    if (noteStorageKey && typeof window !== 'undefined') {
      window.localStorage.setItem(noteStorageKey, val);
    }
  };

  const handleCreateBook = async () => {
    const bk: GrimoireBook = {
      id: `bk_${crypto.randomUUID().slice(0, 8)}`,
      title: 'Novo Tomo / Manual de Sistema',
      subtitle: 'Compêndio de regras, rituais e lore',
      author: 'Arquivo Central',
      accentColor: '#06b6d4',
      isPublicToPlayers: true,
      chapters: [
        {
          id: `ch_${Date.now()}`,
          title: 'I. Introdução',
          order: 1,
          content: 'Escreva o conteúdo paginado deste capítulo...',
          unlockedRedactions: [],
        },
      ],
      glossary: [],
      updatedAt: Date.now(),
    };
    await saveBook(roomId, bk);
    setSelectedBookId(bk.id);
    setChapterIdx(0);
    showToast('Novo livro adicionado ao Grimório.');
  };

  const handleAddChapter = async () => {
    if (!activeBook) return;
    const nextOrder = sortedChapters.length + 1;
    const ch: BookChapter = {
      id: `ch_${crypto.randomUUID().slice(0, 7)}`,
      title: `Capítulo ${nextOrder}`,
      order: nextOrder,
      content: 'Novo capítulo...',
      unlockedRedactions: [],
    };
    await saveBook(roomId, {
      ...activeBook,
      chapters: [...activeBook.chapters, ch],
    });
    setChapterIdx(sortedChapters.length);
    setChapterDraft(ch);
    setIsEditingChapter(true);
  };

  const handleSaveChapterDraft = async () => {
    if (!activeBook || !chapterDraft) return;
    const updated = activeBook.chapters.map((c) =>
      c.id === chapterDraft.id ? chapterDraft : c
    );
    await saveBook(roomId, { ...activeBook, chapters: updated });
    setIsEditingChapter(false);
    setChapterDraft(null);
    showToast('Capítulo salvo.');
  };

  const handleAddGlossaryTerm = async () => {
    if (!activeBook || !newTerm.trim() || !newTermDef.trim()) return;
    const term: GlossaryTerm = {
      id: `gl_${crypto.randomUUID().slice(0, 7)}`,
      term: newTerm.trim(),
      category: newTermCat.trim() || 'Regra',
      definition: newTermDef.trim(),
    };
    await saveBook(roomId, {
      ...activeBook,
      glossary: [...activeBook.glossary, term],
    });
    setNewTerm('');
    setNewTermDef('');
    showToast('Verbete adicionado ao Glossário.');
  };

  const filteredGlossary = useMemo(() => {
    if (!activeBook) return [];
    const q = glossaryQuery.trim().toLowerCase();
    if (!q) return activeBook.glossary;
    return activeBook.glossary.filter(
      (g) =>
        g.term.toLowerCase().includes(q) ||
        g.definition.toLowerCase().includes(q) ||
        g.category.toLowerCase().includes(q)
    );
  }, [activeBook, glossaryQuery]);

  const measureClass =
    measureWidth === 'narrow'
      ? 'max-w-xl'
      : measureWidth === 'wide'
      ? 'max-w-4xl'
      : 'max-w-2xl';

  const scaleClass =
    fontScale === 'sm' ? 'text-xs' : fontScale === 'lg' ? 'text-base' : 'text-sm';

  return (
    <div className="flex flex-col lg:flex-row h-full min-h-0 bg-zinc-950">
      {/* Left Books & Chapters TOC */}
      {!focusMode && (
        <aside className="w-full lg:w-72 shrink-0 border-b lg:border-b-0 lg:border-r border-zinc-800 bg-zinc-950 flex flex-col max-h-[34vh] lg:max-h-none">
          <div className="p-3.5 border-b border-zinc-800 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Library className="w-4 h-4 text-cyan-400" />
                <h2 className="text-sm font-bold text-zinc-100">Grimório & Tomos</h2>
              </div>
              {isGM && (
                <button
                  type="button"
                  onClick={handleCreateBook}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-600 text-[#0b0d10] font-semibold text-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Livro</span>
                </button>
              )}
            </div>

            {visibleBooks.length > 0 && (
              <select
                value={activeBook?.id || ''}
                onChange={(e) => {
                  setSelectedBookId(e.target.value);
                  setChapterIdx(0);
                  setIsEditingChapter(false);
                }}
                className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100"
              >
                {visibleBooks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title}
                  </option>
                ))}
              </select>
            )}
          </div>

          {activeBook && (
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2.5 space-y-1">
              <div className="flex items-center justify-between px-2 py-1">
                <span className="text-[11px] font-mono uppercase text-zinc-500">Sumário</span>
                {isGM && (
                  <button
                    type="button"
                    onClick={handleAddChapter}
                    className="text-xs text-cyan-400 hover:underline cursor-pointer"
                  >
                    + Capítulo
                  </button>
                )}
              </div>
              {sortedChapters.map((ch, idx) => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => {
                    setChapterIdx(idx);
                    setIsEditingChapter(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
                    idx === safeIdx
                      ? 'bg-zinc-800 text-cyan-400 font-semibold border border-zinc-700'
                      : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100'
                  }`}
                >
                  {ch.title}
                </button>
              ))}

              {isGM && (
                <div className="pt-4 mt-4 border-t border-zinc-800 px-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() =>
                      saveBook(roomId, {
                        ...activeBook,
                        isPublicToPlayers: !activeBook.isPublicToPlayers,
                      })
                    }
                    className="text-xs text-zinc-400 hover:text-zinc-100 cursor-pointer"
                  >
                    {activeBook.isPublicToPlayers ? 'Livro Público' : 'Livro Oculto (GM)'}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const confirmed = await useConfirmStore.getState().ask({
                        title: 'Excluir Tomo do Grimório',
                        message: `Deseja realmente excluir o livro "${activeBook.title}"? Todos os capítulos e anotações registrados nele serão removidos.`,
                        confirmLabel: 'Excluir Tomo',
                        cancelLabel: 'Cancelar',
                        variant: 'danger',
                      });
                      if (!confirmed) return;
                      await deleteBook(roomId, activeBook.id);
                      setSelectedBookId(null);
                    }}
                    className="text-xs text-zinc-500 hover:text-red-400 cursor-pointer"
                  >
                    Excluir Tomo
                  </button>
                </div>
              )}
            </div>
          )}
        </aside>
      )}

      {/* Center Paginated Book Reader */}
      <main className="flex-1 flex flex-col min-h-0">
        {/* Reader Controls Strip */}
        {activeBook && (
          <div className="px-4 py-2 border-b border-zinc-800 bg-zinc-950 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              {(['dark', 'sepia', 'light'] as const).map((th) => (
                <button
                  key={th}
                  type="button"
                  onClick={() => setReaderTheme(th)}
                  className={`px-2.5 py-1 rounded text-xs cursor-pointer ${
                    readerTheme === th
                      ? 'bg-zinc-800 text-cyan-400 border border-zinc-700'
                      : 'text-zinc-400'
                  }`}
                >
                  {th === 'dark' ? 'Noturno' : th === 'sepia' ? 'Sépia' : 'Papel Claro'}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg px-1.5 py-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setFontScale('sm')}
                  className={`px-1.5 cursor-pointer ${
                    fontScale === 'sm' ? 'text-cyan-400 font-bold' : 'text-zinc-400'
                  }`}
                >
                  A-
                </button>
                <button
                  type="button"
                  onClick={() => setFontScale('base')}
                  className={`px-1.5 cursor-pointer ${
                    fontScale === 'base' ? 'text-cyan-400 font-bold' : 'text-zinc-400'
                  }`}
                >
                  A
                </button>
                <button
                  type="button"
                  onClick={() => setFontScale('lg')}
                  className={`px-1.5 cursor-pointer ${
                    fontScale === 'lg' ? 'text-cyan-400 font-bold' : 'text-zinc-400'
                  }`}
                >
                  A+
                </button>
              </div>

              <select
                value={measureWidth}
                onChange={(e) =>
                  setMeasureWidth(e.target.value as 'narrow' | 'normal' | 'wide')
                }
                className="px-2 py-1 text-xs rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100"
              >
                <option value="narrow">Coluna Estreita</option>
                <option value="normal">Coluna Editorial</option>
                <option value="wide">Coluna Larga</option>
              </select>

              <button
                type="button"
                onClick={() => setFocusMode((f) => !f)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 cursor-pointer"
              >
                {focusMode ? (
                  <>
                    <Minimize2 className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Sair do Foco</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Modo Foco</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 lg:p-8">
          {!activeBook ? (
            <div className="max-w-md mx-auto my-16 p-6 rounded-xl bg-zinc-900 border border-zinc-800 text-center space-y-3">
              <BookMarked className="w-8 h-8 text-cyan-400 mx-auto" />
              <h3 className="text-base font-bold text-zinc-100">Grimório & Regras</h3>
              <p className="text-xs text-zinc-400">
                Publique livros in-universe, tratados ocultistas ou o manual de regras do seu
                sistema com glossário lateral integrado.
              </p>
            </div>
          ) : isEditingChapter && chapterDraft ? (
            <div className="max-w-3xl mx-auto space-y-4">
              <div className="flex items-center justify-between gap-2">
                <input
                  type="text"
                  value={chapterDraft.title}
                  onChange={(e) =>
                    setChapterDraft({ ...chapterDraft, title: e.target.value })
                  }
                  className="flex-1 px-3 py-2 text-sm font-bold rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100"
                />
                <button
                  type="button"
                  onClick={() => setIsEditingChapter(false)}
                  className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-400 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveChapterDraft}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-600 text-[#0b0d10] font-semibold text-xs cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Salvar Capítulo</span>
                </button>
              </div>
              <RichChronicleEditor
                value={chapterDraft.content}
                onChange={(content) => setChapterDraft({ ...chapterDraft, content })}
                unlockedRedactions={chapterDraft.unlockedRedactions}
                minRows={15}
              />
            </div>
          ) : (
            activeChapter && (
              <div className={`${measureClass} mx-auto space-y-5`}>
                {/* Page Surface */}
                <article
                  className={`rounded-xl border p-6 sm:p-10 ${scaleClass} ${
                    readerTheme === 'sepia'
                      ? 'bg-[#f3ead6] text-[#221b13] border-[#cbb894] font-sans'
                      : readerTheme === 'light'
                      ? 'bg-[#f4f3ef] text-[#181a1f] border-[#d5d2c8] font-sans'
                      : 'bg-zinc-900 text-zinc-100 border-zinc-800 font-sans'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 pb-4 mb-6 border-b border-current/15">
                    <div>
                      <div className="text-xs font-mono uppercase opacity-70">
                        {activeBook.title} · Cap. {safeIdx + 1}/{sortedChapters.length}
                      </div>
                      <h1 className="text-2xl sm:text-3xl font-bold mt-1">
                        {activeChapter.title}
                      </h1>
                    </div>
                    {isGM && (
                      <button
                        type="button"
                        onClick={() => {
                          setChapterDraft({ ...activeChapter });
                          setIsEditingChapter(true);
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded bg-black/15 text-xs font-sans cursor-pointer shrink-0"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Editar</span>
                      </button>
                    )}
                  </div>

                  <RichChronicleRenderer
                    content={activeChapter.content}
                    unlockedRedactions={activeChapter.unlockedRedactions}
                    paperTheme={readerTheme === 'dark' ? 'dark-dossier' : 'sepia-parchment'}
                    onToggleRedaction={async (rid) => {
                      const set = new Set(activeChapter.unlockedRedactions || []);
                      if (set.has(rid)) set.delete(rid);
                      else set.add(rid);
                      const updated = activeBook.chapters.map((c) =>
                        c.id === activeChapter.id
                          ? { ...c, unlockedRedactions: Array.from(set) }
                          : c
                      );
                      await saveBook(roomId, { ...activeBook, chapters: updated });
                    }}
                  />

                  {/* Chapter Pagination Footer */}
                  <div className="mt-8 pt-4 border-t border-current/15 flex items-center justify-between font-sans text-xs">
                    <button
                      type="button"
                      disabled={safeIdx === 0}
                      onClick={() => setChapterIdx((i) => Math.max(0, i - 1))}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-current/20 disabled:opacity-35 cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>Anterior</span>
                    </button>
                    <span className="font-mono opacity-65">
                      Página {safeIdx + 1} de {sortedChapters.length}
                    </span>
                    <button
                      type="button"
                      disabled={safeIdx >= sortedChapters.length - 1}
                      onClick={() =>
                        setChapterIdx((i) => Math.min(sortedChapters.length - 1, i + 1))
                      }
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-current/20 disabled:opacity-35 cursor-pointer"
                    >
                      <span>Próximo</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </article>

                {/* Personal Margin Note */}
                <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-1.5">
                  <div className="text-xs font-mono uppercase text-zinc-400">
                    Suas Notas Pessoais de Margem neste Capítulo (Salvas Localmente)
                  </div>
                  <textarea
                    rows={2}
                    value={marginNote}
                    onChange={(e) => handleSaveMarginNote(e.target.value)}
                    placeholder="Anote lembretes de regra, pistas ou dúvidas sobre este capítulo..."
                    className="w-full p-2.5 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
            )
          )}
        </div>
      </main>

      {/* Right Side Live Glossary */}
      {!focusMode && activeBook && (
        <aside className="w-full lg:w-76 shrink-0 border-t lg:border-t-0 lg:border-l border-zinc-800 bg-zinc-950 flex flex-col max-h-[34vh] lg:max-h-none">
          <div className="p-3.5 border-b border-zinc-800 space-y-2">
            <div className="text-xs font-bold text-zinc-100">
              Glossário Rápido ({activeBook.glossary.length})
            </div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={glossaryQuery}
                onChange={(e) => setGlossaryQuery(e.target.value)}
                placeholder="Filtrar termo ou regra..."
                className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
            {filteredGlossary.map((g) => (
              <div
                key={g.id}
                className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-cyan-400">{g.term}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-mono text-zinc-500">{g.category}</span>
                    {isGM && (
                      <button
                        type="button"
                        onClick={() =>
                          saveBook(roomId, {
                            ...activeBook,
                            glossary: activeBook.glossary.filter((x) => x.id !== g.id),
                          })
                        }
                        className="text-zinc-500 hover:text-red-400 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">{g.definition}</p>
              </div>
            ))}
          </div>

          {isGM && (
            <div className="p-3 border-t border-zinc-800 bg-zinc-900 space-y-1.5">
              <div className="text-[11px] font-semibold text-zinc-100">+ Novo Verbete</div>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={newTerm}
                  onChange={(e) => setNewTerm(e.target.value)}
                  placeholder="Termo"
                  className="flex-1 px-2 py-1 text-xs rounded bg-zinc-950 border border-zinc-800"
                />
                <input
                  type="text"
                  value={newTermCat}
                  onChange={(e) => setNewTermCat(e.target.value)}
                  placeholder="Tipo"
                  className="w-20 px-2 py-1 text-xs rounded bg-zinc-950 border border-zinc-800"
                />
              </div>
              <textarea
                rows={2}
                value={newTermDef}
                onChange={(e) => setNewTermDef(e.target.value)}
                placeholder="Definição..."
                className="w-full px-2 py-1 text-xs rounded bg-zinc-950 border border-zinc-800"
              />
              <button
                type="button"
                onClick={handleAddGlossaryTerm}
                className="w-full py-1 rounded bg-cyan-600 text-[#0b0d10] font-semibold text-xs cursor-pointer"
              >
                Adicionar ao Glossário
              </button>
            </div>
          )}
        </aside>
      )}
    </div>
  );
}
