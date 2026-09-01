import { getUser, handleAuthCallback, login, logout, signup } from "@netlify/identity";

await handleAuthCallback().catch(() => null);

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
const passwordLoginForm = document.getElementById("memberPasswordLoginForm");
const createPasswordForm = document.getElementById("memberCreatePasswordForm");
const passwordLoginNote = document.getElementById("memberPasswordLoginNote");
const createPasswordNote = document.getElementById("memberCreatePasswordNote");
const firstLoginButton = document.getElementById("firstLoginButton");
const passwordLoginButton = document.getElementById("passwordLoginButton");
let verifiedFirstLogin = null;
let activeAdminToken = "";

const ADMIN_SESSION_STORAGE_KEY = "qpAdminSession";
const MEMBER_SESSION_STORAGE_KEY = "qpMemberSession";

// Head-admin auto-recognition: if the Netlify Identity user already signed
// in through the ordinary Member "Password login" form is the site's
// ADMIN_EMAIL, this silently exchanges that for an admin session token —
// no separate admin password prompt. Same qpAdminSession storage shape
// admin.html itself reads, so opening it (the embedded New Client Setup
// iframe below included, same origin) picks the session straight up too.
async function tryAutoAdminSession() {
  try {
    const response = await fetch("/api/admin_auto_session.php");
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.status !== "ok" || !data.token) return false;
    activeAdminToken = data.token;
    localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, JSON.stringify({ token: data.token, email: data.email }));
    sessionStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

// Sends a recognised administrator straight to the Admin Dashboard — its
// own full page with New Client Setup, Members, AI Agent Requests and
// Website Enquiries each getting their own uncrowded page, rather than
// cramming any of that in here. admin.html reads the same qpAdminSession
// this page just wrote, so it opens straight in, no second login.
function goToAdminDashboard() {
  window.location.href = "admin.html";
}

function selectMemberLoginMode(mode) {
  const returning = mode === "password";
  form.hidden = returning;
  passwordLoginForm.hidden = !returning;
  createPasswordForm.hidden = true;
  firstLoginButton.classList.toggle("is-active", !returning);
  passwordLoginButton.classList.toggle("is-active", returning);
  firstLoginButton.setAttribute("aria-selected", String(!returning));
  passwordLoginButton.setAttribute("aria-selected", String(returning));
  if (returning) document.getElementById("returningMemberEmail").focus();
  else document.getElementById("memberEmail").focus();
}

firstLoginButton.addEventListener("click", () => selectMemberLoginMode("code"));
passwordLoginButton.addEventListener("click", () => selectMemberLoginMode("password"));

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
adminModeButton.addEventListener("click", () => {
  // Already recognised/logged in as administrator (auto-recognition or an
  // earlier login this session) — no need to show the tab at all, straight
  // to the Admin Dashboard.
  if (activeAdminToken) {
    goToAdminDashboard();
    return;
  }
  selectPortalMode("admin");
});

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
  { name: "Web Development", page: "web-development.html", description: "View your website, request edits and manage your ongoing website plan.", aliases: ["website", "web design", "website management", "site management", "hosting", "seo"] },
  { name: "CRM", page: "crm.html", description: "Manage your personalised lead database and sales pipeline.", aliases: ["crm", "customer relationship"] },
  { name: "Booking System", page: "booking-system.html", description: "Manage appointments, availability, services and customer bookings.", aliases: ["booking", "appointments"] },
  { name: "Branding", page: "branding.html", description: "View and download your branding products or request more work.", aliases: ["branding", "logo", "flyer", "business card", "print"] },
  { name: "AI & Automation", page: "ai-automation.html", description: "Control the AI tools and automated workflows running for your business.", aliases: ["ai", "automation", "chatbot", "follow-up", "follow up", "live chat"] },
  { name: "Social Media", page: "social-media.html", description: "Review your content, approvals, publishing plan and campaign progress.", aliases: ["social media", "content"] },
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
    const dashboardUrl = `${service.page}?account=${encodeURIComponent(purchase.account)}`;
    return `<article class="portal-service portal-service--unlocked"><div class="portal-service__top"><span class="status-pill status-pill--active">Unlocked</span><span class="portal-service__key" aria-label="Unlocked">&#128275;</span></div><h3>${escapeHtml(service.name)}</h3><p>${escapeHtml(service.description)}</p><dl><div><dt>Account</dt><dd>${escapeHtml(purchase.account)}</dd></div><div><dt>Activated</dt><dd>${escapeHtml(date)}</dd></div><div><dt>Price</dt><dd>${escapeHtml(purchase.price)}</dd></div></dl><div class="member-purchase__actions"><a class="btn btn--primary" href="${escapeHtml(dashboardUrl)}" target="_blank" rel="noopener">Launch ${escapeHtml(service.name)} ↗</a>${fileUrl ? `<a class="btn btn--ghost" href="${escapeHtml(fileUrl)}" target="_blank" rel="noopener" download>Download Your Files →</a>` : ""}</div></article>`;
  }).join("");
}

