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
