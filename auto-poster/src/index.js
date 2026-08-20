#!/usr/bin/env node
const { Command } = require("commander");
const { publishAll } = require("./publishAll");
const queue = require("./queue");
const scheduler = require("./scheduler");
const logger = require("./logger");

const program = new Command();

program
  .name("auto-poster")
  .description("Post content to YouTube, Instagram, TikTok, and Snapchat.");

function commonPostOptions(cmd) {
  return cmd
    .requiredOption("-p, --platforms <list>", "comma-separated: youtube,instagram,tiktok,snapchat")
    .option("-f, --file <path>", "local media file (required for YouTube; used by TikTok if no --media-url)")
    .option("-u, --media-url <url>", "public https URL to the media (required for Instagram/Snapchat)")
    .option("-c, --caption <text>", "caption / description / on-video title", "")
    .option("-t, --title <text>", "YouTube video title")
    .option("--media-type <type>", "instagram: image | video | reel", "image")
    .option("--privacy <level>", "youtube: public|unlisted|private, tiktok: PUBLIC_TO_EVERYONE|SELF_ONLY|...")
    .option("--tags <list>", "comma-separated youtube tags");
}

function buildJobFromOptions(opts) {
  return {
    platforms: opts.platforms.split(",").map((s) => s.trim()).filter(Boolean),
    file: opts.file,
    mediaUrl: opts.mediaUrl,
    caption: opts.caption,
    title: opts.title,
    mediaType: opts.mediaType,
    privacy: opts.privacy,
    tags: opts.tags ? opts.tags.split(",").map((s) => s.trim()) : undefined,
  };
}

commonPostOptions(program.command("post").description("publish immediately")).action(
  async (opts) => {
    const job = buildJobFromOptions(opts);
    const results = await publishAll(job);
    printResults(results);
    process.exit(results.every((r) => r.ok) ? 0 : 1);
  }
);

commonPostOptions(
  program.command("queue:add").description("schedule a post for later, picked up by `schedule`")
)
  .requiredOption("--run-at <isoDate>", "when to post, e.g. 2026-08-21T09:00:00Z")
  .action((opts) => {
    const job = buildJobFromOptions(opts);
    job.runAt = opts.runAt;
    const saved = queue.add(job);
    logger.info("queued", saved.id, "for", saved.runAt);
  });

program
  .command("queue:list")
  .description("show all queued/posted jobs")
  .action(() => {
    const jobs = queue.load();
    if (!jobs.length) {
      console.log("(queue is empty)");
      return;
    }
    for (const j of jobs) {
      console.log(`${j.id}  [${j.status}]  runAt=${j.runAt}  platforms=${j.platforms.join(",")}`);
    }
  });

program
  .command("schedule")
  .description("run continuously, publishing queued jobs as they come due")
  .action(() => {
    scheduler.start();
  });

function printResults(results) {
  for (const r of results) {
    if (r.ok) {
      console.log(`✅ ${r.platform}:`, JSON.stringify(r.result));
    } else {
      console.log(`❌ ${r.platform}:`, r.error);
    }
  }
}

program.parseAsync(process.argv);
