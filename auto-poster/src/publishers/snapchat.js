const { config, isConfigured } = require("../config");
const logger = require("../logger");

/**
 * Snapchat, honestly: there is no public API that lets a third-party app
 * post to a personal Story or Spotlight without a human tapping "Send" in
 * the Snapchat app. The only public building block is Creative Kit, which
 * generates a deep link that opens Snapchat with your media pre-loaded for
 * a human to review and send. Snapchat's Marketing API posts ads, not
 * organic content, and there's no unattended-posting equivalent of the
 * YouTube/Instagram/TikTok APIs above.
 *
 * So this publisher does the honest thing: it builds the Creative Kit deep
 * link and hands it back instead of pretending to auto-post. Wire it into
 * a push notification, an email to yourself, or a Shortcuts automation on
 * your phone if you want a one-tap "finish posting" step.
 *
 * @param {object} job
 * @param {string} job.mediaUrl - public https URL to the image or video
 * @param {string} [job.caption]
 */
async function publish(job) {
  if (!isConfigured("snapchat")) {
    throw new Error(
      "Snapchat is not configured. Set SNAPCHAT_CREATIVE_KIT_APP_ID in .env " +
        "(from https://kit.snapchat.com/manage/ after registering a Creative Kit app)."
    );
  }
  if (!job.mediaUrl) {
    throw new Error("Snapchat publishing needs job.mediaUrl (a public https URL).");
  }

  const link = buildCreativeKitLink(job);
  logger.warn(
    "snapchat: no unattended posting API exists — generated a Creative Kit link that " +
      "still needs a human tap to send. See src/publishers/snapchat.js for why."
  );

  return {
    platform: "snapchat",
    status: "manual-step-required",
    shareLink: link,
  };
}

function buildCreativeKitLink(job) {
  const params = new URLSearchParams({
    mediaUrl: job.mediaUrl,
    caption: job.caption || "",
  });
  return `snapchat-creative-kit://share?appId=${config.snapchat.creativeKitAppId}&${params.toString()}`;
}

module.exports = { publish };
