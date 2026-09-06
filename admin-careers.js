// Job Applications: every application submitted through careers.html.
// Fetches the same /api/agent-requests list the AI Agent Requests and
// Website Enquiries admin pages use and shows only the job-application
// half of it. Session handling lives in admin-common.js (loaded before
// this file).

const session = requireAdminSession();
if (session) {
  const loggedInEmail = document.getElementById("loggedInEmail");
  if (loggedInEmail) loggedInEmail.textContent = session.email;
}

const applicationsContainer = document.getElementById("applicationsContainer");
const applicationsNote = document.getElementById("applicationsNote");
const refreshApplicationsBtn = document.getElementById("refreshApplicationsBtn");
const applicationsSearchInput = document.getElementById("applicationsSearchInput");
let applicationsCache = [];

async function loadApplications() {
  if (!applicationsContainer) return;
  applicationsNote.textContent = "Loading…";
  try {
    const response = await fetch("/api/agent-requests", { headers: adminAuthHeader() });
    if (response.status === 401) return adminHandleSessionRejected();
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Could not load applications");
    applicationsCache = result.requests;
    renderApplications();
  } catch (error) {
    applicationsNote.textContent = error.message || "Couldn’t load job applications.";
    applicationsNote.style.color = "#ff8a8a";
  }
}

function applicationContactLinks(contact) {
  const parts = String(contact || "").split("·").map((part) => part.trim()).filter(Boolean);
  return parts.map((part) => {
    const isEmail = part.includes("@");
    const href = isEmail ? `mailto:${encodeURIComponent(part)}` : `tel:${part.replace(/[^+\d]/g, "")}`;
    return `<a href="${href}">${adminEscapeHtml(part)}</a>`;
  }).join("");
}

function renderApplications() {
  if (!applicationsContainer) return;
  const query = (applicationsSearchInput?.value || "").trim().toLowerCase();
  const applications = applicationsCache.filter((request) => request.source === "job-application").filter((request) =>
    !query || [request.name, request.contact, request.message]
      .some((value) => String(value || "").toLowerCase().includes(query))
  );

  applicationsNote.textContent = applications.length ? `${applications.length} application${applications.length === 1 ? "" : "s"}` : "";
  if (!applications.length) {
    applicationsContainer.innerHTML = '<p class="empty-note">No job applications yet.</p>';
    return;
  }

  applicationsContainer.innerHTML = applications.map((request) => `
    <article class="agent-request enquiry-card">
      <div class="agent-request__head">
        <div><strong>${adminEscapeHtml(request.name)}</strong><div class="mono">${adminEscapeHtml(new Date(request.createdAt).toLocaleString())}</div></div>
        <span class="status-badge">${request.status === "contacted" ? "Contacted" : "New"}</span>
      </div>
      <div class="agent-request__contact">${applicationContactLinks(request.contact)}</div>
      <p class="agent-request__message">${adminEscapeHtml(request.message || "No additional details.")}</p>
      <div class="admin-actions">
        ${request.status === "contacted" ? "" : `<button class="btn btn--ghost btn--sm" data-application-key="${adminEscapeHtml(request.key)}">Mark contacted</button>`}
        <button class="btn btn--danger btn--sm" data-delete-application-key="${adminEscapeHtml(request.key)}">Delete application</button>
      </div>
    </article>`).join("");
}

applicationsContainer?.addEventListener("click", async (event) => {
  const deleteButton = event.target.closest("[data-delete-application-key]");
  if (deleteButton) {
    const confirmed = window.confirm("Delete this job application? This cannot be undone.");
    if (!confirmed) return;
    deleteButton.disabled = true;
    try {
      const response = await fetch("/api/agent-requests", {
        method: "DELETE",
        headers: { ...adminAuthHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({ key: deleteButton.dataset.deleteApplicationKey }),
      });
      if (response.status === 401) return adminHandleSessionRejected();
      if (!response.ok) throw new Error("Could not delete application");
      await loadApplications();
    } catch {
      deleteButton.disabled = false;
      applicationsNote.textContent = "Couldn’t delete that application.";
      applicationsNote.style.color = "#ff8a8a";
    }
    return;
  }

  const button = event.target.closest("[data-application-key]");
  if (!button) return;
  button.disabled = true;
  try {
    const response = await fetch("/api/agent-requests", {
      method: "PATCH",
      headers: { ...adminAuthHeader(), "Content-Type": "application/json" },
      body: JSON.stringify({ key: button.dataset.applicationKey }),
    });
    if (response.status === 401) return adminHandleSessionRejected();
    if (!response.ok) throw new Error("Could not update application");
    await loadApplications();
  } catch {
    button.disabled = false;
    applicationsNote.textContent = "Couldn’t update that application.";
    applicationsNote.style.color = "#ff8a8a";
  }
});

refreshApplicationsBtn?.addEventListener("click", loadApplications);
applicationsSearchInput?.addEventListener("input", renderApplications);

if (session) loadApplications();
