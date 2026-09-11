/**
 * Glyph-width estimation for laying out SVG text.
 *
 * sharp renders SVG through libvips, which gives us no way to measure a string
 * before drawing it. Rather than guess one average width for every character
 * (which makes "WWW" overflow and "iii" look under-filled), we bucket
 * characters by how wide they actually are in a bold sans face. The numbers are
 * multiples of the font size and only need to be good enough to pick line
 * breaks -- a few percent of error is invisible in a story image.
 */
const NARROW = new Set("iljtfIr.,;:'!|()[]{}`");
const WIDE = new Set('mMWw@%&');

function charWidth(ch: string): number {
  if (ch === ' ') return 0.30;
  if (NARROW.has(ch)) return 0.38;
  if (WIDE.has(ch)) return 1.0;
  if (ch >= 'A' && ch <= 'Z') return 0.76;
  if (ch >= '0' && ch <= '9') return 0.66;
  return 0.62;
}

/**
 * Estimated width in pixels. `bold` widens every glyph: the bold face of a
 * sans family runs roughly 6% wider than its regular, and under-measuring is
 * the expensive direction of error -- it silently pushes text off the canvas.
 */
export function measureText(text: string, fontSize: number, bold = false): number {
  let total = 0;
  for (const ch of text) total += charWidth(ch);
  return total * fontSize * (bold ? 1.06 : 1);
}

/** Greedy word wrap. Words longer than maxWidth are hard-split. */
export function wrapText(text: string, maxWidth: number, fontSize: number, bold = false): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (measureText(candidate, fontSize, bold) <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);

    if (measureText(word, fontSize, bold) <= maxWidth) {
      line = word;
    } else {
      // A single unbreakable token (long SKU, no-space brand name): chop it.
      let chunk = '';
      for (const ch of word) {
        if (measureText(chunk + ch, fontSize, bold) > maxWidth && chunk) {
          lines.push(chunk);
          chunk = ch;
        } else {
          chunk += ch;
        }
      }
      line = chunk;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Shrink the font until the text fits in `maxLines`, then return both the
 * chosen size and the wrapped lines. Truncates with an ellipsis if even the
 * smallest size overflows.
 */
export function fitLines(
  text: string,
  maxWidth: number,
  maxLines: number,
  startSize: number,
  minSize: number,
  bold = false,
): { fontSize: number; lines: string[] } {
  let fontSize = startSize;
  let lines = wrapText(text, maxWidth, fontSize, bold);

  while (lines.length > maxLines && fontSize > minSize) {
    fontSize -= 2;
    lines = wrapText(text, maxWidth, fontSize, bold);
  }

  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    const last = lines[maxLines - 1];
    if (last !== undefined) lines[maxLines - 1] = `${last.replace(/[\s,.;:-]+$/, '')}…`;
  }
  return { fontSize, lines };
}

/** Escape text for inclusion in an SVG/XML text node or attribute. */
export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Trim to a length limit on a word boundary where possible. */
export function trimToLength(text: string, limit: number): string {
  const clean = text.trim().replace(/\s+/g, ' ');
  if (clean.length <= limit) return clean;
  const cut = clean.slice(0, limit);

  // The cut already landed on a word boundary -- don't drop another word.
  if (clean[limit] === ' ') return cut.trim();

  const lastSpace = cut.lastIndexOf(' ');
  // Only break on a space if it isn't so early that we lose most of the text.
  return (lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).trim();
}
