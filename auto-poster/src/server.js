const express = require("express");
const path = require("path");
const logger = require("./logger");

/**
 * Minimal static file server for posts/media/, so local files can be
 * turned into the public https URLs that Instagram/TikTok/Snapchat need.
 * For real use, put this behind a real domain + HTTPS (or just upload to
 * S3/Cloudinary instead — this is mainly for local testing with a tunnel
 * like `ngrok http 4000`).
 */
function start(port = 4000) {
  const app = express();
  app.use("/media", express.static(path.join(__dirname, "..", "posts", "media")));
  app.listen(port, () => {
    logger.info(`media server: serving posts/media/ at http://localhost:${port}/media`);
    logger.info("media server: tunnel it (e.g. `ngrok http " + port + "`) to get a public URL");
  });
}

module.exports = { start };

if (require.main === module) {
  start(process.env.MEDIA_SERVER_PORT ? Number(process.env.MEDIA_SERVER_PORT) : 4000);
}
