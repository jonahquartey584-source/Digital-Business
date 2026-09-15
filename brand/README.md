# Qp Market — brand

Editable canvas: <https://claude.ai/artifact/1JrP1pLLpJ31VAjuaiDDoS>

## Palette

Monochrome. Greys carry the hierarchy that colour was doing.

| Role | Hex | Use |
| --- | --- | --- |
| Black | `#000000` | The disc, the wordmark. True black, so it reproduces exactly in print, embroidery and one-colour printing. |
| White | `#ffffff` | Backgrounds, and the letters knocked out of the disc. |
| Grey | `#666666` | Secondary text and the letterspaced strapline. |
| Light grey | `#8a8a8a` / `#e2e2e2` | Small labels / hairlines. |

## Type

**Archivo** (Google Fonts), Bold for the mark and wordmark, Medium letterspaced
for the strapline. Fallback: `'Helvetica Neue', Helvetica, Arial, sans-serif`.

Archivo was chosen over Bricolage Grotesque after testing: Bricolage's `Q` has
a long horizontal tail that collides with the `p` and turns to mush below
~64px.

Two other badge layouts were tried and dropped: a seal with `QP MARKET` curved
around the rim (the curved text failed to render, and the rim eats the space
the letters need at small sizes), and a stacked version with a rule between
the lines (the rule cut through the `Q`'s tail).

## Two marks, and when to use which

**The badge** carries the full name — `Qp` over letterspaced `MARKET` — and is
the logo when it stands alone: profile pictures, stickers, a stamp on a
mailer.

**The monogram** is `Qp` only. Use it whenever a wordmark sits beside it.
Pairing the full badge with the wordmark says "Qp Market" twice in one lockup,
which reads as a mistake.

Ratios, all from rendering at real avatar sizes — keep them if you redraw it:

| | Badge | Monogram |
| --- | --- | --- |
| `Qp` size | 38% of the disc | 48% of the disc |
| `Qp` centre | 43% from the top | 46.5% |
| `MARKET` size | 15% of the disc | — |
| `MARKET` centre | 71% from the top | — |

The letters sit above the geometric middle on purpose: the `p`'s descender
drags the pair visually low, so optical centring needs that lift.

**The badge works down to 48px.** Below that `MARKET` stops being readable —
switch to the monogram, which holds to about 32px.

## Files

`assets/` — ready to use:

| File | For |
| --- | --- |
| `qp-avatar-1000.png` | Vinted / Instagram profile picture |
| `qp-avatar-512.png` | Smaller profile slots |
| `qp-avatar-inverse-1000.png` | White badge, for dark backgrounds |
| `qp-monogram-256.png` | Favicons and anywhere under 48px |
| `qp-monogram-inverse-256.png` | The same on dark |
| `qp-mark-transparent-1000.png` | Overlaying on photos |
| `qp-logo-horizontal-2000.png` | Banners, invoices, packaging |
| `qp-logo-horizontal-inverse-2000.png` | The same on black |

`*.dc.html` + `canvas.json` — the canvas sources. Editing these and re-seeding
is how the canvas gets updated.

## Still open

`PRELOVED · RESOLD` is a strapline I drafted, not something you asked for.
Change it or drop it — the lockup works without it.
