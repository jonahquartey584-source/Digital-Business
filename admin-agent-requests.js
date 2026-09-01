// AI Agent Requests: prospects who asked the website assistant to have the
// team reach out. Fetches the same /api/agent-requests list the Website
// Enquiries page uses and shows only the non-enquiry half of it. Session
// handling lives in admin-common.js (loaded before this file).

const session = requireAdminSession();
if (session) {
  const loggedInEmail = document.getElementById("loggedInEmail");
  if (loggedInEmail) loggedInEmail.textContent = session.email;
}

const agentRequestsContainer = document.getElementById("agentRequestsContainer");
const agentRequestsNote = document.getElementById("agentRequestsNote");
const refreshAgentRequestsBtn = document.getElementById("refreshAgentRequestsBtn");
const agentRequestsSearchInput = document.getElementById("agentRequestsSearchInput");
let agentRequestsCache = [];

async function loadAgentRequests() {
  if (!agentRequestsContainer) return;
  agentRequestsNote.textContent = "Loading…";
  try {
    const response = await fetch("/api/agent-requests", { headers: adminAuthHeader() });
    if (response.status === 401) return adminHandleSessionRejected();
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Could not load requests");
    agentRequestsNote.textContent = "";
    agentRequestsCache = result.requests;
    renderAgentRequests();
  } catch (error) {
    agentRequestsNote.textContent = error.message || "Couldn’t load agent requests.";
    agentRequestsNote.style.color = "#ff8a8a";
  }
}

function renderAgentRequests() {
  const query = (agentRequestsSearchInput?.value || "").trim().toLowerCase();
  const requests = agentRequestsCache.filter((request) => request.source !== "website-enquiry").filter((request) => {
    if (!query) return true;
    const transcriptText = Array.isArray(request.transcript)
      ? request.transcript.map((message) => message.content || "").join(" ")
      : "";
    return [request.name, request.contact, request.message, transcriptText]
      .some((value) => String(value || "").toLowerCase().includes(query));
  });

  if (!requests.length) {
    agentRequestsContainer.innerHTML = '<p class="empty-note">No agent requests yet.</p>';
    return;
  }
  agentRequestsContainer.innerHTML = requests.map((request) => `
    <article class="agent-request">
      <div class="agent-request__head">
        <div><strong>${adminEscapeHtml(request.name)}</strong><div class="mono">${adminEscapeHtml(new Date(request.createdAt).toLocaleString())}</div></div>
        <span class="status-badge">${request.status === "contacted" ? "Contacted" : "New"}</span>
      </div>
      <div class="agent-request__contact">
        <a href="mailto:${adminEscapeHtml(request.contact)}">${adminEscapeHtml(request.contact)}</a>
        <a href="tel:${adminEscapeHtml(request.contact)}">Call</a>
      </div>
      <p class="agent-request__message">${adminEscapeHtml(request.message || "No additional message.")}</p>
      <details class="agent-transcript">
        <summary>View assistant conversation (${Array.isArray(request.transcript) ? request.transcript.length : 0} messages)</summary>
        <div class="agent-transcript__messages">
          ${Array.isArray(request.transcript) && request.transcript.length
            ? request.transcript.map((message) => `<div class="agent-transcript__message agent-transcript__message--${message.role}"><strong>${message.role === "user" ? "Prospect" : message.role === "agent" ? "You" : "Assistant"}:</strong> ${adminEscapeHtml(message.content)}</div>`).join("")
            : '<p class="empty-note">No conversation was captured for this request.</p>'}
        </div>
      </details>
      <form class="agent-reply-form" data-agent-reply-key="${adminEscapeHtml(request.key)}">
        <input type="text" maxlength="1000" required placeholder="Reply to this prospect…" aria-label="Reply to ${adminEscapeHtml(request.name)}">
        <button class="btn btn--primary btn--sm" type="submit">Send Reply</button>
      </form>
      <p class="agent-chat-status" data-agent-status="${adminEscapeHtml(request.key)}"></p>
      <div class="admin-actions">
        ${request.status === "contacted" ? "" : `<button class="btn btn--ghost btn--sm" data-request-key="${adminEscapeHtml(request.key)}">Mark contacted</button>`}
        <button class="btn btn--danger btn--sm" data-delete-request-key="${adminEscapeHtml(request.key)}">Delete request</button>
      </div>
    </article>`).join("");
}

agentRequestsContainer?.addEventListener("click", async (event) => {
  const deleteButton = event.target.closest("[data-delete-request-key]");
  if (deleteButton) {
    const confirmed = window.confirm("Delete this AI request and its conversation? This cannot be undone.");
    if (!confirmed) return;
    deleteButton.disabled = true;
    try {
      const response = await fetch("/api/agent-requests", {
        method: "DELETE",
        headers: { ...adminAuthHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({ key: deleteButton.dataset.deleteRequestKey }),
      });
      if (response.status === 401) return adminHandleSessionRejected();
      if (!response.ok) throw new Error("Could not delete request");
      await loadAgentRequests();
    } catch {
      deleteButton.disabled = false;
      agentRequestsNote.textContent = "Couldn’t delete that request.";
      agentRequestsNote.style.color = "#ff8a8a";
    }
    return;
  }

  const button = event.target.closest("[data-request-key]");
  if (!button) return;
  button.disabled = true;
  try {
    const response = await fetch("/api/agent-requests", {
      method: "PATCH",
      headers: { ...adminAuthHeader(), "Content-Type": "application/json" },
      body: JSON.stringify({ key: button.dataset.requestKey }),
    });
    if (response.status === 401) return adminHandleSessionRejected();
    if (!response.ok) throw new Error("Could not update request");
    await loadAgentRequests();
  } catch {
    button.disabled = false;
    agentRequestsNote.textContent = "Couldn’t mark that request as contacted.";
    agentRequestsNote.style.color = "#ff8a8a";
  }
});

agentRequestsContainer?.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-agent-reply-key]");
  if (!form) return;
  event.preventDefault();
  const input = form.querySelector("input");
  const button = form.querySelector("button");
  const status = agentRequestsContainer.querySelector(`[data-agent-status="${CSS.escape(form.dataset.agentReplyKey)}"]`);
  const content = input.value.trim();
  if (!content) return;
  button.disabled = true;
  if (status) status.textContent = "Sending…";
  try {
    const response = await fetch("/api/agent-requests", {
      method: "PATCH",
      headers: { ...adminAuthHeader(), "Content-Type": "application/json" },
      body: JSON.stringify({ key: form.dataset.agentReplyKey, action: "reply", content }),
    });
    if (response.status === 401) return adminHandleSessionRejected();
    if (!response.ok) throw new Error("Could not send reply");
    input.value = "";
    await loadAgentRequests();
  } catch {
    button.disabled = false;
    if (status) status.textContent = "Couldn’t send that reply.";
  }
});

refreshAgentRequestsBtn?.addEventListener("click", loadAgentRequests);
agentRequestsSearchInput?.addEventListener("input", renderAgentRequests);

// Keep live-agent conversations current while this page is open — picks up
// messages sent after the original handoff without needing a manual Refresh.
window.setInterval(() => {
  if (session && adminAuthHeader().Authorization) loadAgentRequests();
}, 5000);

if (session) loadAgentRequests();
