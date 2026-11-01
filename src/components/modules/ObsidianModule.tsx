'use client';

import React, { useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileCode2,
  FileLock2,
  FolderSync,
  Link2,
  Upload,
} from 'lucide-react';
import { useChronicleStore, useEffectiveGM } from '@/store/useChronicleStore';
import { saveEntity, saveFolder } from '@/lib/chronicle-actions';
import {
  exportEntityToObsidianMarkdown,
  extractRedactions,
  parseObsidianNoteFile,
  resolveObsidianWikiLinks,
  type ObsidianImportedNote,
} from '@/lib/markdown-engine';
import type { ChronicleEntity, ChronicleFolder } from '@/types/chronicle';

export function ObsidianModule() {
  const isGM = useEffectiveGM();
  const roomId = useChronicleStore((s) => s.roomId);
  const entities = useChronicleStore((s) => s.entities);
  const folders = useChronicleStore((s) => s.folders);
  const characters = useChronicleStore((s) => s.characters);
  const setActiveTab = useChronicleStore((s) => s.setActiveTab);
  const showToast = useChronicleStore((s) => s.showToast);

  const [stagedNotes, setStagedNotes] = useState<ObsidianImportedNote[]>([]);
  const [importAsPublic, setImportAsPublic] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const handleFilesSelected = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const parsed: ObsidianImportedNote[] = [];

    for (const file of Array.from(fileList)) {
      if (!file.name.toLowerCase().endsWith('.md')) continue;
      const text = await file.text();
      const relPath = (file as unknown as { webkitRelativePath?: string }).webkitRelativePath || '';
      const pathParts = relPath.split('/').filter(Boolean);
      const folderName = pathParts.length >= 2 ? pathParts[pathParts.length - 2] : null;
      parsed.push(parseObsidianNoteFile(file.name, text, folderName));
    }

    setStagedNotes(parsed);
    if (parsed.length === 0) {
      showToast('Nenhum arquivo Markdown (.md) detectado na seleção.');
    } else {
      showToast(`${parsed.length} nota(s) do Obsidian pronta(s) para sincronização.`);
    }
  };

  const handleCommitImport = async () => {
    if (!stagedNotes.length) return;
    setIsImporting(true);
    try {
      const now = Date.now();
      const existingFolders = Object.values(folders).filter((f) => f.scope === 'wiki');
      const folderByName = new Map<string, ChronicleFolder>();
      existingFolders.forEach((f) => folderByName.set(f.name.toLowerCase(), f));

      // Pass 1: Create missing folders & draft ChronicleEntities with stable IDs
      const draftEntities: Array<{ entity: ChronicleEntity; rawBody: string }> = [];

      for (const note of stagedNotes) {
        let folderId: string | null = null;
        if (note.folderName) {
          const key = note.folderName.toLowerCase();
          let fld = folderByName.get(key);
          if (!fld) {
            fld = {
              id: `fld_${crypto.randomUUID().slice(0, 8)}`,
              name: note.folderName,
              scope: 'wiki',
              parentId: null,
              order: folderByName.size + 1,
              createdAt: now,
            };
            await saveFolder(roomId, fld);
            folderByName.set(key, fld);
          }
          folderId = fld.id;
        }

        // Reuse existing entity ID if title matches case-insensitively
        const existingMatch = Object.values(entities).find(
          (e) => e.title.trim().toLowerCase() === note.title.trim().toLowerCase()
        );

        const ent: ChronicleEntity = {
          id: existingMatch ? existingMatch.id : `ent_${crypto.randomUUID().slice(0, 8)}`,
          title: note.title,
          subtitle: existingMatch?.subtitle || 'Importado via Ponte Obsidian',
          category: note.category,
          folderId: folderId ?? existingMatch?.folderId ?? null,
          tags: note.tags.length > 0 ? note.tags : existingMatch?.tags || ['obsidian'],
          content: note.rawBody,
          unlockedRedactions: existingMatch?.unlockedRedactions || [],
          customFields: existingMatch?.customFields || [],
          audioClips: existingMatch?.audioClips || [],
          isPublicToPlayers: importAsPublic,
          updatedAt: now,
          createdAt: existingMatch?.createdAt || now,
        };

        draftEntities.push({ entity: ent, rawBody: note.rawBody });
      }

      // Pass 2: Resolve all [[WikiLinks]] across existing + newly imported notes + live Sheet characters
      const combinedPool: ChronicleEntity[] = [
        ...Object.values(entities),
        ...draftEntities.map((d) => d.entity),
      ];
      const charPool = Object.values(characters);

      for (const item of draftEntities) {
        const resolvedContent = resolveObsidianWikiLinks(
          item.rawBody,
          combinedPool,
          charPool
        );
        await saveEntity(roomId, {
          ...item.entity,
          content: resolvedContent,
        });
      }

      showToast(
        `${draftEntities.length} nota(s) do Obsidian importada(s) com WikiLinks e Tarjas convertidas!`
      );
      setStagedNotes([]);
      setActiveTab('wiki');
    } catch (err) {
      console.error(err);
      showToast('Erro durante a importação das notas do Obsidian.');
    } finally {
      setIsImporting(false);
    }
  };

  const triggerDownload = (fileName: string, content: string) => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportSingle = (ent: ChronicleEntity) => {
    const { fileName, markdown } = exportEntityToObsidianMarkdown(ent, entities, characters);
    triggerDownload(fileName, markdown);
  };

  const handleExportVaultBundle = () => {
    const list = Object.values(entities).filter((e) => isGM || e.isPublicToPlayers);
    if (list.length === 0) {
      showToast('Nenhuma página disponível para exportar.');
      return;
    }
    const sections = list.map((ent) => {
      const { fileName, markdown } = exportEntityToObsidianMarkdown(ent, entities, characters);
      return `<!-- ARQUIVO: ${fileName} -->\n${markdown}`;
    });
    triggerDownload(
      `omniscient-chronicle-vault-${new Date().toISOString().slice(0, 10)}.md`,
      sections.join('\n\n========================================\n\n')
    );
    showToast(`${list.length} página(s) exportada(s) no formato Obsidian Markdown.`);
  };

  const visibleEntities = Object.values(entities).filter((e) => isGM || e.isPublicToPlayers);

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-5 lg:p-8 bg-zinc-950">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-2 text-xs font-mono uppercase text-cyan-400">
            <FolderSync className="w-3.5 h-3.5" />
            <span>Ponte Bidirecional · Obsidian Vault (.md)</span>
          </div>
          <h1 className="text-2xl font-bold font-sans text-zinc-100 mt-1">
            Sincronização de Notas Markdown, WikiLinks & Segredos
          </h1>
          <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
            Importe seus arquivos <code className="text-zinc-100">.md</code> do Obsidian: os links{' '}
            <code className="text-cyan-400">[[Página]]</code> viram conexões vivas no Atlas e no
            Grafo (incluindo fichas do Omniscient Sheet com mesmo nome), e comentários{' '}
            <code className="text-red-400">%%segredo%%</code> tornam-se automaticamente Tarjas
            Pretas trancadas.
          </p>
        </header>

        {/* Importer Section (GM Only) */}
        {isGM && (
          <section className="p-5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-zinc-100">
                  Importar Notas do Seu Cofre Obsidian
                </h2>
                <p className="text-xs text-zinc-400">
                  Selecione múltiplos arquivos .md para converter frontmatter YAML, tags, links e
                  tarjas.
                </p>
              </div>
              <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-[#0b0d10] font-semibold text-xs transition-colors cursor-pointer">
                <Upload className="w-4 h-4" />
                <span>Selecionar Arquivos .md</span>
                <input
                  type="file"
                  accept=".md,text/markdown"
                  multiple
                  className="hidden"
                  onChange={(e) => void handleFilesSelected(e.target.files)}
                />
              </label>
            </div>

            {stagedNotes.length > 0 && (
              <div className="space-y-3 pt-3 border-t border-zinc-800">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-mono text-cyan-400">
                    {stagedNotes.length} arquivo(s) analisado(s) e pronto(s):
                  </span>
                  <label className="flex items-center gap-2 text-xs text-zinc-100 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={importAsPublic}
                      onChange={(e) => setImportAsPublic(e.target.checked)}
                    />
                    <span>Publicar imediatamente para os jogadores (Tarjas seguem trancadas)</span>
                  </label>
                </div>

                <div className="space-y-1.5 max-h-60 overflow-y-auto custom-scrollbar">
                  {stagedNotes.map((n, idx) => {
                    const redactionsCount = extractRedactions(n.rawBody).length;
                    return (
                      <div
                        key={idx}
                        className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FileCode2 className="w-4 h-4 text-cyan-400 shrink-0" />
                          <span className="font-semibold text-zinc-100 truncate">{n.title}</span>
                          {n.folderName && (
                            <span className="text-[11px] font-mono text-zinc-500">
                              /{n.folderName}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 font-mono text-[11px]">
                          <span className="inline-flex items-center gap-1 text-cyan-400">
                            <Link2 className="w-3 h-3" />
                            {n.unresolvedWikiLinks.length} [[links]]
                          </span>
                          <span className="inline-flex items-center gap-1 text-red-300">
                            <FileLock2 className="w-3 h-3" />
                            {redactionsCount} tarja(s)
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setStagedNotes([])}
                    className="px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-400 cursor-pointer"
                  >
                    Limpar Lista
                  </button>
                  <button
                    type="button"
                    disabled={isImporting}
                    onClick={handleCommitImport}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-cyan-600 text-[#0b0d10] font-semibold text-xs cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {isImporting ? 'Sincronizando no Firestore...' : 'Confirmar Importação'}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Exporter Section */}
        <section className="p-5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-zinc-100">
                Exportar Atlas de Volta para Sintaxe Obsidian (.md)
              </h2>
              <p className="text-xs text-zinc-400">
                Converte @Menções em <code className="text-zinc-100">[[WikiLinks]]</code>, gera
                frontmatter YAML e preserva segredos trancados em{' '}
                <code className="text-zinc-100">%%comentários%%</code>.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportVaultBundle}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-800 border border-zinc-700 hover:border-cyan-500 text-xs font-semibold text-zinc-100 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Baixar Compilado Completo (.md)</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto custom-scrollbar">
            {visibleEntities.map((ent) => (
              <div
                key={ent.id}
                className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs"
              >
                <span className="font-semibold text-zinc-100 truncate">{ent.title}</span>
                <button
                  type="button"
                  onClick={() => handleExportSingle(ent)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded bg-zinc-900 border border-zinc-800 hover:border-cyan-500 text-zinc-400 hover:text-zinc-100 shrink-0 cursor-pointer"
                >
                  <Download className="w-3 h-3 text-cyan-400" />
                  <span>.md</span>
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
