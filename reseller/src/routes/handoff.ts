import { Router } from 'express';
import { getMediaForProduct, getProduct } from '../db/index.js';
import { buildCaption, formatPrice } from '../core/listing.js';
import { escapeXml } from '../core/text.js';

export const handoff = Router();

/**
 * Phone-sized page for the channels no server can post to: Snapchat, and a
 * personal (non-Page) Facebook or Instagram story. Save the image, copy the
 * caption, done -- the part that can be automated already has been.
 */
handoff.get('/:productId', (req, res) => {
  const product = getProduct(Number(req.params.productId));
  if (!product) {
    res.status(404).send('Product not found');
    return;
  }

  const story = getMediaForProduct(product.id).find((m) => m.role === 'story');
  if (!story) {
    res.status(404).send('No story image was rendered for this product');
    return;
  }

  const imageUrl = `/media/${story.relativePath}`;
  const caption = buildCaption(product);
  const price = formatPrice(product.priceCents, product.currency);

  res.type('html').send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Post ${escapeXml(product.title)}</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 20px 16px 48px; background: #0d0f12; color: #f4f5f7;
         font: 16px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; }
  .wrap { max-width: 460px; margin: 0 auto; }
  h1 { font-size: 19px; margin: 0 0 4px; }
  .price { color: #8ee6a8; font-weight: 700; margin: 0 0 18px; }
  img { width: 100%; border-radius: 14px; display: block; margin-bottom: 18px;
        border: 1px solid #24272e; }
  .caption { white-space: pre-wrap; background: #16191f; border: 1px solid #24272e;
             border-radius: 12px; padding: 14px; font-size: 14px; margin-bottom: 14px; }
  .row { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 24px; }
  a.btn, button.btn { flex: 1 1 160px; appearance: none; border: 0; cursor: pointer;
        border-radius: 999px; padding: 14px 18px; font-size: 15px; font-weight: 700;
        text-align: center; text-decoration: none; background: #f4f5f7; color: #0d0f12; }
  button.btn.secondary, a.btn.secondary { background: #24272e; color: #f4f5f7; }
  ol { padding-left: 22px; color: #a8adb8; font-size: 14px; }
  li { margin-bottom: 6px; }
</style>
</head>
<body>
<div class="wrap">
  <h1>${escapeXml(product.title)}</h1>
  ${price ? `<p class="price">${escapeXml(price)}</p>` : ''}

  <img src="${imageUrl}" alt="Story image for ${escapeXml(product.title)}">

  <div class="row">
    <a class="btn" href="${imageUrl}" download="story-${product.id}.jpg">Save image</a>
    <button class="btn secondary" id="copy">Copy caption</button>
  </div>

  <div class="caption" id="caption">${escapeXml(caption)}</div>

  <ol>
    <li>Tap <strong>Save image</strong> — it lands in your camera roll.</li>
    <li>Tap <strong>Copy caption</strong>.</li>
    <li>Open Snapchat (or your personal Instagram/Facebook story), pick the saved
        image from Memories / your gallery, and paste the caption.</li>
  </ol>
</div>
<script>
  document.getElementById('copy').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    const text = document.getElementById('caption').textContent;
    try {
      await navigator.clipboard.writeText(text);
      button.textContent = 'Copied';
    } catch {
      // Clipboard API needs https or a user gesture on some mobile browsers;
      // fall back to selecting the text so a long-press copy still works.
      const range = document.createRange();
      range.selectNodeContents(document.getElementById('caption'));
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      button.textContent = 'Long-press to copy';
    }
    setTimeout(() => { button.textContent = 'Copy caption'; }, 2500);
  });
</script>
</body>
</html>`);
});
