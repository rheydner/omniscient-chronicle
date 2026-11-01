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
    <div className="h-full overflow-y-auto custom-scrollbar p-5 lg:p-8 bg-[#0b0d10]">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="pb-4 border-b border-[#222834]">
          <div className="flex items-center gap-2 text-xs font-mono uppercase text-[#d4a359]">
            <FolderSync className="w-3.5 h-3.5" />
            <span>Ponte Bidirecional · Obsidian Vault (.md)</span>
          </div>
          <h1 className="text-2xl font-bold font-editorial text-[#ece8df] mt-1">
            Sincronização de Notas Markdown, WikiLinks & Segredos
          </h1>
          <p className="text-xs text-[#a5a095] mt-1 leading-relaxed">
            Importe seus arquivos <code className="text-[#ece8df]">.md</code> do Obsidian: os links{' '}
            <code className="text-[#d4a359]">[[Página]]</code> viram conexões vivas no Atlas e no
            Grafo (incluindo fichas do Omniscient Sheet com mesmo nome), e comentários{' '}
            <code className="text-[#c94a4a]">%%segredo%%</code> tornam-se automaticamente Tarjas
            Pretas trancadas.
          </p>
        </header>

        {/* Importer Section (GM Only) */}
        {isGM && (
          <section className="p-5 rounded-xl bg-[#13171e] border border-[#222834] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-[#ece8df]">
                  Importar Notas do Seu Cofre Obsidian
                </h2>
                <p className="text-xs text-[#a5a095]">
                  Selecione múltiplos arquivos .md para converter frontmatter YAML, tags, links e
                  tarjas.
                </p>
              </div>
              <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#d4a359] hover:bg-[#e2b56e] text-[#0b0d10] font-semibold text-xs transition-colors cursor-pointer">
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
              <div className="space-y-3 pt-3 border-t border-[#222834]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-mono text-[#d4a359]">
                    {stagedNotes.length} arquivo(s) analisado(s) e pronto(s):
                  </span>
                  <label className="flex items-center gap-2 text-xs text-[#ece8df] cursor-pointer">
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
                        className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#0e1116] border border-[#222834] text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FileCode2 className="w-4 h-4 text-[#d4a359] shrink-0" />
                          <span className="font-semibold text-[#ece8df] truncate">{n.title}</span>
                          {n.folderName && (
                            <span className="text-[11px] font-mono text-[#6f6b62]">
                              /{n.folderName}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 font-mono text-[11px]">
                          <span className="inline-flex items-center gap-1 text-[#4fa3b8]">
                            <Link2 className="w-3 h-3" />
                            {n.unresolvedWikiLinks.length} [[links]]
                          </span>
                          <span className="inline-flex items-center gap-1 text-[#e07b7b]">
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
                    className="px-3 py-1.5 rounded-lg bg-[#0e1116] border border-[#222834] text-xs text-[#a5a095] cursor-pointer"
                  >
                    Limpar Lista
                  </button>
                  <button
                    type="button"
                    disabled={isImporting}
                    onClick={handleCommitImport}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#4fa3b8] text-[#0b0d10] font-semibold text-xs cursor-pointer"
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
        <section className="p-5 rounded-xl bg-[#13171e] border border-[#222834] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-[#ece8df]">
                Exportar Atlas de Volta para Sintaxe Obsidian (.md)
              </h2>
              <p className="text-xs text-[#a5a095]">
                Converte @Menções em <code className="text-[#ece8df]">[[WikiLinks]]</code>, gera
                frontmatter YAML e preserva segredos trancados em{' '}
                <code className="text-[#ece8df]">%%comentários%%</code>.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportVaultBundle}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#191e27] border border-[#313a4b] hover:border-[#d4a359] text-xs font-semibold text-[#ece8df] cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#d4a359]" />
              <span>Baixar Compilado Completo (.md)</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto custom-scrollbar">
            {visibleEntities.map((ent) => (
              <div
                key={ent.id}
                className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#0e1116] border border-[#222834] text-xs"
              >
                <span className="font-semibold text-[#ece8df] truncate">{ent.title}</span>
                <button
                  type="button"
                  onClick={() => handleExportSingle(ent)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[#13171e] border border-[#222834] hover:border-[#d4a359] text-[#a5a095] hover:text-[#ece8df] shrink-0 cursor-pointer"
                >
                  <Download className="w-3 h-3 text-[#d4a359]" />
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
