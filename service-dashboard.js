const SERVICE_DASHBOARDS = {
  "Websites": ["Website dashboard", "View your website details, current status and available files."],
  "CRM": ["Your personalised CRM", "Access the Qp CRM workspace assigned to your business."],
  "Website Management": ["Website management & SEO", "View management coverage, SEO activity and request website changes."],
  "Booking System": ["Booking dashboard", "Access bookings, availability and service configuration."],
  "Branding & Print": ["Brand assets", "View and download your completed branding and print files."],
  "Social Media & Content": ["Content workspace", "View planned content, delivered assets and current activity."],
  "Reporting Dashboards": ["Reporting dashboard", "Open your reports and track leads, calls, bookings and sales."],
  "Automation Systems": ["Automation dashboard", "View your active workflows, triggers and automated processes."],
  "Automated Follow-Ups": ["Follow-up dashboard", "View active follow-up sequences and their status."],
  "Chatbots & Live Chat": ["Chat dashboard", "View your chatbot or live-chat service and support information."],
};
const SERVICE_ALIASES = {
  "Websites": ["website", "web design"], "CRM": ["crm", "customer relationship"],
  "Website Management": ["website management", "site management", "hosting", "seo"],
  "Booking System": ["booking", "appointment"], "Branding & Print": ["branding", "logo", "flyer", "print"],
  "Social Media & Content": ["social media", "content"], "Reporting Dashboards": ["reporting", "dashboard", "analytics"],
  "Automation Systems": ["automation system", "workflow automation"], "Automated Follow-Ups": ["follow-up", "follow up", "followup"],
  "Chatbots & Live Chat": ["chatbot", "live chat", "ai assistant"],
};

const params = new URLSearchParams(location.search);
const serviceName = params.get("service") || "";
const account = params.get("account") || "";
let purchases = [];
try { purchases = JSON.parse(sessionStorage.getItem("qpMemberPurchases") || "[]"); } catch {}
let memberProfile = null;
try { memberProfile = JSON.parse(sessionStorage.getItem("qpMemberProfile") || "null"); } catch {}
const purchase = purchases.find((item) => {
  if (item.account !== account) return false;
  const searchable = `${item.title || ""} ${item.service || ""}`.toLowerCase();
  return searchable.includes("all services") || (SERVICE_ALIASES[serviceName] || []).some((alias) => searchable.includes(alias));
});
const dashboard = SERVICE_DASHBOARDS[serviceName];

if (!purchase || !dashboard) {
  document.getElementById("serviceDashboardError").hidden = false;
} else {
  document.title = `${serviceName} Dashboard — Qp Digital`;
  document.getElementById("serviceTitle").textContent = serviceName;
  document.getElementById("serviceDescription").textContent = dashboard[1];
  document.getElementById("serviceAccount").textContent = purchase.account;
  document.getElementById("serviceActivated").textContent = purchase.activatedAt ? new Date(purchase.activatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "Active";
  document.getElementById("servicePrice").textContent = purchase.price;
  document.getElementById("workspaceTitle").textContent = dashboard[0];
  document.getElementById("workspaceText").textContent = memberProfile ? `${dashboard[1]} Personalised for ${memberProfile.businessName}, a ${memberProfile.industry} business focused on ${memberProfile.primaryGoal}.` : dashboard[1];
  const liveUrl = purchase.liveUrl && /^https?:\/\//.test(purchase.liveUrl) ? purchase.liveUrl : "";
  const fileUrl = purchase.deliverableFileUrl && /^https?:\/\//.test(purchase.deliverableFileUrl) ? purchase.deliverableFileUrl : "";
  document.getElementById("serviceActions").innerHTML = `${liveUrl ? `<a class="btn btn--primary" href="${liveUrl}" target="_blank" rel="noopener">Open Live Service →</a>` : '<span class="portal-service__active-note">Service active</span>'}${fileUrl ? `<a class="btn btn--ghost" href="${fileUrl}" target="_blank" rel="noopener">Download Files →</a>` : ""}`;
  document.getElementById("serviceDashboard").hidden = false;
}

const themeToggle = document.getElementById("themeToggle");
const themeLabel = themeToggle.querySelector(".theme-toggle__label");
function syncTheme() { const light = document.documentElement.dataset.theme === "light"; themeLabel.textContent = light ? "Dark" : "Light"; }
syncTheme();
themeToggle.addEventListener("click", () => { const next = document.documentElement.dataset.theme === "light" ? "dark" : "light"; document.documentElement.dataset.theme = next; localStorage.setItem("qpTheme", next); syncTheme(); });
