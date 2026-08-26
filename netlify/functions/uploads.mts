// Serves back whatever upload-preview-image.mts / upload-preview-file.mts
// saved into the "uploads" Blobs store, at the same "uploads/<filename>"
// relative URL the PHP version serves as a plain static file from its
// /uploads folder. previewImageUrl/previewFileUrl values are identical
// either way — activate.html doesn't need to know which backend is live.

import type { Config, Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

export default async (req: Request, context: Context) => {
  const filename = context.params.filename;
  if (!filename) {
    return new Response("Not found", { status: 404 });
  }

  const store = getStore({ name: "uploads", consistency: "strong" });
  const result = await store.getWithMetadata(filename, { type: "arrayBuffer" });

  if (!result) {
    return new Response("Not found", { status: 404 });
  }

  const contentType = (result.metadata?.contentType as string | undefined) ?? "application/octet-stream";

  return new Response(result.data, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
};

export const config: Config = {
  path: "/uploads/:filename",
};
