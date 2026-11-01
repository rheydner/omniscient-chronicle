# DESIGN.md - Omniscient Chronicle

## Product Truth
- **Name**: Omniscient Chronicle
- **Role in Ecosystem**: 3rd interconnected platform in the StarStream / Omniscient RPG ecosystem (alongside StarStream VTT and Omniscient Sheet).
- **Surface Type**: `operate` + `read` (Archival Worldbuilding, Confidential Dossiers, Redacted Lore, Relationship Graphs, Genealogy, Regional Cartography, Chronos Timelines, Custom Calendars, Bestiary & Paginated Grimoire).
- **Dials**: `V4 M3 D7` (High information density for tabletop play, calm surgical motion, intentional archival editorial contrast).

## Visual Language & Typography
- **UI Sans (`--font-sans`)**: `Archivo` - variable grotesque built for dense toolbars, sidebars, tables, and node labels.
- **Editorial Serif (`--font-serif`)**: `Newsreader` - literary serif reserved for lore headings, physical letters, and paginated grimoire chapters.
- **Archival Mono (`--font-mono`)**: `JetBrains Mono` - tabular numerals for dates, threat ratings, coordinates, dossier codes, and redacted `[CENSURADO]` markers.

## Design Tokens
```css
:root {
  --bg-canvas: #0b0d10;
  --bg-sidebar: #0e1116;
  --bg-card: #13171e;
  --bg-elevated: #191e27;
  --bg-field: #10141a;
  --border-subtle: #222834;
  --border-strong: #313a4b;
  --ink-primary: #ece8df;
  --ink-secondary: #a5a095;
  --ink-muted: #6f6b62;
  --accent-brass: #d4a359;
  --accent-brass-hover: #e2b56e;
  --accent-crimson: #c94a4a;
  --accent-sync: #4fa3b8;
  --paper-sepia-bg: #f3ead6;
  --paper-sepia-ink: #221b13;
  --paper-sepia-border: #cbb894;
}
```

## Anti-Patterns Banned
- Zero purple/indigo/violet SaaS gradients or neon lime glows.
- Zero decorative blur orbs or glassmorphism chrome.
- Zero emoji icons in UI navigation or badges (strictly vector `lucide-react` icons at consistent stroke/size).
- Zero `transition-all`; specify `transition-colors`, `transition-opacity`, or `transition-transform`.
