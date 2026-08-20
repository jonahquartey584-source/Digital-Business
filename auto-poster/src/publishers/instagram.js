const axios = require("axios");
const { config, isConfigured } = require("../config");
const logger = require("../logger");

const GRAPH_BASE = "https://graph.facebook.com/v20.0";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Publishes to Instagram via the Graph API's Content Publishing flow:
 * create a media container from a *public* URL, poll until it's ready,
 * then publish the container. Instagram does not accept raw file uploads —
 * it must fetch the media itself from a URL you host (see README:
 * "Getting a public media URL").
 *
 * @param {object} job
 * @param {string} job.mediaUrl - public https URL to the image or video
 * @param {"image"|"video"|"reel"} [job.mediaType="image"]
 * @param {string} [job.caption]
 */
async function publish(job) {
  if (!isConfigured("instagram")) {
    throw new Error("Instagram is not configured. Set IG_USER_ID/IG_ACCESS_TOKEN in .env.");
  }
  if (!job.mediaUrl) {
    throw new Error(
      "Instagram publishing needs job.mediaUrl (a public https URL). " +
        "Local-only files aren't accepted by the Graph API — host the file " +
        "(e.g. `npm run serve-media` + a tunnel, or S3/Cloudinary) and pass its URL."
    );
  }

  const { userId, accessToken } = config.instagram;
  const mediaType = job.mediaType || "image";

  const createParams = { access_token: accessToken, caption: job.caption || "" };
  if (mediaType === "image") {
    createParams.image_url = job.mediaUrl;
  } else {
    createParams.video_url = job.mediaUrl;
    createParams.media_type = mediaType === "reel" ? "REELS" : "VIDEO";
  }

  logger.info("instagram: creating media container");
  const createRes = await axios.post(`${GRAPH_BASE}/${userId}/media`, null, {
    params: createParams,
  });
  const creationId = createRes.data.id;

  if (mediaType !== "image") {
    await waitUntilReady(creationId, accessToken);
  }

  logger.info("instagram: publishing container", creationId);
  const publishRes = await axios.post(`${GRAPH_BASE}/${userId}/media_publish`, null, {
    params: { access_token: accessToken, creation_id: creationId },
  });

  const mediaId = publishRes.data.id;
  return { platform: "instagram", id: mediaId };
}

async function waitUntilReady(creationId, accessToken, { timeoutMs = 120000, intervalMs = 3000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await axios.get(`${GRAPH_BASE}/${creationId}`, {
      params: { fields: "status_code", access_token: accessToken },
    });
    const status = res.data.status_code;
    if (status === "FINISHED") return;
    if (status === "ERROR") throw new Error("Instagram failed processing the media container.");
    logger.info("instagram: container status", status, "- waiting");
    await sleep(intervalMs);
  }
  throw new Error("Timed out waiting for Instagram to finish processing the media.");
}

module.exports = { publish };
