const form = document.getElementById("memberLoginForm");
const codeInput = document.getElementById("memberCode");
const note = document.getElementById("memberLoginNote");
const results = document.getElementById("memberResults");

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

function renderPurchases(purchases) {
  results.innerHTML = `<div class="member-results__head"><div><p class="section__tag">// Access Granted</p><h2>Your purchases</h2></div><button class="btn btn--ghost" id="memberLogout" type="button">Sign Out</button></div>` + purchases.map((purchase, index) => {
    const liveUrl = safeUrl(purchase.liveUrl);
    const fileUrl = safeUrl(purchase.deliverableFileUrl);
    const date = purchase.activatedAt ? new Date(purchase.activatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "Active";
    return `<article class="member-purchase"><div class="member-purchase__number">${String(index + 1).padStart(2, "0")}</div><div class="member-purchase__content"><span class="status-pill status-pill--active">Active</span><h3>${escapeHtml(purchase.title || purchase.service)}</h3><p>${escapeHtml(purchase.service)}</p><dl><div><dt>Account</dt><dd>${escapeHtml(purchase.account)}</dd></div><div><dt>Activated</dt><dd>${escapeHtml(date)}</dd></div><div><dt>Price</dt><dd>${escapeHtml(purchase.price)}</dd></div></dl><div class="member-purchase__actions">${liveUrl ? `<a class="btn btn--primary" href="${escapeHtml(liveUrl)}" target="_blank" rel="noopener">Open Your Service →</a>` : ""}${fileUrl ? `<a class="btn btn--ghost" href="${escapeHtml(fileUrl)}" target="_blank" rel="noopener" download>Download Your Files →</a>` : ""}</div></div></article>`;
  }).join("");
  form.hidden = true;
  document.querySelector(".members-panel__lead").hidden = true;
  results.hidden = false;
  document.getElementById("memberLogout").addEventListener("click", () => {
    results.hidden = true;
    results.innerHTML = "";
    form.reset();
    form.hidden = false;
    document.querySelector(".members-panel__lead").hidden = false;
    note.textContent = "";
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
