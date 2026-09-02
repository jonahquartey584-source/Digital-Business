const savedMemberTheme = localStorage.getItem("qpTheme") === "light" ? "light" : "dark";
document.documentElement.dataset.theme = savedMemberTheme;

const servicePage = document.querySelector("[data-member-service]");
const gate = document.getElementById("memberServiceGate");
const accountTarget = document.querySelector("[data-member-account]");
const params = new URLSearchParams(location.search);
const account = params.get("account") || "Member account";
const purchases = JSON.parse(sessionStorage.getItem("qpMemberPurchases") || localStorage.getItem("qpMemberPurchases") || "[]");
const serviceTerms = (servicePage?.dataset.serviceAliases || "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
function purchaseText(purchase) {
  return `${purchase.title || ""} ${purchase.service || ""}`.toLowerCase();
}
// Every purchase that unlocked this page at all — "Website" and "Website
// Management" are two different checkboxes in New Client Setup but both
// alias to this same page (see serviceTerms above), so having only one of
// them still lets someone in; applyServiceSpecificAccess() below decides
// what's locked inside the page once they are.
const matchedPurchases = purchases.filter((purchase) => {
  const text = purchaseText(purchase);
  return text.includes("all services") || serviceTerms.some((term) => text.includes(term));
});
const allowed = matchedPurchases.length > 0;

async function syncLiveServiceAccess() {
  try {
    const response = await fetch("/api/member-purchases", { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    const latest = response.ok && data.status === "ok" && Array.isArray(data.purchases)
      ? data.purchases
      : response.status === 404 ? [] : null;
    if (!latest || JSON.stringify(latest) === JSON.stringify(purchases)) return;
    sessionStorage.setItem("qpMemberPurchases", JSON.stringify(latest));
    localStorage.setItem("qpMemberPurchases", JSON.stringify(latest));
    // Re-evaluate the service gate and any service-specific sub-access using
    // the authoritative server record instead of the old page snapshot.
    location.reload();
  } catch {
    // A temporary connection problem must not invent or expand access.
  }
}
function clearDemonstrationContent() {
  const path = location.pathname.split("/").pop();
  if (path === "web-development.html") {
    const values = document.querySelectorAll(".member-service-summary strong");
    if (values[1]) values[1].textContent = "Not connected";
    if (values[2]) values[2].textContent = "Not configured";
  }
  if (path === "booking-system.html") {
    const values = document.querySelectorAll(".member-service-summary strong");
    if (values[1]) values[1].textContent = "0 bookings";
    if (values[2]) values[2].textContent = "0 bookings";
    document.querySelectorAll(".member-service-list").forEach((list) => { list.innerHTML = '<p class="crm-column__empty">Nothing has been added yet.</p>'; });
  }
  if (path === "branding.html") {
    const values = document.querySelectorAll(".member-service-summary strong");
    if (values[1]) values[1].textContent = "0 files";
  }
  if (path === "ai-automation.html") {
    const values = document.querySelectorAll(".member-service-summary strong");
    if (values[1]) values[1].textContent = "0";
    document.querySelectorAll(".member-service-list").forEach((list) => { list.innerHTML = '<p class="crm-column__empty">No automations or assistant activity yet.</p>'; });
  }
  if (path === "social-media.html") {
    const values = document.querySelectorAll(".member-service-summary strong");
    if (values[1]) values[1].textContent = "0 posts";
    document.querySelectorAll(".member-service-list").forEach((list) => { list.innerHTML = '<p class="crm-column__empty">No content or performance data yet.</p>'; });
  }
}
// Website vs. Website Management: both purchases open this same page, but
// Website Management is what actually pays for hosting/security/SEO/updates
// — someone who only bought the website itself shouldn't see those as
// already included. Locks the Management panel unless one of the matched
// purchases specifically covers it.
function applyWebsiteManagementAccess() {
  const managementUnlocked = matchedPurchases.some((purchase) => {
    const text = purchaseText(purchase);
    return text.includes("all services") || text.includes("website management");
  });
  const list = document.getElementById("managementList");
  const locked = document.getElementById("managementLocked");
  const summaryValue = document.getElementById("managementSummaryValue");
  if (list) list.hidden = !managementUnlocked;
  if (locked) locked.hidden = managementUnlocked;
  if (summaryValue) summaryValue.textContent = managementUnlocked ? "Active" : "Not included";
}

// Shows whichever live URL deployClientWebsite() (server-side, on payment)
// set on this account's record, or a "still deploying" state if it hasn't
// run yet/there's nothing to deploy for this client. Also wires "New
// Change Request" to actually reach Qp Digital (website-change-request.mts)
// instead of service-actions.js's generic demo handler, which only ever
// saved to this browser's own localStorage.
function applyWebsiteDeployAccess() {
  const liveUrl = matchedPurchases.map((purchase) => purchase.liveUrl).find(Boolean);
  const statusValue = document.getElementById("websiteStatusValue");
  const openBtn = document.getElementById("openWebsiteBtn");
  const pendingBtn = document.getElementById("openWebsitePending");
  const preview = document.getElementById("websitePreview");

  if (liveUrl) {
    if (statusValue) statusValue.textContent = "Live";
    if (openBtn) { openBtn.href = liveUrl; openBtn.hidden = false; }
    if (pendingBtn) pendingBtn.hidden = true;
    if (preview) {
      preview.textContent = "";
      const link = document.createElement("a");
      link.href = liveUrl; link.target = "_blank"; link.rel = "noopener";
      link.className = "preview-frame-link";
      link.textContent = liveUrl.replace(/^https?:\/\//, "");
      preview.appendChild(link);
    }
  } else {
    if (statusValue) statusValue.textContent = "Deploying…";
    if (openBtn) openBtn.hidden = true;
    if (pendingBtn) pendingBtn.hidden = false;
  }

  const changeRequestBtn = document.getElementById("newChangeRequestBtn");
  const changeRequestNote = document.getElementById("changeRequestNote");
  changeRequestBtn?.addEventListener("click", async (event) => {
    // Stops service-actions.js's document-level click handler (matched by
    // this button's visible text) from also opening its own fake, purely
    // local version of this same form.
    event.stopPropagation();

    const page = window.prompt("Which page or section needs the change? (optional)") || "";
    const change = window.prompt("Describe the change you need:");
    if (!change || !change.trim()) return;

    changeRequestBtn.disabled = true;
    if (changeRequestNote) changeRequestNote.textContent = "Sending…";
    try {
      const response = await fetch("/api/website-change-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account, page, request: change.trim(), priority: "Standard" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.status !== "ok") throw new Error(data.message || "Couldn't send that — try again.");
      if (changeRequestNote) changeRequestNote.textContent = "Sent — Qp Digital will be in touch.";
    } catch (error) {
      if (changeRequestNote) changeRequestNote.textContent = error.message || "Couldn't send that — try again.";
    } finally {
      changeRequestBtn.disabled = false;
    }
  });
}

if (servicePage && allowed) {
  clearDemonstrationContent();
  if (location.pathname.split("/").pop() === "web-development.html") {
    applyWebsiteManagementAccess();
    applyWebsiteDeployAccess();
  }
  servicePage.hidden = false;
  if (accountTarget) accountTarget.textContent = account;
} else if (gate) {
  gate.hidden = false;
}
document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
  button.textContent = savedMemberTheme === "light" ? "Dark" : "Light";
  button.setAttribute("aria-pressed", String(savedMemberTheme === "light"));
  button.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("qpTheme", next);
    button.textContent = next === "light" ? "Dark" : "Light";
    button.setAttribute("aria-pressed", String(next === "light"));
  });
});
if (!document.querySelector('script[src="client-assistant.js"]')) {
  const assistantScript = document.createElement("script");
  assistantScript.src = "client-assistant.js";
  document.body.appendChild(assistantScript);
}
if (!document.querySelector('script[src="service-actions.js"]')) {
  const actionsScript = document.createElement("script");
  actionsScript.src = "service-actions.js";
  document.body.appendChild(actionsScript);
}

// Service-specific guided tutorials. These run inside the workspace so a
// client can pause, replay and follow the instructions without leaving their
// account or sharing any client data with a third-party video platform.
const serviceTutorials = {
  "web-development.html": {
    title: "How to use Web Development",
    intro: "A complete tour of your website workspace and management plan.",
    steps: [
      ["Your website at a glance", "Check the website status and management-plan status at the top before making a request."],
      ["Open your live website", "Use Open Website to review the current live version in a separate tab."],
      ["Request a website change", "Choose Request a Change, explain the page, text, image or feature that needs updating, and include enough detail for the Qp Digital team."],
      ["Review your website preview", "Use the preview panel to confirm which website and version are connected to your account."],
      ["Understand website management", "Hosting, security, SEO, updates and fixes appear in the management panel when Website Management is included in your plan."],
      ["Get help", "Open the Qp Client Assistant in the bottom corner whenever you need help preparing a clear request."]
    ]
  },
  "crm.html": {
    title: "How to use your CRM",
    intro: "Learn how to manage leads from first enquiry through to a completed sale.",
    steps: [
      ["Start with the Pipeline", "The pipeline shows each opportunity by sales stage. Use Add deal to create a new opportunity and record its value."],
      ["Build your Leads Database", "Open Leads Database, choose New lead, and enter the person's contact details and source."],
      ["Import existing leads", "Open Import History and upload a CSV file. Include a name column; email and phone columns are detected automatically."],
      ["Keep contacts organised", "Promote qualified leads into Contacts so customer information stays separate from early enquiries."],
      ["Never miss a follow-up", "Create tasks with due dates in Tasks & Follow-ups and mark each task complete when it is finished."],
      ["Measure performance", "Reporting summarises the pipeline value, lead funnel and progress across each stage."],
      ["Use AI responsibly", "If AI & Automation is included, open AI Assistant for lead follow-up support. Review important messages before they are sent."],
      ["Ask for help", "Use the Qp Client Assistant in the bottom corner for guidance anywhere in the CRM."]
    ]
  },
  "booking-system.html": {
    title: "How to use your Booking System",
    intro: "Set availability, manage appointments and keep your services accurate.",
    steps: [
      ["Review the dashboard", "Check today's bookings and the monthly total at the top of the workspace."],
      ["Set your availability", "Use Edit Availability to define the days and times customers are allowed to book."],
      ["Add a booking", "Choose New Booking, select the service and time, and add the customer's correct contact details."],
      ["Manage bookable services", "Keep service names, durations and availability up to date so customers see the correct choices."],
      ["Confirm changes", "Review upcoming bookings after every change and check that the correct status is shown."],
      ["Get help", "Use the Qp Client Assistant if you need support configuring a service or booking rule."]
    ]
  },
  "branding.html": {
    title: "How to use your Brand Library",
    intro: "Find, review and download the approved files created for your business.",
    steps: [
      ["Check your purchased products", "The summary shows how many approved brand files are currently available in your account."],
      ["Review each preview", "Open the relevant product panel and check the preview before downloading the final files."],
      ["Download logo files", "Use Download Logo Files for the supplied formats. Keep the original folder together so nothing is lost."],
      ["Download print artwork", "Use Download Print Files for approved business cards, flyers or other print-ready designs."],
      ["Request more branding", "Choose Buy More Branding when you need a new design or an additional format."],
      ["Get help", "Ask the Qp Client Assistant which file format is best for print, websites or social media."]
    ]
  },
  "ai-automation.html": {
    title: "How to use AI & Automation",
    intro: "Monitor workflows, request automation and understand what the assistant is doing.",
    steps: [
      ["Check your active workflows", "The workspace lists every automation currently configured for your business."],
      ["Understand each workflow", "Review what triggers the workflow, what action it performs and which customer information it uses."],
      ["Request an automation", "Choose Request Automation and describe the trigger, desired action and intended customer outcome."],
      ["Manage the website assistant", "Use Manage Assistant to review the assistant configuration and the enquiries it collects."],
      ["Review important activity", "Check conversation and agent-request totals regularly so qualified leads receive a human follow-up."],
      ["Protect customer data", "Only automate approved tasks and avoid entering sensitive information that the workflow does not require."],
      ["Get help", "Use the Qp Client Assistant to understand a workflow or prepare a request for the Qp Digital team."]
    ]
  },
  "social-media.html": {
    title: "How to use Social Media",
    intro: "Review content, approve posts and track performance from one workspace.",
    steps: [
      ["Check the publishing plan", "The summary shows the number of scheduled posts and whether your service is monthly or one-time."],
      ["Review the approval queue", "Open every waiting post and check its wording, image, links and scheduled platform."],
      ["Upload brand assets", "Use Upload Assets to supply approved photos, videos, logos or campaign materials."],
      ["Request new content", "Choose Request Content and include the objective, audience, offer, deadline and preferred platform."],
      ["Track results", "Use the performance panel to review reach, engagement and leads—not just follower numbers."],
      ["Get help", "Ask the Qp Client Assistant to explain a metric or help structure a content request."]
    ]
  }
};

function installServiceTutorial() {
  if (!servicePage || !allowed) return;
  const page = location.pathname.split("/").pop() || "";
  const tutorial = serviceTutorials[page];
  if (!tutorial) return;
  const head = document.querySelector(".member-service-head, .service-app-topbar");
  const actions = head?.querySelector(".member-service-actions, .service-app-tools") || head;
  if (!actions) return;
  const launch = document.createElement("button");
  launch.className = "btn btn--guide";
  launch.type = "button";
  launch.innerHTML = '<span aria-hidden="true">▶</span> Watch video guide';
  actions.appendChild(launch);
  const videoPaths = {
    "web-development.html": "tutorials/web-development-guide.mp4",
    "crm.html": "tutorials/crm-guide.mp4",
    "booking-system.html": "tutorials/booking-system-guide.mp4",
    "branding.html": "tutorials/branding-guide.mp4",
    "ai-automation.html": "tutorials/ai-automation-guide.mp4",
    "social-media.html": "tutorials/social-media-guide.mp4"
  };
  const overlay = document.createElement("div");
  overlay.className = "service-tutorial";
  overlay.hidden = true;
  overlay.innerHTML = `<div class="service-tutorial__dialog" role="dialog" aria-modal="true" aria-label="${tutorial.title}">
    <div class="service-tutorial__top"><div><span class="service-tutorial__eyebrow">QP DIGITAL VIDEO GUIDE</span><strong>${tutorial.title}</strong></div><button type="button" class="service-tutorial__close" aria-label="Close video guide">×</button></div>
    <video class="service-tutorial__video" controls playsinline preload="metadata" poster="favicon-512.png"><source src="${videoPaths[page]}" type="video/mp4">Your browser does not support this video.</video>
    <div class="service-tutorial__caption"><strong>What this video covers</strong><p>${tutorial.intro} Use pause, rewind, picture-in-picture or fullscreen whenever you need more time.</p></div>
  </div>`;
  document.body.appendChild(overlay);
  const video = overlay.querySelector("video");
  launch.addEventListener("click", () => { overlay.hidden = false; document.body.classList.add("tutorial-open"); video.play().catch(() => {}); });
  overlay.querySelector(".service-tutorial__close").addEventListener("click", () => { video.pause(); overlay.hidden = true; document.body.classList.remove("tutorial-open"); });
  overlay.addEventListener("click", (event) => { if (event.target === overlay) overlay.querySelector(".service-tutorial__close").click(); });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !overlay.hidden) overlay.querySelector(".service-tutorial__close").click(); });
}
installServiceTutorial();

window.setInterval(syncLiveServiceAccess, 15000);
window.addEventListener("focus", syncLiveServiceAccess);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) syncLiveServiceAccess();
});
syncLiveServiceAccess();
