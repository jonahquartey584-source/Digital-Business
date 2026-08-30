// Regenerates public/icons/*.png from the SVG sources in this folder.
//
// To use your own logo instead of the placeholder "Qp" mark: replace
// scripts/logo-source.svg (square, no padding — corners get rounded
// automatically), scripts/logo-maskable-source.svg (square, full-bleed
// background, keep your logo within the inner ~80% so OS icon masks don't
// clip it), and scripts/logo-simple-source.svg (plain version used only for
// the tiny 16/32px favicons, where fine detail turns to mud), then run:
//
//   npm run icons
//
// Requires the `sharp` package (already a project dependency). The SVGs
// reference "Playfair Display" — sharp renders SVG text via the system's
// installed fonts (fontconfig), not CSS/webfonts, so this script first
// makes sure scripts/fonts/PlayfairDisplay-Bold.ttf is registered locally.

const sharp = require("sharp");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");

const root = path.join(__dirname, "..");
const outDir = path.join(root, "public", "icons");
fs.mkdirSync(outDir, { recursive: true });

function ensureFontRegistered() {
  if (process.platform !== "linux") {
    console.warn(
      "Non-Linux platform detected: if the rendered icons show a fallback " +
        "font instead of Playfair Display, install scripts/fonts/PlayfairDisplay-Bold.ttf " +
        "yourself (double-click it on macOS/Windows) and re-run this script."
    );
    return;
  }
  try {
    const fontsDir = path.join(os.homedir(), ".local", "share", "fonts");
    fs.mkdirSync(fontsDir, { recursive: true });
    const src = path.join(__dirname, "fonts", "PlayfairDisplay-Bold.ttf");
    const dest = path.join(fontsDir, "PlayfairDisplay-Bold.ttf");
    if (!fs.existsSync(dest)) {
      fs.copyFileSync(src, dest);
      execSync("fc-cache -f", { stdio: "ignore" });
    }
  } catch (err) {
    console.warn(
      "Could not auto-register Playfair Display with fontconfig — icons may " +
        "render with a fallback font. Error:",
      err.message
    );
  }
}

ensureFontRegistered();

const base = fs.readFileSync(path.join(__dirname, "logo-source.svg"));
const maskable = fs.readFileSync(path.join(__dirname, "logo-maskable-source.svg"));
const simple = fs.readFileSync(path.join(__dirname, "logo-simple-source.svg"));

const jobs = [
  [base, 512, "icon-512.png"],
  [base, 192, "icon-192.png"],
  [base, 180, "apple-touch-icon.png"],
  // The dot/gradient detail in the full mark turns to mud below ~64px, so
  // the tiny browser-tab favicons use the plain black + off-white version.
  [simple, 32, "favicon-32.png"],
  [simple, 16, "favicon-16.png"],
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
