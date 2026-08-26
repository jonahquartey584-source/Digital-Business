// Admin-only endpoint: accepts an uploaded image (multipart/form-data) for
// a client's preview thumbnail, saves it into the "uploads" Blobs store,
// and returns the URL to use as previewImageUrl. Called from admin.html
// when you choose a file under "Preview image".
//
// Netlify-hosted equivalent of api/upload_preview_image.php. Restricted to
// real image types — this gets rendered in an <img> tag, so anything else
// wouldn't display anyway. (For a non-image "preview file" — e.g. an HTML
// prototype — see upload-preview-file.mts instead.) Served back by
// uploads.mts at the same "uploads/<filename>" URL the PHP version uses.

import type { Config, Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { randomBytes } from "node:crypto";
import { json, safeEqual } from "./_shared.mts";

// The real image type is sniffed from the file's magic bytes, not its
// filename or the browser-supplied MIME header — both are easy to fake.
// Mirrors api/upload_preview_image.php's use of PHP's finfo.
const IMAGE_SIGNATURES: Array<{ ext: string; contentType: string; check: (bytes: Uint8Array) => boolean }> = [
  {
    ext: "png",
    contentType: "image/png",
    check: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  },
  {
    ext: "jpg",
    contentType: "image/jpeg",
    check: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    ext: "gif",
    contentType: "image/gif",
    check: (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46,
  },
  {
    ext: "webp",
    contentType: "image/webp",
    check: (b) =>
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  },
];

// Cap well below typical limits so we give a clear error instead of an
// opaque platform-level rejection.
const MAX_BYTES = 5 * 1024 * 1024;

export default async (req: Request, context: Context) => {
  if (req.method !== "POST") {
    return json(405, { status: "error", message: "Method not allowed" });
  }

  const adminPassword = Netlify.env.get("ADMIN_PASSWORD") ?? "";

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return json(400, { status: "error", message: "Invalid upload" });
  }

  if (!adminPassword || !safeEqual(adminPassword, String(formData.get("adminPassword") ?? ""))) {
    return json(401, { status: "error", message: "Wrong admin password" });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return json(400, { status: "error", message: "No file was uploaded" });
  }

  if (file.size > MAX_BYTES) {
    return json(400, {
      status: "error",
      message: `That file is larger than ${Math.round(MAX_BYTES / (1024 * 1024))}MB`,
    });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const match = IMAGE_SIGNATURES.find(({ check }) => check(bytes));

  if (!match) {
    return json(400, { status: "error", message: "That file type isn't allowed" });
  }

  const filename = `${randomBytes(16).toString("hex")}.${match.ext}`;
  const store = getStore({ name: "uploads", consistency: "strong" });
  await store.set(filename, bytes, { metadata: { contentType: match.contentType } });

  // Relative to the site root — admin.html and activate.html are both
  // top-level pages, so this resolves correctly from either.
  return json(200, { status: "uploaded", url: `uploads/${filename}` });
};

export const config: Config = {
  path: "/api/upload_preview_image.php",
};
