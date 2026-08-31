const servicePage = document.querySelector("[data-member-service]");
const gate = document.getElementById("memberServiceGate");
const accountTarget = document.querySelector("[data-member-account]");
const params = new URLSearchParams(location.search);
const account = params.get("account") || "Member account";
const purchases = JSON.parse(sessionStorage.getItem("qpMemberPurchases") || "[]");
const serviceTerms = (servicePage?.dataset.serviceAliases || "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
const allowed = purchases.some((purchase) => {
  const text = `${purchase.title || ""} ${purchase.service || ""}`.toLowerCase();
  return text.includes("all services") || serviceTerms.some((term) => text.includes(term));
});
if (servicePage && allowed) {
  servicePage.hidden = false;
  if (accountTarget) accountTarget.textContent = account;
} else if (gate) {
  gate.hidden = false;
}
document.querySelectorAll("[data-theme-toggle]").forEach((button) => button.addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
  document.documentElement.dataset.theme = next;
  localStorage.setItem("qpTheme", next);
  button.textContent = next === "light" ? "Dark" : "Light";
}));
