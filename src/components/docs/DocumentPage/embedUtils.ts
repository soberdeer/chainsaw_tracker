export type EmbedType = 'miro' | 'youtube' | 'google-drive' | 'figma';

export interface EmbedInfo {
  type: EmbedType;
  embedUrl: string;
  label: string;
  /** Suggested iframe height in px */
  height: number;
}

export function resolveEmbed(href: string): EmbedInfo | null {
  if (!href) return null;

  // ── Miro ──────────────────────────────────────────────────────────────────
  // Live-embed: https://miro.com/app/live-embed/{id}/?...
  // Board:      https://miro.com/app/board/{id}/
  if (href.includes('miro.com')) {
    let embedUrl = href;
    if (href.includes('/app/board/')) {
      // Convert board URL to live-embed
      embedUrl = href.replace('/app/board/', '/app/live-embed/');
      if (!embedUrl.includes('?')) embedUrl += '?autoplay=true';
    }
    return { type: 'miro', embedUrl, label: 'Miro Board', height: 600 };
  }

  // ── YouTube ───────────────────────────────────────────────────────────────
  const ytMatch = href.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  if (ytMatch) {
    return {
      type: 'youtube',
      embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}`,
      label: 'YouTube',
      height: 400,
    };
  }

  // ── Google Drive ──────────────────────────────────────────────────────────
  const driveMatch = href.match(/drive\.google\.com\/file\/d\/([^/?#]+)/);
  if (driveMatch) {
    return {
      type: 'google-drive',
      embedUrl: `https://drive.google.com/file/d/${driveMatch[1]}/preview`,
      label: 'Google Drive',
      height: 600,
    };
  }

  // ── Figma ─────────────────────────────────────────────────────────────────
  if (href.match(/figma\.com\/(file|design|proto)\//)) {
    return {
      type: 'figma',
      embedUrl: `https://www.figma.com/embed?embed_host=chainsaw&url=${encodeURIComponent(href)}`,
      label: 'Figma',
      height: 600,
    };
  }

  return null;
}

/** Build safe iframe HTML for an embed */
export function buildEmbedHtml(embed: EmbedInfo, href: string): string {
  const safeUrl = embed.embedUrl.replace(/"/g, '&quot;');
  const safeHref = href.replace(/"/g, '&quot;');
  const safeLabel = embed.label.replace(/</g, '&lt;');
  return `<div class="doc-embed" data-embed-type="${embed.type}">
  <div class="doc-embed__label">${safeLabel}</div>
  <iframe
    src="${safeUrl}"
    class="doc-embed__frame"
    style="height:${embed.height}px"
    frameborder="0"
    allowfullscreen
    loading="lazy"
    title="${safeLabel}"
  ></iframe>
  <a class="doc-embed__link" href="${safeHref}" target="_blank" rel="noopener noreferrer">
    Open in ${safeLabel} ↗
  </a>
</div>`;
}
