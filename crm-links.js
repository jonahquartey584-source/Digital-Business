// Points every [data-crm-link] on crm.html at the matching page in the real
// Qp Digital app — that app (Supabase-backed, on the qp-digital-saas-crm-*
// branch) is where the actual working CRM lives; this site only handles
// members-portal auth + billing. See netlify/functions/_shared.mts's
// provisionRealAppAccess() for how an email that pays for CRM here gets an
// active "crm" subscription over there too, so this link isn't a paywall
// for something already paid for.
//
// REAL_APP_URL intentionally has no trailing slash.
const REAL_APP_URL = "https://qp-digital-crm-app.netlify.app";

const CRM_DEST_PATH = {
  pipeline: "/dashboard/crm/pipeline",
  leads: "/dashboard/crm/leads",
  contacts: "/dashboard/crm/contacts",
  tasks: "/dashboard/crm/tasks",
  reporting: "/dashboard/crm/reporting",
  import: "/dashboard/crm/import",
};

function currentMemberEmail() {
  const raw = localStorage.getItem("qpMemberSession") || sessionStorage.getItem("qpMemberSession");
  if (!raw) return null;
  try {
    return JSON.parse(raw).email || null;
  } catch {
    return null;
  }
}

const email = currentMemberEmail();

document.querySelectorAll("[data-crm-link]").forEach((el) => {
  const dest = CRM_DEST_PATH[el.dataset.crmLink];
  if (!dest) return;
  const url = new URL(dest, REAL_APP_URL);
  // Prefill only — the real app's own login/signup still requires the
  // actual password. This just saves re-typing an email already on file.
  if (email) url.searchParams.set("email", email);
  el.href = url.toString();
});

const emailTarget = document.querySelector("[data-member-account-email]");
if (emailTarget) emailTarget.textContent = email || "the email you paid with";
