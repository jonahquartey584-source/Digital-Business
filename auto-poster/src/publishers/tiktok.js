const fs = require("fs");
const axios = require("axios");
const { config, isConfigured } = require("../config");
const logger = require("../logger");

const API_BASE = "https://open.tiktokapis.com/v2";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function authHeaders() {
  return {
    Authorization: `Bearer ${config.tiktok.accessToken}`,
    "Content-Type": "application/json; charset=UTF-8",
  };
}

/**
 * Publishes a video via TikTok's Content Posting API (Direct Post).
 * Either job.mediaUrl (a public https URL TikTok will pull from) or
 * job.file (a local file, uploaded directly) must be given.
 *
 * NOTE: your TikTok developer app must have the `video.publish` scope
 * approved, and the "unaudited" tier only lets you post to your own
 * connected account (posts land as private/draft until TikTok reviews
 * your app for public posting).
 *
 * @param {object} job
 * @param {string} [job.mediaUrl]
 * @param {string} [job.file]
 * @param {string} [job.caption] - used as the on-video title/description.
 * @param {"PUBLIC_TO_EVERYONE"|"MUTUAL_FOLLOW_FRIENDS"|"SELF_ONLY"} [job.privacy]
 */
async function publish(job) {
  if (!isConfigured("tiktok")) {
    throw new Error("TikTok is not configured. Set TIKTOK_ACCESS_TOKEN in .env.");
  }
  if (!job.mediaUrl && !job.file) {
    throw new Error("TikTok publishing needs job.mediaUrl or job.file.");
  }

  const postInfo = {
    title: job.caption || "",
    privacy_level: job.privacy || "SELF_ONLY",
    disable_duet: false,
    disable_comment: false,
    disable_stitch: false,
  };

  let sourceInfo;
  let fileBuffer = null;

  if (job.mediaUrl) {
    sourceInfo = { source: "PULL_FROM_URL", video_url: job.mediaUrl };
  } else {
    if (!fs.existsSync(job.file)) throw new Error(`File not found: ${job.file}`);
    fileBuffer = fs.readFileSync(job.file);
    sourceInfo = {
      source: "FILE_UPLOAD",
      video_size: fileBuffer.length,
      chunk_size: fileBuffer.length,
      total_chunk_count: 1,
    };
  }

  logger.info("tiktok: initializing post");
  const initRes = await axios.post(
    `${API_BASE}/post/publish/video/init/`,
    { post_info: postInfo, source_info: sourceInfo },
    { headers: authHeaders() }
  );

  if (initRes.data.error && initRes.data.error.code !== "ok") {
    throw new Error(`TikTok init failed: ${JSON.stringify(initRes.data.error)}`);
  }

  const { publish_id: publishId, upload_url: uploadUrl } = initRes.data.data;

  if (fileBuffer) {
    logger.info("tiktok: uploading file bytes");
    await axios.put(uploadUrl, fileBuffer, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Range": `bytes 0-${fileBuffer.length - 1}/${fileBuffer.length}`,
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
  }

  const status = await waitUntilPublished(publishId);
  return { platform: "tiktok", id: publishId, status };
}

async function waitUntilPublished(publishId, { timeoutMs = 120000, intervalMs = 3000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await axios.post(
      `${API_BASE}/post/publish/status/fetch/`,
      { publish_id: publishId },
      { headers: authHeaders() }
    );
    const status = res.data.data && res.data.data.status;
    if (status === "PUBLISH_COMPLETE") return status;
    if (status === "FAILED") {
      throw new Error(`TikTok publish failed: ${JSON.stringify(res.data.data)}`);
    }
    logger.info("tiktok: status", status, "- waiting");
    await sleep(intervalMs);
  }
  throw new Error("Timed out waiting for TikTok to finish processing the post.");
}

module.exports = { publish };
