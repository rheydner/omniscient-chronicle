import type { ChronicleEntity, CharacterSummary, EntityCategory } from '@/types/chronicle';

export interface ParsedMention {
  label: string;
  targetType: 'entity' | 'character';
  targetId: string;
}

export interface ParsedRedaction {
  id: string;
  secretText: string;
}

const MENTION_REGEX = /@\[([^\]]+)\]\((entity|character):([A-Za-z0-9_-]+)\)/g;
const REDACTION_REGEX = /\[\[TARJA:([A-Za-z0-9_-]+)\|([^\]]+)\]\]/g;

export function extractMentions(content: string): ParsedMention[] {
  if (!content) return [];
  const results: ParsedMention[] = [];
  const seen = new Set<string>();
  for (const match of content.matchAll(MENTION_REGEX)) {
    const label = match[1];
    const targetType = match[2] as 'entity' | 'character';
    const targetId = match[3];
    const key = `${targetType}:${targetId}`;
    if (!seen.has(key)) {
      seen.add(key);
      results.push({ label, targetType, targetId });
    }
  }
  return results;
}

export function extractRedactions(content: string): ParsedRedaction[] {
  if (!content) return [];
  const results: ParsedRedaction[] = [];
  for (const match of content.matchAll(REDACTION_REGEX)) {
    results.push({
      id: match[1],
      secretText: match[2],
    });
  }
  return results;
}

export function createRedactionSyntax(secretText: string): string {
  const shortId = `r_${Math.random().toString(36).slice(2, 8)}`;
  const clean = secretText.replace(/\]\]/g, '').trim() || 'Informação confidencial';
  return `[[TARJA:${shortId}|${clean}]]`;
}

export function createMentionSyntax(
  label: string,
  targetType: 'entity' | 'character',
  targetId: string
): string {
  return `@[${label}](${targetType}:${targetId})`;
}

// ---------------------------------------------------------------------------
// Ponte Bidirecional com Obsidian (.md Vault Importer / Exporter)
// ---------------------------------------------------------------------------

export interface ObsidianImportedNote {
  title: string;
  category: EntityCategory;
  tags: string[];
  folderName: string | null;
  rawBody: string;
  unresolvedWikiLinks: string[];
}

function normalizeName(s: string): string {
  return s.trim().toLowerCase();
}

