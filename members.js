const form = document.getElementById("memberLoginForm");
const codeInput = document.getElementById("memberCode");
const note = document.getElementById("memberLoginNote");
const results = document.getElementById("memberResults");
const memberAccess = document.getElementById("memberAccess");
const adminAccess = document.getElementById("adminAccess");
const memberModeButton = document.getElementById("memberModeButton");
const adminModeButton = document.getElementById("adminModeButton");
const adminLoginForm = document.getElementById("adminPortalLoginForm");
const adminLoginNote = document.getElementById("adminPortalLoginNote");
const adminMemberResults = document.getElementById("adminMemberResults");

const ADMIN_SESSION_STORAGE_KEY = "qpAdminSession";

function selectPortalMode(mode) {
  const adminMode = mode === "admin";
  memberAccess.hidden = adminMode;
  adminAccess.hidden = !adminMode;
  memberModeButton.classList.toggle("is-active", !adminMode);
  adminModeButton.classList.toggle("is-active", adminMode);
  memberModeButton.setAttribute("aria-selected", String(!adminMode));
  adminModeButton.setAttribute("aria-selected", String(adminMode));
  if (adminMode) document.getElementById("adminPortalEmail").focus();
  else document.getElementById("memberEmail").focus();
}

memberModeButton.addEventListener("click", () => selectPortalMode("member"));
adminModeButton.addEventListener("click", () => selectPortalMode("admin"));

document.getElementById("year").textContent = new Date().getFullYear();

const themeToggle = document.getElementById("themeToggle");
const themeLabel = themeToggle.querySelector(".theme-toggle__label");
function syncTheme() {
  const light = document.documentElement.dataset.theme === "light";
  themeLabel.textContent = light ? "Dark" : "Light";
  themeToggle.setAttribute("aria-pressed", String(light));
}
syncTheme();
themeToggle.addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
  document.documentElement.dataset.theme = next;
  localStorage.setItem("qpTheme", next);
  syncTheme();
});

const navToggle = document.getElementById("navToggle");
navToggle.addEventListener("click", () => {
  const open = document.getElementById("nav").classList.toggle("is-open");
  navToggle.setAttribute("aria-expanded", String(open));
});

codeInput.addEventListener("input", () => {
  const digits = codeInput.value.replace(/\D/g, "").slice(0, 12);
  codeInput.value = digits.replace(/(\d{4})(?=\d)/g, "$1 ");
});

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : "";
  } catch { return ""; }
}

const SERVICE_CATALOG = [
  { name: "Websites", description: "Custom-built, mobile-friendly websites designed to turn visitors into customers.", aliases: ["website", "web design"] },
  { name: "CRM", description: "Track every lead, customer and conversation in one organised system.", aliases: ["crm", "customer relationship"] },
  { name: "Website Management", description: "Ongoing updates, hosting, security and fixes for your website.", aliases: ["website management", "site management", "hosting"] },
  { name: "SEO", description: "Search optimisation that helps local customers find your business.", aliases: ["seo", "search optimisation", "search optimization"] },
  { name: "Booking System", description: "Online appointment and service booking available around the clock.", aliases: ["booking", "appointments"] },
  { name: "Branding & Print", description: "Logos, brand identity, flyers and business cards.", aliases: ["branding", "logo", "flyer", "business card", "print"] },
  { name: "Social Media & Content", description: "Posts, captions and content that keep your business visible.", aliases: ["social media", "content"] },
  { name: "Reporting Dashboards", description: "View leads, calls, bookings and sales in one dashboard.", aliases: ["reporting", "dashboard", "analytics"] },
  { name: "Automation Systems", description: "Automate repetitive administration and business processes.", aliases: ["automation system", "workflow automation"] },
  { name: "Automated Follow-Ups", description: "Automatically follow up missed calls, quotes and review requests.", aliases: ["follow-up", "follow up", "followup"] },
  { name: "Chatbots & Live Chat", description: "Answer questions and capture leads through automated or live chat.", aliases: ["chatbot", "live chat", "ai assistant"] },
];

function findPurchasedService(service, purchases) {
  return purchases.find((purchase) => {
    const searchable = `${purchase.title || ""} ${purchase.service || ""}`.toLowerCase();
    return searchable.includes("all services") || service.aliases.some((alias) => searchable.includes(alias));
  });
}

