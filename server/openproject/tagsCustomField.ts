/**
 * tagsCustomField.ts
 *
 * Manages the "Tags" WorkPackageCustomField in OpenProject.
 *
 * The custom field is created during `setup:openproject` via Rails runner.
 * Its numeric ID comes from the env var OPENPROJECT_TAGS_CF_ID.
 *
 * Colors/themes are derived deterministically from the tag name.
 */

const RUNTIME_CONFIG_KEY = 'OPENPROJECT_TAGS_CF_ID';

let _cachedCfId: number | null | undefined;

/** Returns the Tags custom field ID from env, or null if not configured. */
export function getTagsCustomFieldId(): number | null {
  if (_cachedCfId !== undefined) return _cachedCfId;
  const raw = process.env[RUNTIME_CONFIG_KEY];
  _cachedCfId = raw ? Number(raw) : null;
  return _cachedCfId;
}

export function invalidateTagsCfCache() {
  _cachedCfId = undefined;
}

/** Called by setup scripts to update the in-process cache (env var is source of truth). */
export function saveTagsCustomFieldId(cfId: number): void {
  _cachedCfId = cfId;
}

/**
 * Returns the `_links` key name for the Tags custom field.
 * Example: cfId=5 → "customField5"
 */
export function tagsCfLinkKey(cfId: number): string {
  return `customField${cfId}`;
}

// ── Color / theme palette ────────────────────────────────────────────────────

export const TAG_COLOR_PALETTE: Record<string, string> = {
  bug: '#e03131',
  feature: '#1971c2',
  art: '#9c36b5',
  audio: '#f08c00',
  level: '#2b8a3e',
  ui: '#5f3dc4',
  build: '#495057',
  playtest: '#0c8599',
  blocker: '#c2255c',
  polish: '#fab005',
  game: '#e67700',
  pm: '#2b8a3e',
  narrative: '#c2255c',
  develop: '#1971c2',
  architecture: '#5f3dc4',
  gd: '#9c36b5',
  prog: '#0c8599',
  milestone: '#868e96',
  project: '#495057',
};

export const TAG_THEME_PALETTE: Record<string, string> = {
  bug: 'red',
  feature: 'blue',
  art: 'grape',
  audio: 'orange',
  level: 'green',
  ui: 'violet',
  build: 'dark',
  playtest: 'cyan',
  blocker: 'pink',
  polish: 'yellow',
  game: 'orange',
  pm: 'green',
  narrative: 'pink',
  develop: 'blue',
  architecture: 'violet',
  gd: 'grape',
  prog: 'cyan',
  milestone: 'gray',
  project: 'dark',
};

const MANTINE_COLORS = [
  'blue',
  'grape',
  'red',
  'orange',
  'green',
  'cyan',
  'violet',
  'pink',
  'teal',
  'yellow',
  'indigo',
  'lime',
];

const MANTINE_HEX: Record<string, string> = {
  blue: '#1971c2',
  grape: '#9c36b5',
  red: '#e03131',
  orange: '#f08c00',
  green: '#2b8a3e',
  cyan: '#0c8599',
  violet: '#5f3dc4',
  pink: '#c2255c',
  teal: '#0f9f82',
  yellow: '#e67700',
  indigo: '#3b5bdb',
  lime: '#5c940d',
};

function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return Math.abs(h);
}

export function tagMetaFromName(name: string): { color: string; theme: string } {
  const normalized = name.trim().toLowerCase().replace(/\s+/g, ' ');
  if (TAG_COLOR_PALETTE[normalized]) {
    return {
      color: TAG_COLOR_PALETTE[normalized],
      theme: TAG_THEME_PALETTE[normalized] || 'gray',
    };
  }
  const theme = MANTINE_COLORS[hashString(normalized) % MANTINE_COLORS.length];
  return { color: MANTINE_HEX[theme] || '#868e96', theme };
}

export function extractTagNamesFromLinks(links: Record<string, unknown>, cfId: number): string[] {
  return extractTagsFromLinks(links, cfId).map((t) => t.name);
}

export function extractTagsFromLinks(
  links: Record<string, unknown>,
  cfId: number
): Array<{ id: string; name: string }> {
  const key = tagsCfLinkKey(cfId);
  const value = links[key];
  if (!value || !Array.isArray(value)) return [];
  return value
    .filter(
      (v): v is { href: string; title: string } =>
        typeof v === 'object' &&
        v !== null &&
        typeof (v as { title?: unknown }).title === 'string' &&
        (v as { title: string }).title.length > 0
    )
    .map((v) => ({
      id: v.href.split('/').at(-1) || v.href,
      name: v.title,
    }));
}
