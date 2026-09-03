// Drives /api/generate-tutorial-audio one clip at a time (keeps each
// function call short — one OpenAI TTS call + one GitHub commit — well
// under any serverless timeout) and logs progress. Session handling lives
// in admin-common.js (loaded before this file).

const session = requireAdminSession();
if (session) {
  const loggedInEmail = document.getElementById("loggedInEmail");
  if (loggedInEmail) loggedInEmail.textContent = session.email;
}

const SCRIPTS = {
  crm: [
    "Welcome to your Qp Digital CRM — let's take a quick tour. Everything starts here, on the Pipeline: every opportunity you're working, laid out stage by stage, from a fresh enquiry through to a completed sale.",
    "Next up, the Leads Database. This is where every new contact lands first. Open New Lead, add their name and how they found you, and they're in the system — ready to be worked.",
    "Already got a spreadsheet of contacts? Head to Import History, upload a CSV, and we'll automatically pick out names, emails and phone numbers for you. No manual retyping.",
    "Once a lead turns into a real customer, promote them from Leads into Contacts. That keeps your genuine customer records separate and tidy, away from early-stage enquiries.",
    "Never let a follow-up slip through the cracks. Set a task with a due date here, and tick it off once it's done. Simple as that.",
    "And when you want the bigger picture, Reporting shows you pipeline value and your lead funnel at a glance, so you always know exactly where the business stands.",
    "That's your CRM, start to finish. If you're ever unsure, the Qp Client Assistant in the corner is ready to help — just ask.",
  ],
  "web-development": [
    "Let's walk through your Web Development workspace. At the top, you can see your website's live status at a glance, along with your management plan — check both before making any request.",
    "Use Open Website any time to view the current live version of your site in a new tab, exactly as your customers see it.",
    "Need something changed? Choose Request a Change, describe the page, text, image or feature you'd like updated, and include enough detail for the team to get it right first time.",
    "If Website Management is included in your plan, you'll see hosting, security, SEO and routine updates handled here too, all in one place.",
    "And whenever you need a hand preparing a clear request, the Qp Client Assistant in the bottom corner is on standby.",
  ],
  "booking-system": [
    "Here's your Booking System dashboard — today's appointments and this month's total, right where you need them.",
    "Use Edit Availability to set the days and times customers are allowed to book with you.",
    "Choose New Booking to add an appointment yourself, pick the service and time, and add your customer's details.",
    "Keep your bookable services accurate here too — names, durations, and availability — so customers always see the right options.",
    "Need a hand setting up a booking rule? The Qp Client Assistant is just a click away.",
  ],
  branding: [
    "Welcome to your Brand Library — everything we've designed for you, ready to download whenever you need it.",
    "Open any product panel to preview it first, then use Download Logo Files or Download Print Files to grab the approved, ready-to-use versions.",
    "Need something new — a fresh design, or another file format? Just choose Buy More Branding and tell us what you're after.",
    "Not sure which format is right for print versus web? Ask the Qp Client Assistant — that's exactly what it's there for.",
  ],
  "social-media": [
    "This is your Social Media content dashboard — your publishing plan and everything waiting on your approval, in one place.",
    "Open the Approval Queue to review each upcoming post: the wording, the image, the links, and when it's due to go out.",
    "Got photos, videos or logos we should use? Drop them in through Upload Assets, and they're ready for the next round of content.",
    "Choose Request Content whenever you want something new — just tell us the objective, the audience, and the deadline.",
    "And down here, Performance shows your reach, engagement and leads for the month, not just follower counts.",
  ],
  "ai-automation": [
    "This is AI Reception — your missed-call safety net. Your real phone number rings first, and if nobody picks up, the AI answers instead, has a real conversation, and logs it straight to your CRM.",
    "Your dashboard shows your dedicated number, whether it's currently live, and how many calls it's handled so far.",
    "Open Edit business info and greeting to update what the AI knows about you — your services, your hours, anything a caller might ask — and to write your own custom greeting.",
    "Every call gets logged right here, with a short summary, so a missed call never quietly becomes a missed opportunity.",
    "Questions about a workflow, or want to request a new automation? The Qp Client Assistant is ready whenever you are.",
  ],
};

const noteEl = document.getElementById("audioGenNote");
const logEl = document.getElementById("audioGenLog");
const button = document.getElementById("generateAllBtn");

function logLine(text, isError) {
  const line = document.createElement("p");
  line.className = "form-note";
  line.style.color = isError ? "#e07a6b" : "var(--muted)";
  line.textContent = text;
  logEl.appendChild(line);
  line.scrollIntoView({ block: "nearest" });
}

button?.addEventListener("click", async () => {
  button.disabled = true;
  logEl.innerHTML = "";
  const total = Object.values(SCRIPTS).reduce((sum, lines) => sum + lines.length, 0);
  let done = 0;
  let failed = 0;

  for (const [page, lines] of Object.entries(SCRIPTS)) {
    for (let i = 0; i < lines.length; i++) {
      const step = i + 1;
      noteEl.textContent = `Generating ${done + 1}/${total}…`;
      try {
        const response = await fetch("/api/generate-tutorial-audio", {
          method: "POST",
          headers: { ...adminAuthHeader(), "Content-Type": "application/json" },
          body: JSON.stringify({ page, step, text: lines[i] }),
        });
        if (response.status === 401) return adminHandleSessionRejected();
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.status !== "ok") throw new Error(data.message || "Unknown error");
        logLine(`✓ ${page} step ${step}/${lines.length}`);
      } catch (error) {
        failed++;
        logLine(`✗ ${page} step ${step}/${lines.length} — ${error.message}`, true);
      }
      done++;
    }
  }

  noteEl.textContent = failed
    ? `Done — ${done - failed}/${total} generated, ${failed} failed (see log).`
    : `Done — all ${total} narration clips generated and pushed.`;
  button.disabled = false;
});
