// Regenerates public/icons/*.png from the SVG sources in this folder.
//
// To use your own logo instead of the placeholder "Qp" mark: replace
// scripts/logo-source.svg (square, no padding — corners get rounded
// automatically) and scripts/logo-maskable-source.svg (square, full-bleed
// background, keep your logo within the inner ~80% so OS icon masks don't
// clip it), then run:
//
//   node scripts/generate-icons.js
//
// Requires the `sharp` package (already a project dependency).

const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const outDir = path.join(root, "public", "icons");
fs.mkdirSync(outDir, { recursive: true });

const base = fs.readFileSync(path.join(__dirname, "logo-source.svg"));
const maskable = fs.readFileSync(path.join(__dirname, "logo-maskable-source.svg"));

const jobs = [
  [base, 512, "icon-512.png"],
  [base, 192, "icon-192.png"],
  [base, 180, "apple-touch-icon.png"],
  [base, 32, "favicon-32.png"],
  [base, 16, "favicon-16.png"],
  [maskable, 512, "icon-maskable-512.png"],
  [maskable, 192, "icon-maskable-192.png"],
];

Promise.all(
  jobs.map(([svg, size, name]) =>
    sharp(svg).resize(size, size).png().toFile(path.join(outDir, name))
  )
)
  .then(() => console.log(`Wrote ${jobs.length} icons to public/icons/`))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
