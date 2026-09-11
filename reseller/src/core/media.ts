import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { config } from '../config.js';
import { insertMedia } from '../db/index.js';
import type { MediaAsset, Product } from './types.js';
import { escapeXml, fitLines, measureText } from './text.js';

/** Longest edge we keep for marketplace photos. Plenty for every channel. */
const MAX_EDGE = 1600;
const SQUARE_SIZE = 1200;
const STORY_W = 1080;
const STORY_H = 1920;
const FONT = 'DejaVu Sans, Liberation Sans, sans-serif';

export function absolutePath(asset: MediaAsset): string {
  return path.join(config.paths.media, asset.relativePath);
}

/** Media lives under the product's random token, never its id. */
type MediaOwner = Pick<Product, 'id' | 'mediaToken'>;

function ownerDir(owner: MediaOwner): string {
  return path.join(config.paths.media, owner.mediaToken);
}

async function write(
  owner: MediaOwner,
  filename: string,
  buffer: Buffer,
  role: MediaAsset['role'],
  position: number,
): Promise<MediaAsset> {
  const dir = ownerDir(owner);
  await fs.mkdir(dir, { recursive: true });
  const abs = path.join(dir, filename);
  await fs.writeFile(abs, buffer);
  const meta = await sharp(buffer).metadata();
  return insertMedia({
    productId: owner.id,
    relativePath: path.posix.join(owner.mediaToken, filename),
    role,
    position,
    width: meta.width ?? 0,
    height: meta.height ?? 0,
    bytes: buffer.length,
  });
}

/**
 * Turn one uploaded file into the two shapes channels ask for:
 *  - `original`: auto-rotated, capped at MAX_EDGE, stripped of EXIF (which
 *    otherwise leaks the GPS coordinates of wherever you shot the photo).
 *  - `square`:   1:1 on white, letterboxed rather than cropped so a tall
 *    sneaker or a wide jacket doesn't lose its ends.
 */
export async function ingestPhoto(
  owner: MediaOwner,
  input: Buffer,
  position: number,
): Promise<{ original: MediaAsset; square: MediaAsset }> {
  const base = sharp(input, { failOn: 'none' }).rotate();

  const originalBuf = await base
    .clone()
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();

  const squareBuf = await base
    .clone()
    .resize({
      width: SQUARE_SIZE,
      height: SQUARE_SIZE,
      fit: 'contain',
      background: { r: 255, g: 255, b: 255 },
    })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();

  const original = await write(owner, `photo-${position}.jpg`, originalBuf, 'original', position);
  const square = await write(owner, `square-${position}.jpg`, squareBuf, 'square', position);
  return { original, square };
}

function priceLabel(priceCents: number | null, currency: string): string | null {
  if (priceCents === null) return null;
  const amount = priceCents / 100;
  try {
    return (
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
      })
        .format(amount)
        // Intl separates an unknown currency code from the number with a
        // non-breaking space, which reads as a stray character once it's
        // pasted into a marketplace form.
        .replace(/\u00a0/g, ' ')
    );
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/**
 * Render the 1080x1920 image that gets posted to Instagram / Facebook /
 * Snapchat stories: the product photo on a blurred version of itself, with the
 * name, price and a call to action burned in so the story reads on its own.
 */
