const savedMemberTheme = localStorage.getItem("qpTheme") === "light" ? "light" : "dark";
document.documentElement.dataset.theme = savedMemberTheme;

const servicePage = document.querySelector("[data-member-service]");
const gate = document.getElementById("memberServiceGate");
const accountTarget = document.querySelector("[data-member-account]");
const params = new URLSearchParams(location.search);
const account = params.get("account") || "Member account";
const purchases = JSON.parse(sessionStorage.getItem("qpMemberPurchases") || localStorage.getItem("qpMemberPurchases") || "[]");
const serviceTerms = (servicePage?.dataset.serviceAliases || "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
const allowed = purchases.some((purchase) => {
  const text = `${purchase.title || ""} ${purchase.service || ""}`.toLowerCase();
  return text.includes("all services") || serviceTerms.some((term) => text.includes(term));
});
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
if (servicePage && allowed) {
  clearDemonstrationContent();
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