function renderServiceLibrary(purchases) {
  return SERVICE_CATALOG.map((service) => {
    const purchase = findPurchasedService(service, purchases);
    if (!purchase) {
      return `<button class="portal-service portal-service--locked" type="button" data-quote-service="${escapeHtml(service.name)}" aria-label="${escapeHtml(service.name)} — locked; request a quote"><div class="portal-service__blur" aria-hidden="true"><span class="status-pill">Available service</span><p>${escapeHtml(service.description)}</p><div class="portal-service__placeholder"></div></div><div class="portal-service__lock"><span aria-hidden="true">&#128274;</span><h3>${escapeHtml(service.name)}</h3><strong>Locked</strong><small>Click to request a quote.</small></div></button>`;
    }
    const liveUrl = safeUrl(purchase.liveUrl);
    const fileUrl = safeUrl(purchase.deliverableFileUrl);
    const date = purchase.activatedAt ? new Date(purchase.activatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "Active";
    return `<article class="portal-service portal-service--unlocked"><div class="portal-service__top"><span class="status-pill status-pill--active">Unlocked</span><span class="portal-service__key" aria-label="Unlocked">&#128275;</span></div><h3>${escapeHtml(service.name)}</h3><p>${escapeHtml(service.description)}</p><dl><div><dt>Account</dt><dd>${escapeHtml(purchase.account)}</dd></div><div><dt>Activated</dt><dd>${escapeHtml(date)}</dd></div><div><dt>Price</dt><dd>${escapeHtml(purchase.price)}</dd></div></dl><div class="member-purchase__actions">${liveUrl ? `<a class="btn btn--primary" href="${escapeHtml(liveUrl)}" target="_blank" rel="noopener">Open ${escapeHtml(service.name)} →</a>` : `<span class="portal-service__active-note">Your service is active</span>`}${fileUrl ? `<a class="btn btn--ghost" href="${escapeHtml(fileUrl)}" target="_blank" rel="noopener" download>Download Your Files →</a>` : ""}</div></article>`;
  }).join("");
}

function renderPurchases(purchases) {
  results.innerHTML = `<div class="member-results__head"><div><p class="section__tag">// Access Granted</p><h2>Your Qp Digital services</h2><p>Everything Qp Digital offers is shown below. Your purchases are unlocked and ready to use.</p></div><button class="btn btn--ghost" id="memberLogout" type="button">Sign Out</button></div><div class="portal-service-grid">${renderServiceLibrary(purchases)}</div><div class="portal-more-service"><p>Want another service?</p><button class="btn btn--primary" type="button" data-quote-service="another Qp Digital service">Get a Quote →</button></div><div class="portal-quote-modal" id="portalQuoteModal" hidden><div class="portal-quote-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="portalQuoteTitle"><span class="portal-quote-modal__icon" aria-hidden="true">&#128274;</span><p class="section__tag">// Locked Service</p><h2 id="portalQuoteTitle">Get a quote?</h2><p id="portalQuoteService"></p><div class="portal-quote-modal__actions"><button class="btn btn--ghost" id="portalQuoteCancel" type="button">Cancel</button><a class="btn btn--primary" href="https://qp-digital.co.uk/#enquire">Continue →</a></div></div></div>`;
  form.hidden = true;
  document.getElementById("memberPanelLead").hidden = true;
  results.hidden = false;
  const quoteModal = document.getElementById("portalQuoteModal");
  results.querySelectorAll("[data-quote-service]").forEach((card) => card.addEventListener("click", () => {
    document.getElementById("portalQuoteService").textContent = `Would you like to request a quote for ${card.dataset.quoteService}?`;
    quoteModal.hidden = false;
    document.getElementById("portalQuoteCancel").focus();
  }));
  document.getElementById("portalQuoteCancel").addEventListener("click", () => { quoteModal.hidden = true; });
  quoteModal.addEventListener("click", (event) => { if (event.target === quoteModal) quoteModal.hidden = true; });
  document.getElementById("memberLogout").addEventListener("click", () => {
    results.hidden = true;
    results.innerHTML = "";
    form.reset();
    form.hidden = false;
    document.getElementById("memberPanelLead").hidden = false;
    note.textContent = "";
  });
}

function renderAdministratorMembers(clients, email) {
  const memberCards = clients.map((client, index) => {
    const liveUrl = safeUrl(client.liveUrl);
    const fileUrl = safeUrl(client.deliverableFileUrl);
    const active = client.status === "active";
    const created = client.createdAt ? new Date(client.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "—";
    return `<article class="member-purchase"><div class="member-purchase__number">${String(index + 1).padStart(2, "0")}</div><div class="member-purchase__content"><span class="status-pill ${active ? "status-pill--active" : ""}">${active ? "Active" : "Pending payment"}</span><h3>${escapeHtml(client.title || client.service)}</h3><p>${escapeHtml(client.clientEmail || "No client email saved")}</p><dl><div><dt>Account</dt><dd>${escapeHtml(client.account)}</dd></div><div><dt>Created</dt><dd>${escapeHtml(created)}</dd></div><div><dt>Price</dt><dd>${escapeHtml(client.price)}</dd></div></dl><p>${escapeHtml(client.preview || "No description added.")}</p><div class="member-purchase__actions">${liveUrl ? `<a class="btn btn--primary" href="${escapeHtml(liveUrl)}" target="_blank" rel="noopener">Open Service →</a>` : ""}${fileUrl ? `<a class="btn btn--ghost" href="${escapeHtml(fileUrl)}" target="_blank" rel="noopener">Open Deliverable →</a>` : ""}</div></div></article>`;
  }).join("");

  adminLoginForm.hidden = true;
  adminLoginForm.previousElementSibling.hidden = true;
  adminLoginForm.nextElementSibling.hidden = true;
  adminMemberResults.innerHTML = `<div class="member-results__head"><div><p class="section__tag">// Administrator Access</p><h2>All member portals</h2><p>Logged in as ${escapeHtml(email)} · ${clients.length} member record${clients.length === 1 ? "" : "s"}</p></div><button class="btn btn--ghost" id="adminMemberLogout" type="button">Sign Out</button></div>${memberCards || '<p class="members-panel__lead">No member records have been created yet.</p>'}`;
  adminMemberResults.hidden = false;
  document.getElementById("adminMemberLogout").addEventListener("click", () => {
    localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
    sessionStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
    adminMemberResults.hidden = true;
    adminMemberResults.innerHTML = "";
    adminLoginForm.reset();
    adminLoginForm.hidden = false;
    adminLoginForm.previousElementSibling.hidden = false;
    adminLoginForm.nextElementSibling.hidden = false;
    adminLoginNote.textContent = "";
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = form.querySelector("button[type=submit]");
  note.textContent = "Checking your secure access…";
  button.disabled = true;
  try {
    const response = await fetch("/api/member-access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: form.email.value.trim(), code: form.code.value }) });
    const data = await response.json();
    if (!response.ok || data.status !== "ok") throw new Error(data.message || "We couldn't verify those details.");
    renderPurchases(data.purchases);
  } catch (error) {
    note.textContent = error.message || "We couldn't verify those details. Check the email and code, then try again.";
  } finally { button.disabled = false; }
});

adminLoginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = adminLoginForm.querySelector("button[type=submit]");
  const email = adminLoginForm.email.value.trim();
  const remember = adminLoginForm.remember.checked;
  adminLoginNote.textContent = "Verifying administrator access…";
  button.disabled = true;

  try {
    const response = await fetch("/api/admin_login.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: adminLoginForm.password.value, remember }),
    });
    const data = await response.json();
    if (!response.ok || data.status !== "ok" || !data.token) {
      throw new Error(data.message || "Wrong administrator email or password.");
    }

    const storedSession = JSON.stringify({ token: data.token, email });
    if (remember) {
      localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, storedSession);
      sessionStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
    } else {
      sessionStorage.setItem(ADMIN_SESSION_STORAGE_KEY, storedSession);
      localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
    }
    adminLoginForm.password.value = "";
    adminLoginNote.textContent = "Access granted. Loading every member portal…";
    const membersResponse = await fetch("/api/list_clients.php", {
      headers: { Authorization: `Bearer ${data.token}` },
    });
    const membersData = await membersResponse.json();
    if (!membersResponse.ok || membersData.status !== "ok") {
      throw new Error(membersData.message || "The member records could not be loaded.");
    }
    renderAdministratorMembers(membersData.clients || [], email);
  } catch (error) {
    adminLoginNote.textContent = error.message || "We couldn't verify your administrator details. Please try again.";
  } finally {
    button.disabled = false;
  }
});
