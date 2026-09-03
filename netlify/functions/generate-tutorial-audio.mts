// Admin-only: generates one narration clip via OpenAI's TTS API and commits
// it straight to this repo via the GitHub Contents API. Both API keys are
// read from Netlify's own environment — neither ever passes through a chat
// prompt or client-side code, unlike the first (abandoned) attempt at this
// which pasted the OpenAI key into another session's task prompt. Driven
// one clip at a time by admin-tutorial-audio.js so each call stays well
// under the function timeout.

import type { Config, Context } from "@netlify/functions";
import { json, requireAdminSession } from "./_shared.mts";

const GITHUB_OWNER = "jonahquartey584-source";
const GITHUB_REPO = "Digital-Business";
const GITHUB_BRANCH = "claude/ai-digital-specialist-site-5aaul4";

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") return json(405, { status: "error", message: "Method not allowed" });
  if (!requireAdminSession(req)) return json(401, { status: "error", message: "Not logged in — log into admin.html again" });

  const openaiKey = process.env.OPENAI_API_KEY;
  const githubToken = process.env.GITHUB_TOKEN;
  if (!openaiKey) return json(500, { status: "error", message: "OPENAI_API_KEY is not set on the site" });
  if (!githubToken) return json(500, { status: "error", message: "GITHUB_TOKEN is not set on the site" });

  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  const page = typeof body.page === "string" ? body.page.trim().slice(0, 60) : "";
  const step = Number(body.step);
  const text = typeof body.text === "string" ? body.text.trim().slice(0, 2000) : "";
  if (!page || !Number.isInteger(step) || step < 1 || !text) {
    return json(400, { status: "error", message: "page, step (integer >= 1) and text are required" });
  }

  // 1. Synthesize speech.
  const ttsResponse = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "tts-1-hd", voice: "onyx", input: text, response_format: "mp3" }),
  });
  if (!ttsResponse.ok) {
    const errText = await ttsResponse.text().catch(() => "");
    return json(502, { status: "error", message: `OpenAI TTS failed (${ttsResponse.status}): ${errText.slice(0, 300)}` });
  }
  const base64Content = Buffer.from(await ttsResponse.arrayBuffer()).toString("base64");

  // 2. Commit the clip to the repo via GitHub's Contents API.
  const path = `tutorials/audio/${page}-step-${step}.mp3`;
  const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodeURIComponent(path)}`;
  const githubHeaders = { Authorization: `Bearer ${githubToken}`, Accept: "application/vnd.github+json" };

  let sha: string | undefined;
  const existing = await fetch(`${apiUrl}?ref=${GITHUB_BRANCH}`, { headers: githubHeaders });
  if (existing.ok) {
    const existingData = (await existing.json()) as { sha?: string };
    sha = existingData.sha;
  }

  const commitResponse = await fetch(apiUrl, {
    method: "PUT",
    headers: { ...githubHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: `Add narration audio: ${path}`,
      content: base64Content,
      branch: GITHUB_BRANCH,
      ...(sha ? { sha } : {}),
    }),
  });
  if (!commitResponse.ok) {
    const errText = await commitResponse.text().catch(() => "");
    return json(502, { status: "error", message: `GitHub commit failed (${commitResponse.status}): ${errText.slice(0, 300)}` });
  }

  return json(200, { status: "ok", path });
};

export const config: Config = { path: "/api/generate-tutorial-audio" };
