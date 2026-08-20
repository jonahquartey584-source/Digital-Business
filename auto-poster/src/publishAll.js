const publishers = require("./publishers");
const logger = require("./logger");

/**
 * Publishes one job to every requested platform. Platforms are independent:
 * one failing doesn't stop the others, and every result (success or error)
 * comes back so the caller can report/log/retry per platform.
 *
 * @param {object} job - see README "Job shape" for the full field list.
 * @param {string[]} job.platforms - e.g. ["youtube", "instagram", "tiktok"]
 * @returns {Promise<Array<{platform: string, ok: boolean, result?: object, error?: string}>>}
 */
async function publishAll(job) {
  const platforms = job.platforms || [];
  const unknown = platforms.filter((p) => !publishers[p]);
  if (unknown.length) {
    throw new Error(`Unknown platform(s): ${unknown.join(", ")}`);
  }

  const results = await Promise.all(
    platforms.map(async (platform) => {
      try {
        const result = await publishers[platform].publish(job);
        logger.info(`${platform}: success`, result);
        return { platform, ok: true, result };
      } catch (err) {
        const message = err.response?.data ? JSON.stringify(err.response.data) : err.message;
        logger.error(`${platform}: failed —`, message);
        return { platform, ok: false, error: message };
      }
    })
  );

  return results;
}

module.exports = { publishAll };
