const fs = require("fs");
const path = require("path");

const QUEUE_PATH = path.join(__dirname, "..", "posts", "queue.json");

function load() {
  if (!fs.existsSync(QUEUE_PATH)) return [];
  return JSON.parse(fs.readFileSync(QUEUE_PATH, "utf8"));
}

function save(jobs) {
  fs.mkdirSync(path.dirname(QUEUE_PATH), { recursive: true });
  fs.writeFileSync(QUEUE_PATH, JSON.stringify(jobs, null, 2));
}

function add(job) {
  const jobs = load();
  const withDefaults = {
    id: job.id || `post-${Date.now()}`,
    status: "pending",
    createdAt: new Date().toISOString(),
    ...job,
  };
  jobs.push(withDefaults);
  save(jobs);
  return withDefaults;
}

function update(id, patch) {
  const jobs = load();
  const idx = jobs.findIndex((j) => j.id === id);
  if (idx === -1) return null;
  jobs[idx] = { ...jobs[idx], ...patch };
  save(jobs);
  return jobs[idx];
}

function dueJobs(now = new Date()) {
  return load().filter((j) => j.status === "pending" && new Date(j.runAt) <= now);
}

module.exports = { QUEUE_PATH, load, save, add, update, dueJobs };