export async function renderStoryImage(
  sourcePhoto: Buffer,
  product: MediaOwner & Pick<Product, 'title' | 'priceCents' | 'currency' | 'size' | 'brand'>,
): Promise<MediaAsset> {
  const photo = sharp(sourcePhoto, { failOn: 'none' }).rotate();

  // Backdrop: the photo itself, cover-cropped to portrait and blurred out so
  // the colours match the product without competing with it.
  const backdrop = await photo
    .clone()
    .resize({ width: STORY_W, height: STORY_H, fit: 'cover', position: 'centre' })
    .blur(40)
    .modulate({ brightness: 0.55, saturation: 1.1 })
    .toBuffer();

  /* ----- text stack -----------------------------------------------------
   * Laid out from the bottom up. We measure every block first, add up the
   * height, and only then pick a starting y. Anchoring downward instead
   * (title -> price -> button) is what lets a three-line title shove the
   * price off the bottom of a 1920px canvas.
   */
  const textLeft = 70;
  const textWidth = STORY_W - textLeft * 2;
  const bottomMargin = 96;

  const price = priceLabel(product.priceCents, product.currency);
  const subParts = [product.brand, product.size ? `Size ${product.size}` : null].filter(Boolean);
  const sub = subParts.join('  ·  ');
  const cta = config.brand.callToAction.trim();

  const SUB_SIZE = 34;
  const PRICE_SIZE = 84;
  const CTA_SIZE = 38;
  const CTA_H = 88;

  const headline = fitLines(product.title, textWidth, 3, 66, 42, true);
  const headlineLineHeight = Math.round(headline.fontSize * 1.14);

  type Block = { height: number; gapAfter: number; render: (top: number) => string };
  const blocks: Block[] = [];

  if (sub) {
    blocks.push({
      height: SUB_SIZE,
      gapAfter: 26,
      render: (top) =>
        `<text x="${textLeft}" y="${top + SUB_SIZE * 0.82}" font-family="${FONT}"
               font-size="${SUB_SIZE}" font-weight="600" fill="#ffffff" opacity="0.85"
               letter-spacing="3">${escapeXml(sub.toUpperCase())}</text>`,
    });
  }

  blocks.push({
    height: headlineLineHeight * headline.lines.length,
    gapAfter: price ? 28 : 34,
    render: (top) =>
      headline.lines
        .map(
          (line, i) =>
            `<text x="${textLeft}" y="${top + headlineLineHeight * i + headline.fontSize * 0.82}"
                   font-family="${FONT}" font-size="${headline.fontSize}" font-weight="bold"
                   fill="#ffffff">${escapeXml(line)}</text>`,
        )
        .join('\n'),
  });

  if (price) {
    blocks.push({
      height: PRICE_SIZE,
      gapAfter: 34,
      render: (top) =>
        `<text x="${textLeft}" y="${top + PRICE_SIZE * 0.82}" font-family="${FONT}"
               font-size="${PRICE_SIZE}" font-weight="bold" fill="#ffffff">${escapeXml(price)}</text>`,
    });
  }

  if (cta) {
    // Pill sized from the measured label so a longer CTA never clips.
    const pillW = Math.round(measureText(cta, CTA_SIZE, true) + 76);
    blocks.push({
      height: CTA_H,
      gapAfter: 0,
      render: (top) =>
        `<rect x="${textLeft}" y="${top}" width="${pillW}" height="${CTA_H}"
               rx="${CTA_H / 2}" fill="#ffffff"/>
         <text x="${textLeft + pillW / 2}" y="${top + CTA_H / 2 + CTA_SIZE * 0.35}"
               text-anchor="middle" font-family="${FONT}" font-size="${CTA_SIZE}"
               font-weight="bold" fill="#111111">${escapeXml(cta)}</text>`,
    });
  }

  const stackHeight = blocks.reduce((sum, b) => sum + b.height + b.gapAfter, 0);
  const stackTop = STORY_H - bottomMargin - stackHeight;

  let cursor = stackTop;
  const textSvg = blocks
    .map((b) => {
      const svg = b.render(cursor);
      cursor += b.height + b.gapAfter;
      return svg;
    })
    .join('\n');

  /* ----- hero ------------------------------------------------------------
   * Fills whatever vertical room the text stack left over, so a long title
   * shrinks the photo rather than overlapping it.
   */
  const heroTop = 190;
  const heroW = 940;
  const heroH = Math.max(560, stackTop - heroTop - 56);
  const heroLeft = Math.round((STORY_W - heroW) / 2);

  const heroBuf = await photo
    .clone()
    .resize({ width: heroW, height: heroH, fit: 'contain', background: { r: 255, g: 255, b: 255 } })
    .toBuffer();

  const rounded = await sharp(heroBuf)
    .composite([
      {
        input: Buffer.from(
          `<svg width="${heroW}" height="${heroH}" xmlns="http://www.w3.org/2000/svg">
             <rect width="${heroW}" height="${heroH}" rx="36" ry="36" fill="#fff"/>
           </svg>`,
        ),
        blend: 'dest-in',
      },
    ])
    .png()
    .toBuffer();

  const handle = config.brand.handle || config.brand.name;
  const scrimTop = Math.max(0, stackTop - 220);

  const overlay = Buffer.from(
    `<svg width="${STORY_W}" height="${STORY_H}" xmlns="http://www.w3.org/2000/svg">
       <defs>
         <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
           <stop offset="0%"   stop-color="#000" stop-opacity="0"/>
           <stop offset="45%"  stop-color="#000" stop-opacity="0.55"/>
           <stop offset="100%" stop-color="#000" stop-opacity="0.92"/>
         </linearGradient>
       </defs>
       <rect x="0" y="${scrimTop}" width="${STORY_W}" height="${STORY_H - scrimTop}" fill="url(#scrim)"/>
       <text x="${textLeft}" y="124" font-family="${FONT}" font-size="42" font-weight="bold"
             fill="#ffffff" opacity="0.95">${escapeXml(handle)}</text>
       ${textSvg}
     </svg>`,
  );

  const storyBuf = await sharp(backdrop)
    .composite([
      { input: rounded, top: heroTop, left: heroLeft },
      { input: overlay, top: 0, left: 0 },
    ])
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();

  return write(product, 'story.jpg', storyBuf, 'story', 0);
}
