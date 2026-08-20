require("dotenv").config();

/**
 * Central place all publishers read credentials from. Nothing throws here —
 * a missing credential just means that platform's publisher will refuse to
 * run and explain what's missing, so you can still use the others.
 */
const config = {
  youtube: {
    clientId: process.env.YOUTUBE_CLIENT_ID || "",
    clientSecret: process.env.YOUTUBE_CLIENT_SECRET || "",
    refreshToken: process.env.YOUTUBE_REFRESH_TOKEN || "",
  },
  instagram: {
    userId: process.env.IG_USER_ID || "",
    accessToken: process.env.IG_ACCESS_TOKEN || "",
  },
  tiktok: {
    accessToken: process.env.TIKTOK_ACCESS_TOKEN || "",
  },
  snapchat: {
    creativeKitAppId: process.env.SNAPCHAT_CREATIVE_KIT_APP_ID || "",
  },
  mediaBaseUrl: process.env.MEDIA_BASE_URL || "",
};

function isConfigured(platform) {
  switch (platform) {
    case "youtube":
      return Boolean(
        config.youtube.clientId && config.youtube.clientSecret && config.youtube.refreshToken
      );
    case "instagram":
      return Boolean(config.instagram.userId && config.instagram.accessToken);
    case "tiktok":
      return Boolean(config.tiktok.accessToken);
    case "snapchat":
      return Boolean(config.snapchat.creativeKitAppId);
    default:
      return false;
  }
}

module.exports = { config, isConfigured };
