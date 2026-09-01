// Website Enquiries: every enquiry submitted through the website's contact
// form. Fetches the same /api/agent-requests list the AI Agent Requests
// page uses and shows only the enquiry half of it. Session handling lives
// in admin-common.js (loaded before this file).

const session = requireAdminSession();
if (session) {
  const loggedInEmail = document.getElementById("loggedInEmail");
  if (loggedInEmail) loggedInEmail.textContent = session.email;
}

const enquiriesContainer = document.getElementById("enquiriesContainer");
const enquiriesNote = document.getElementById("enquiriesNote");
const refreshEnquiriesBtn = document.getElementById("refreshEnquiriesBtn");
const enquiriesSearchInput = document.getElementById("enquiriesSearchInput");
let enquiriesCache = [];

async function loadEnquiries() {
  if (!enquiriesContainer) return;
  enquiriesNote.textContent = "Loading…";
  try {
    const response = await fetch("/api/agent-requests", { headers: adminAuthHeader() });
    if (response.status === 401) return adminHandleSessionRejected();
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Could not load enquiries");
    enquiriesCache = result.requests;
    renderEnquiries();
  } catch (error) {
    enquiriesNote.textContent = error.message || "Couldn’t load website enquiries.";
    enquiriesNote.style.color = "#ff8a8a";
  }
}

function enquiryContactLinks(contact) {
  const parts = String(contact || "").split("·").map((part) => part.trim()).filter(Boolean);
  return parts.map((part) => {
    const isEmail = part.includes("@");
    const href = isEmail ? `mailto:${encodeURIComponent(part)}` : `tel:${part.replace(/[^+\d]/g, "")}`;
    return `<a href="${href}">${adminEscapeHtml(part)}</a>`;
  }).join("");
}

function renderEnquiries() {
  if (!enquiriesContainer) return;
  const query = (enquiriesSearchInput?.value || "").trim().toLowerCase();
  const enquiries = enquiriesCache.filter((request) => request.source === "website-enquiry").filter((request) =>
    !query || [request.name, request.contact, request.message]
      .some((value) => String(value || "").toLowerCase().includes(query))
  );

  enquiriesNote.textContent = enquiries.length ? `${enquiries.length} enquir${enquiries.length === 1 ? "y" : "ies"}` : "";
  if (!enquiries.length) {
    enquiriesContainer.innerHTML = '<p class="empty-note">No website enquiries yet.</p>';
    return;
  }

  enquiriesContainer.innerHTML = enquiries.map((request) => `
    <article class="agent-request enquiry-card">
      <div class="agent-request__head">
        <div><strong>${adminEscapeHtml(request.name)}</strong><div class="mono">${adminEscapeHtml(new Date(request.createdAt).toLocaleString())}</div></div>
        <span class="status-badge">${request.status === "contacted" ? "Contacted" : "New"}</span>
      </div>
      <div class="agent-request__contact">${enquiryContactLinks(request.contact)}</div>
      <p class="agent-request__message">${adminEscapeHtml(request.message || "No additional details.")}</p>
      <div class="admin-actions">
        ${request.status === "contacted" ? "" : `<button class="btn btn--ghost btn--sm" data-enquiry-key="${adminEscapeHtml(request.key)}">Mark contacted</button>`}
        <button class="btn btn--danger btn--sm" data-delete-enquiry-key="${adminEscapeHtml(request.key)}">Delete enquiry</button>
      </div>
    </article>`).join("");
}

enquiriesContainer?.addEventListener("click", async (event) => {
  const deleteButton = event.target.closest("[data-delete-enquiry-key]");
  if (deleteButton) {
    const confirmed = window.confirm("Delete this website enquiry? This cannot be undone.");
    if (!confirmed) return;
    deleteButton.disabled = true;
    try {
      const response = await fetch("/api/agent-requests", {
        method: "DELETE",
        headers: { ...adminAuthHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({ key: deleteButton.dataset.deleteEnquiryKey }),
      });
      if (response.status === 401) return adminHandleSessionRejected();
      if (!response.ok) throw new Error("Could not delete enquiry");
      await loadEnquiries();
    } catch {
      deleteButton.disabled = false;
      enquiriesNote.textContent = "Couldn’t delete that enquiry.";
      enquiriesNote.style.color = "#ff8a8a";
    }
    return;
  }

  const button = event.target.closest("[data-enquiry-key]");
  if (!button) return;
  button.disabled = true;
  try {
    const response = await fetch("/api/agent-requests", {
      method: "PATCH",
      headers: { ...adminAuthHeader(), "Content-Type": "application/json" },
      body: JSON.stringify({ key: button.dataset.enquiryKey }),
    });
    if (response.status === 401) return adminHandleSessionRejected();
    if (!response.ok) throw new Error("Could not update enquiry");
    await loadEnquiries();
  } catch {
    button.disabled = false;
    enquiriesNote.textContent = "Couldn’t update that enquiry.";
    enquiriesNote.style.color = "#ff8a8a";
  }
});

refreshEnquiriesBtn?.addEventListener("click", loadEnquiries);
enquiriesSearchInput?.addEventListener("input", renderEnquiries);

if (session) loadEnquiries();
