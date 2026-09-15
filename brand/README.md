# Qp Market — brand

Editable canvas: <https://claude.ai/artifact/1JrP1pLLpJ31VAjuaiDDoS>

## Palette

| Role | Hex | Use |
| --- | --- | --- |
| Clay | `#c8663a` | The mark's disc. Deliberately not Vinted's teal, so the brand doesn't read as the platform. |
| Ink | `#241f1b` | Wordmark, body text. A warm near-black, not pure `#000`. |
| Paper | `#f7f4ef` | Backgrounds, and the letters knocked out of the disc. |
| Stone | `#6f665d` | Secondary text and the letterspaced strapline. |

## Type

**Archivo** (Google Fonts), Bold for the mark and wordmark, Medium letterspaced
for the strapline. Fallback: `'Helvetica Neue', Helvetica, Arial, sans-serif`.

Archivo was chosen over Bricolage Grotesque after testing: Bricolage's `Q` has
a long horizontal tail that collides with the `p` and turns to mush below
~64px.

## The mark

Two ratios, both from size testing — keep them if you redraw it:

- letters at **48%** of the disc diameter (larger crowds the edge, smaller
  reads timid)
- letters raised **3.5%** above the geometric centre, because the `p`'s
  descender drags the pair visually low

**Minimum size 32px.** Below that the `p`'s bowl closes up — use a single `Q`
instead.

## Files

`assets/` — ready to use:

| File | For |
| --- | --- |
| `qp-avatar-1000.png` | Vinted / Instagram profile picture |
| `qp-avatar-512.png` | Smaller profile slots |
| `qp-avatar-dark-1000.png` | Ink version, for light backgrounds |
| `qp-mark-transparent-1000.png` | Overlaying on photos |
| `qp-logo-horizontal-2000.png` | Banners, invoices, packaging |
| `qp-logo-horizontal-dark-2000.png` | The same on ink |

`*.dc.html` + `canvas.json` — the canvas sources. Editing these and re-seeding
is how the canvas gets updated.

## Still open

`PRELOVED · RESOLD` is a strapline I drafted, not something you asked for.
Change it or drop it — the lockup works without it.
