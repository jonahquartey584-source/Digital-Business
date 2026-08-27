// Looks up an account number + activation code, called by activate.js when
// a client submits the redeem form.
//
// Netlify-hosted equivalent of api/redeem.php — same request/response
// shape, backed by a Netlify Blobs store instead of MySQL.

import type { Config, Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { json, type ClientRecord } from "./_shared.mts";

export default async (req: Request, context: Context) => {
  if (req.method !== "POST") {
    return json(405, { status: "error", message: "Method not allowed" });
  }

  const input = await req.json().catch(() => ({}) as Record<string, unknown>);
  const account = String(input.account ?? "").trim().toUpperCase();
  const code = String(input.code ?? "").trim().toUpperCase();

  if (!account || !code) {
    return json(400, { status: "error", message: "Account and code are required" });
  }

  const store = getStore({ name: "clients", consistency: "strong" });
  const client = await store.get(account, { type: "json" }) as ClientRecord | null;

  if (!client || client.code.toUpperCase() !== code) {
    return json(200, { status: "no_match" });
  }

  return json(200, {
    status: "match_found",
    account: client.account,
    title: client.title,
    service: client.service,
    price: client.price,
    preview: client.preview,
    previewImageUrl: client.previewImageUrl,
    previewFileUrl: client.previewFileUrl,
    // Only ever sent once payment is confirmed — never leaked to a client
    // who hasn't paid yet, even though it's stored from creation. This is
    // the actual "download it on the spot" file (e.g. their finished
    // logo), separate from previewFileUrl (fine to show pre-payment as a
    // preview/mockup).
    deliverableFileUrl: client.status === "active" ? client.deliverableFileUrl : null,
    paymentUrl: client.paymentUrl,
    liveUrl: client.liveUrl,
    // 'pending_payment' or 'active' — activate.js shows a different result
    // for a client who has already paid vs one who's still due to pay.
    activeStatus: client.status,
  });
};

export const config: Config = {
  path: "/api/redeem.php",
};