function renderPurchases(purchases, profile = null) {
  sessionStorage.setItem("qpMemberPurchases", JSON.stringify(purchases));
  localStorage.setItem("qpMemberPurchases", JSON.stringify(purchases));
  results.innerHTML = `<div class="member-results__head"><div><p class="section__tag">// Access Granted</p><h1>Qp Digital Members Portal</h1><p>${profile ? `Welcome, ${escapeHtml(profile.contactName)} from ${escapeHtml(profile.businessName)}.` : "Everything Qp Digital offers is shown below."} Your purchases are unlocked and ready to use.</p></div><button class="btn btn--ghost" id="memberLogout" type="button">Sign Out</button></div><div class="portal-service-grid">${renderServiceLibrary(purchases)}</div><div class="portal-more-service"><p>Want another service?</p><button class="btn btn--primary" type="button" data-quote-service="another Qp Digital service">Get a Quote →</button></div><div class="portal-quote-modal" id="portalQuoteModal" hidden><div class="portal-quote-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="portalQuoteTitle"><span class="portal-quote-modal__icon" aria-hidden="true">&#128274;</span><p class="section__tag">// Locked Service</p><h2 id="portalQuoteTitle">Get a quote?</h2><p id="portalQuoteService"></p><div class="portal-quote-modal__actions"><button class="btn btn--ghost" id="portalQuoteCancel" type="button">Cancel</button><a class="btn btn--primary" href="https://qp-digital.co.uk/#enquire">Continue →</a></div></div></div>`;
  form.hidden = true;
  passwordLoginForm.hidden = true;
  createPasswordForm.hidden = true;
  document.querySelector(".member-login-mode").hidden = true;
  document.getElementById("memberPanelLead").hidden = true;
  results.hidden = false;
  document.querySelector(".members-page").classList.add("is-dashboard");
  const quoteModal = document.getElementById("portalQuoteModal");
  results.querySelectorAll("[data-quote-service]").forEach((card) => card.addEventListener("click", () => {
    document.getElementById("portalQuoteService").textContent = `Would you like to request a quote for ${card.dataset.quoteService}?`;
    quoteModal.hidden = false;
    document.getElementById("portalQuoteCancel").focus();
  }));
  document.getElementById("portalQuoteCancel").addEventListener("click", () => { quoteModal.hidden = true; });
  quoteModal.addEventListener("click", (event) => { if (event.target === quoteModal) quoteModal.hidden = true; });
  document.getElementById("memberLogout").addEventListener("click", async () => {
    await logout().catch(() => {});
    localStorage.removeItem(MEMBER_SESSION_STORAGE_KEY);
    sessionStorage.removeItem(MEMBER_SESSION_STORAGE_KEY);
    results.hidden = true;
    results.innerHTML = "";
    form.reset();
    form.hidden = false;
    document.querySelector(".member-login-mode").hidden = false;
    selectMemberLoginMode("password");
    document.getElementById("memberPanelLead").hidden = false;
    document.querySelector(".members-page").classList.remove("is-dashboard");
    note.textContent = "";
  });
}

function openMemberPortal(purchases, email, remember = false) {
  const memberSession = JSON.stringify({ email, purchases, expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000) });
  if (remember) {
    localStorage.setItem(MEMBER_SESSION_STORAGE_KEY, memberSession);
    sessionStorage.removeItem(MEMBER_SESSION_STORAGE_KEY);
  } else {
    sessionStorage.setItem(MEMBER_SESSION_STORAGE_KEY, memberSession);
    localStorage.removeItem(MEMBER_SESSION_STORAGE_KEY);
  }
  const key = `qpMemberProfile:${email.toLowerCase()}`;
  const saved = localStorage.getItem(key);
  if (saved) { renderPurchases(purchases, JSON.parse(saved)); return; }
  form.hidden = true;
  document.getElementById("memberPanelLead").hidden = true;
  results.hidden = false;
  results.innerHTML = `<div class="member-onboarding"><p class="section__tag">// First-time setup</p><h2>Tell us about your business</h2><p class="members-panel__lead">Answer five quick questions so Qp Digital can personalise your services.</p><form class="member-login" id="memberOnboardingForm"><label>Your name</label><input name="contactName" required><label>Business name</label><input name="businessName" required><label>What industry are you in?</label><input name="industry" required><label>Who is your ideal customer?</label><textarea name="idealCustomer" required></textarea><label>What is your main business goal?</label><textarea name="primaryGoal" required></textarea><button class="btn btn--primary btn--lg" type="submit">Personalise My Portal →</button></form></div>`;
  document.getElementById("memberOnboardingForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    localStorage.setItem(key, JSON.stringify(data));
    sessionStorage.setItem("qpMemberProfile", JSON.stringify(data));
    renderPurchases(purchases, data);
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
    verifiedFirstLogin = { email: form.email.value.trim().toLowerCase(), purchases: data.purchases };
    form.hidden = true;
    passwordLoginForm.hidden = true;
    document.querySelector(".member-login-mode").hidden = true;
    createPasswordForm.hidden = false;
    document.getElementById("newMemberPassword").focus();
    note.textContent = "";
  } catch (error) {
    note.textContent = error.message || "We couldn't verify those details. Check the email and code, then try again.";
  } finally { button.disabled = false; }
});

createPasswordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!verifiedFirstLogin) return;
  const button = createPasswordForm.querySelector("button[type=submit]");
  const password = createPasswordForm.password.value;
  if (password !== createPasswordForm.confirmPassword.value) {
    createPasswordNote.textContent = "The passwords do not match.";
    return;
  }
  createPasswordNote.textContent = "Creating your secure account…";
  button.disabled = true;
  try {
    const user = await signup(verifiedFirstLogin.email, password, { full_name: verifiedFirstLogin.email.split("@")[0] });
    if (!user.emailVerified) {
      createPasswordNote.textContent = "Your account was created. Check your email to confirm it, then use Password login.";
      selectMemberLoginMode("password");
      passwordLoginForm.email.value = verifiedFirstLogin.email;
      return;
    }
    openMemberPortal(verifiedFirstLogin.purchases, verifiedFirstLogin.email, createPasswordForm.remember.checked);
  } catch (error) {
    const message = String(error?.message || "We couldn't create your password.");
    createPasswordNote.textContent = /already|registered|exists/i.test(message)
      ? "An account already exists for this email. Choose Password login instead."
      : message;
  } finally {
    button.disabled = false;
  }
});

passwordLoginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = passwordLoginForm.querySelector("button[type=submit]");
  const email = passwordLoginForm.email.value.trim().toLowerCase();
  passwordLoginNote.textContent = "Signing you in securely…";
  button.disabled = true;
  try {
    await login(email, passwordLoginForm.password.value);
    // Same Identity sign-in doubles as the admin check — no second password.
    // A recognised head administrator goes straight to the Admin Dashboard.
    const isHeadAdmin = await tryAutoAdminSession();
    if (isHeadAdmin) {
      goToAdminDashboard();
      return;
    }
    const response = await fetch("/api/member-purchases");
    const data = await response.json();
    if (!response.ok || data.status !== "ok") throw new Error(data.message || "Your purchased services could not be loaded.");
    passwordLoginForm.password.value = "";
    openMemberPortal(data.purchases, email, passwordLoginForm.remember.checked);
  } catch (error) {
    passwordLoginNote.textContent = error?.status === 401
      ? "Incorrect email or password."
      : (error?.message || "We couldn't sign you in. Please try again.");
  } finally {
    button.disabled = false;
  }
});

const identityUser = await getUser().catch(() => null);

// Runs on every page load where Identity already has this browser signed
// in (password login persists across reloads) — so a head administrator's
// token is ready the instant they click the Administrator tab, without
// forcing a redirect just for loading this page.
if (identityUser?.email) {
  tryAutoAdminSession();
}

const rememberedMember = localStorage.getItem(MEMBER_SESSION_STORAGE_KEY) || sessionStorage.getItem(MEMBER_SESSION_STORAGE_KEY);
if (rememberedMember) {
  try {
    const session = JSON.parse(rememberedMember);
    if (identityUser?.email?.toLowerCase() === session.email?.toLowerCase() && session.expiresAt > Date.now() && Array.isArray(session.purchases)) {
      openMemberPortal(session.purchases, session.email, Boolean(localStorage.getItem(MEMBER_SESSION_STORAGE_KEY)));
    } else {
      localStorage.removeItem(MEMBER_SESSION_STORAGE_KEY);
      sessionStorage.removeItem(MEMBER_SESSION_STORAGE_KEY);
    }
  } catch {
    localStorage.removeItem(MEMBER_SESSION_STORAGE_KEY);
    sessionStorage.removeItem(MEMBER_SESSION_STORAGE_KEY);
  }
}

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
    activeAdminToken = data.token;
    if (remember) {
      localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, storedSession);
      sessionStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
    } else {
      sessionStorage.setItem(ADMIN_SESSION_STORAGE_KEY, storedSession);
      localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
    }
    adminLoginForm.password.value = "";
    adminLoginNote.textContent = "Access granted — opening the Admin Dashboard…";
    goToAdminDashboard();
  } catch (error) {
    adminLoginNote.textContent = error.message || "We couldn't verify your administrator details. Please try again.";
  } finally {
    button.disabled = false;
  }
});
