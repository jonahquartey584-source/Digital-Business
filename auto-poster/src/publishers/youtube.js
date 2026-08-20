const fs = require("fs");
const { google } = require("googleapis");
const readline = require("readline");
const { config, isConfigured } = require("../config");
const logger = require("../logger");

const SCOPES = ["https://www.googleapis.com/auth/youtube.upload"];

function buildOAuthClient() {
  return new google.auth.OAuth2(
    config.youtube.clientId,
    config.youtube.clientSecret,
    "urn:ietf:wg:oauth:2.0:oob"
  );
}

/**
 * One-time interactive helper to mint a refresh token:
 *   node src/publishers/youtube.js --auth
 */
async function runAuthFlow() {
  const oAuth2Client = buildOAuthClient();
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });
  console.log("Open this URL, approve access, and paste the code below:\n", authUrl);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const code = await new Promise((resolve) => rl.question("\nCode: ", resolve));
  rl.close();

  const { tokens } = await oAuth2Client.getToken(code.trim());
  console.log("\nAdd this to your .env as YOUTUBE_REFRESH_TOKEN:\n", tokens.refresh_token);
}

/**
 * Uploads a local video file to YouTube.
 * @param {object} job
 * @param {string} job.file - path to a local video file (required; YouTube
 *   uploads are always a direct file stream, not a URL).
 * @param {string} [job.title]
 * @param {string} [job.caption] - used as the video description.
 * @param {string[]} [job.tags]
 * @param {"public"|"unlisted"|"private"} [job.privacy]
 */
async function publish(job) {
  if (!isConfigured("youtube")) {
    throw new Error(
      "YouTube is not configured. Set YOUTUBE_CLIENT_ID/SECRET/REFRESH_TOKEN in .env (see README)."
    );
  }
  if (!job.file) {
    throw new Error("YouTube publishing needs a local file (job.file) — URLs aren't supported.");
  }
  if (!fs.existsSync(job.file)) {
    throw new Error(`File not found: ${job.file}`);
  }

  const oAuth2Client = buildOAuthClient();
  oAuth2Client.setCredentials({ refresh_token: config.youtube.refreshToken });
  const youtube = google.youtube({ version: "v3", auth: oAuth2Client });

  logger.info("youtube: uploading", job.file);
  const res = await youtube.videos.insert({
    part: ["snippet", "status"],
    requestBody: {
      snippet: {
        title: job.title || "Untitled upload",
        description: job.caption || "",
        tags: job.tags || [],
      },
      status: {
        privacyStatus: job.privacy || "public",
        selfDeclaredMadeForKids: false,
      },
    },
    media: {
      body: fs.createReadStream(job.file),
    },
  });

  const videoId = res.data.id;
  return { platform: "youtube", id: videoId, url: `https://youtu.be/${videoId}` };
}

module.exports = { publish, runAuthFlow };

if (require.main === module && process.argv.includes("--auth")) {
  runAuthFlow().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