export function parseObsidianNoteFile(
  fileName: string,
  rawMarkdown: string,
  relativeFolder: string | null
): ObsidianImportedNote {
  const fallbackTitle = fileName.replace(/\.md$/i, '').trim() || 'Nota Importada';
  let body = rawMarkdown.replace(/\r\n/g, '\n');
  let title = fallbackTitle;
  let category: EntityCategory = 'custom';
  let tags: string[] = [];
  let folderName = relativeFolder;

  // Parse YAML frontmatter if present
  if (body.startsWith('---\n')) {
    const endIdx = body.indexOf('\n---\n', 4);
    if (endIdx !== -1) {
      const yaml = body.slice(4, endIdx);
      body = body.slice(endIdx + 5).trimStart();

      for (const line of yaml.split('\n')) {
        const colonIdx = line.indexOf(':');
        if (colonIdx === -1) continue;
        const key = line.slice(0, colonIdx).trim().toLowerCase();
        const val = line.slice(colonIdx + 1).trim();

        if (key === 'title' && val) {
          title = val.replace(/^["']|["']$/g, '');
        } else if ((key === 'type' || key === 'category') && val) {
          const v = val.toLowerCase();
          if (v.includes('npc') || v.includes('personagem') || v.includes('char')) category = 'character';
          else if (v.includes('local') || v.includes('cidade') || v.includes('loc')) category = 'location';
          else if (v.includes('fac') || v.includes('org') || v.includes('culto')) category = 'faction';
          else if (v.includes('item') || v.includes('arma') || v.includes('reliq')) category = 'item';
          else if (v.includes('ritual') || v.includes('magia') || v.includes('maldi')) category = 'ritual';
          else if (v.includes('event') || v.includes('sess')) category = 'event';
        } else if (key === 'tags' && val) {
          const cleaned = val.replace(/^\[|\]$/g, '');
          tags = cleaned
            .split(',')
            .map((t) => t.trim().replace(/^#|^["']|["']$/g, ''))
            .filter(Boolean);
        } else if (key === 'folder' && val) {
          folderName = val.replace(/^["']|["']$/g, '');
        }
      }
    }
  }

  // Extract inline #tags if none in YAML
  if (tags.length === 0) {
    const inlineTags = [...body.matchAll(/(?:^|\s)#([A-Za-zÀ-ÿ0-9_-]{2,30})/g)].map((m) => m[1]);
    tags = [...new Set(inlineTags)].slice(0, 8);
  }

  // Convert Obsidian %%secret%% comments into [[TARJA:id|secret]]
  body = body.replace(/%%([\s\S]*?)%%/g, (_full, inner: string) => {
    const singleLine = inner.replace(/\n+/g, ' ').trim();
    if (!singleLine) return '';
    return createRedactionSyntax(singleLine);
  });

  // Collect [[WikiLinks]] (excluding [[TARJA:...]])
  const unresolvedWikiLinks: string[] = [];
  for (const match of body.matchAll(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g)) {
    const target = match[1].trim();
    if (target.startsWith('TARJA:')) continue;
    unresolvedWikiLinks.push(target);
  }

  return {
    title,
    category,
    tags,
    folderName,
    rawBody: body,
    unresolvedWikiLinks: [...new Set(unresolvedWikiLinks)],
  };
}

export function resolveObsidianWikiLinks(
  rawBody: string,
  entities: ChronicleEntity[],
  characters: CharacterSummary[]
): string {
  const entityByName = new Map<string, ChronicleEntity>();
  for (const e of entities) {
    entityByName.set(normalizeName(e.title), e);
  }
  const charByName = new Map<string, CharacterSummary>();
  for (const c of characters) {
    charByName.set(normalizeName(c.name), c);
  }

  return rawBody.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (full, rawTarget: string, rawAlias?: string) => {
    const target = rawTarget.trim();
    if (target.startsWith('TARJA:')) return full;
    const label = (rawAlias || target).trim();
    const norm = normalizeName(target);

    const matchedChar = charByName.get(norm);
    if (matchedChar) {
      return createMentionSyntax(label, 'character', matchedChar.id);
    }
    const matchedEntity = entityByName.get(norm);
    if (matchedEntity) {
      return createMentionSyntax(label, 'entity', matchedEntity.id);
    }
    return `**${label}**`;
  });
}

export function exportEntityToObsidianMarkdown(
  entity: ChronicleEntity,
  entitiesById: Record<string, ChronicleEntity>,
  charactersById: Record<string, CharacterSummary>
): { fileName: string; markdown: string } {
  const safeFile =
    entity.title
      .replace(/[<>:"/\\|?*]+/g, '')
      .trim()
      .replace(/\s+/g, ' ') || entity.id;

  let mdBody = entity.content || '';

  // Convert @[Label](type:id) -> [[Canonical Title|Label]] or [[Canonical Title]]
  mdBody = mdBody.replace(
    MENTION_REGEX,
    (_full, label: string, targetType: string, targetId: string) => {
      const canonical =
        targetType === 'character'
          ? charactersById[targetId]?.name
          : entitiesById[targetId]?.title;
      if (!canonical) return `[[${label}]]`;
      if (canonical.toLowerCase() === label.toLowerCase()) return `[[${canonical}]]`;
      return `[[${canonical}|${label}]]`;
    }
  );

  // Convert [[TARJA:id|secret]] -> %%secret%% if still locked, or normal text if unlocked
  const unlocked = new Set(entity.unlockedRedactions || []);
  mdBody = mdBody.replace(REDACTION_REGEX, (_full, id: string, secret: string) => {
    if (unlocked.has(id)) return secret;
    return `%%${secret}%%`;
  });

  const frontmatter = [
    '---',
    `title: "${entity.title.replace(/"/g, '\\"')}"`,
    `category: ${entity.category}`,
    `tags: [${entity.tags.join(', ')}]`,
    `public: ${entity.isPublicToPlayers}`,
    '---',
    '',
  ].join('\n');

  const gmNotesBlock = entity.gmSecretNotes
    ? `\n\n%%\nNOTAS DO MESTRE:\n${entity.gmSecretNotes}\n%%\n`
    : '';

  return {
    fileName: `${safeFile}.md`,
    markdown: `${frontmatter}# ${entity.title}\n${entity.subtitle ? `> ${entity.subtitle}\n` : ''}\n${mdBody}${gmNotesBlock}`,
  };
}
