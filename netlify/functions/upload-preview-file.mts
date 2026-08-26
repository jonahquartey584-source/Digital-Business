// Admin-only endpoint: accepts ANY uploaded file (multipart/form-data) to
// use as the "Preview file" — what a client's preview image links to when
// they click it. Deliberately not restricted to images: the point is to
// let you attach an actual HTML prototype of the client's site (or a PDF
// proposal, a design export, whatever's relevant) that opens directly in
// their browser. Saves into the "uploads" Blobs store and returns its URL.
// Called from admin.html when you choose a file under "Preview file".
//
// Netlify-hosted equivalent of api/upload_preview_file.php.
//
// Security note: this endpoint is permissive on file *type* by design —
// including .html, which will render (and run any JS/CSS it contains) if
// opened. That's the intended use (a live-looking prototype), not a bug.
// What it still blocks is anything that could execute as *server-side*
// code on a traditional host — the extensions below, mirroring the PHP
// version's list (irrelevant to how Netlify Functions execute, but kept
// for parity and because uploads.mts serves these back verbatim). Both
// upload endpoints require a valid admin session (see admin-login.mts),
// the same trust boundary as direct access to this site's Netlify project
// already gives an admin.

import type { Config, Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { randomBytes } from "node:crypto";
import { json, requireAdminSession } from "./_shared.mts";

const BLOCKED_EXTENSIONS = new Set([
  "php", "php3", "php4", "php5", "php7", "php8", "phtml", "phar", "pht",
  "pl", "py", "cgi", "sh", "bash", "asp", "aspx", "jsp", "cer",
  "exe", "dll", "com", "bat", "msi",
  "htaccess", "htpasswd", "ini", "config",
]);

const CONTENT_TYPES: Record<string, string> = {
  html: "text/html", htm: "text/html", pdf: "application/pdf",
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp",
  css: "text/css", js: "text/javascript", json: "application/json",
  txt: "text/plain", svg: "image/svg+xml",
};

// 15MB — generous enough for an HTML/CSS/image prototype.
const MAX_BYTES = 15 * 1024 * 1024;

function safeExtension(originalName: string): string | null {
  const dotIndex = originalName.lastIndexOf(".");
  if (dotIndex === -1) return null;
  const extension = originalName.slice(dotIndex + 1).toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!extension || BLOCKED_EXTENSIONS.has(extension)) return null;
  return extension;
}

export default async (req: Request, context: Context) => {
  if (req.method !== "POST") {
    return json(405, { status: "error", message: "Method not allowed" });
  }

  if (!requireAdminSession(req)) {
    return json(401, { status: "error", message: "Not logged in — log into admin.html again" });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return json(400, { status: "error", message: "Invalid upload" });
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

  const extension = safeExtension(file.name);
  if (!extension) {
    return json(400, { status: "error", message: "That file type isn't allowed" });
  }

  const filename = `${randomBytes(16).toString("hex")}.${extension}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const store = getStore({ name: "uploads", consistency: "strong" });
  await store.set(filename, bytes, {
    metadata: { contentType: CONTENT_TYPES[extension] ?? "application/octet-stream" },
  });

  return json(200, { status: "uploaded", url: `uploads/${filename}` });
};

export const config: Config = {
  path: "/api/upload_preview_file.php",
};
