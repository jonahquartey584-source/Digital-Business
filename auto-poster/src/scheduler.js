const cron = require("node-cron");
const queue = require("./queue");
const { publishAll } = require("./publishAll");
const logger = require("./logger");

/**
 * Runs forever, checking the queue every minute for jobs whose `runAt` has
 * passed, publishing them, and recording per-platform results back onto
 * the job. Run with: npm run schedule
 */
function start() {
  logger.info("scheduler: watching", queue.QUEUE_PATH, "(checks every minute)");

  cron.schedule("* * * * *", async () => {
    const due = queue.dueJobs();
    if (!due.length) return;

    for (const job of due) {
      logger.info("scheduler: publishing", job.id);
      queue.update(job.id, { status: "publishing" });
      try {
        const results = await publishAll(job);
        const allOk = results.every((r) => r.ok);
        queue.update(job.id, {
          status: allOk ? "posted" : "partial-failure",
          results,
          finishedAt: new Date().toISOString(),
        });
      } catch (err) {
        queue.update(job.id, {
          status: "failed",
          error: err.message,
          finishedAt: new Date().toISOString(),
        });
      }
    }
  });
}

module.exports = { start };
