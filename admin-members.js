// Members: search, edit, reissue a 12-digit portal code for, or delete any
// existing client record. Session handling lives in admin-common.js
// (loaded before this file).

const session = requireAdminSession();
if (session) {
  const loggedInEmail = document.getElementById("loggedInEmail");
  if (loggedInEmail) loggedInEmail.textContent = session.email;
}

const clientsListContainer = document.getElementById("clientsListContainer");
const clientsListNote = document.getElementById("clientsListNote");
const clientsSearchInput = document.getElementById("clientsSearchInput");
const editClientPanel = document.getElementById("editClientPanel");
const editClientAccountLabel = document.getElementById("editClientAccount");
const editClientForm = document.getElementById("editClientForm");
const editClientNote = document.getElementById("editClientNote");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const saveEditBtn = document.getElementById("saveEditBtn");
const editEmailClientBtn = document.getElementById("editEmailClientBtn");
const editRegenerateCodeBtn = document.getElementById("editRegenerateCodeBtn");
const editPreviewImageFile = document.getElementById("editPreviewImageFile");
const editPreviewFile = document.getElementById("editPreviewFile");
const editDeliverableFile = document.getElementById("editDeliverableFile");

// The full list from the last successful load, kept around so opening the
// edit panel doesn't need a fresh fetch.
let clientsCache = [];
let editingAccount = null;

// Set by the edit panel's own file uploads (see wireFileUpload calls
// below). null means "no replacement chosen — keep whatever's already
// stored", not "clear it".
let editUploadedPreviewImageUrl = null;
let editUploadedPreviewFileUrl = null;
let editUploadedDeliverableFileUrl = null;

// Mirrors the checkbox options in admin-new-client.html and the alias list
// member-service.js's data-service-aliases gates check against — same
// spelling matters here, since a client's `service` field is just this
// comma-joined string matched by substring on every service page.
const SERVICE_CATALOG = ["Website", "Website Management", "CRM", "Booking System", "Branding & Print", "Social Media & Content", "AI & Automation"];

// Keeps the hidden #editService input (what's actually saved) in sync with
// the checkbox group + "Other" text, same pattern as
// admin-new-client.js's syncAdminServiceField.
function syncEditServiceField() {
  const checked = Array.from(
    document.querySelectorAll('input[name="editServiceOption"]:checked')
  ).map((el) => el.value);
  const other = editClientForm.editServiceOther.value.trim();
  editClientForm.editService.value = [...checked, other].filter(Boolean).join(", ");
}
document.querySelectorAll('input[name="editServiceOption"]').forEach((el) => {
  el.addEventListener("change", syncEditServiceField);
});
editClientForm.editServiceOther.addEventListener("input", syncEditServiceField);

function withClientReference(baseUrl, account) {
  const separator = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${separator}client_reference_id=${encodeURIComponent(account)}`;
}

// admin-new-client.js appends ?client_reference_id=... when a client is
// created; the edit form shows the plain base link instead, and this same
// helper reapplies the parameter on save — so editing never accidentally
// duplicates or drops it.
function stripClientReference(paymentUrl) {
  try {
    const url = new URL(paymentUrl, window.location.href);
    url.searchParams.delete("client_reference_id");
    return url.toString();
  } catch (err) {
    return paymentUrl;
  }
}

function wireFileUpload(fileInput, statusEl, endpoint, onUploaded) {
  if (!fileInput) return;

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;

    onUploaded(null);
    statusEl.textContent = "Uploading…";
    statusEl.style.color = "";

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: adminAuthHeader(),
        body: formData,
      });
      const result = await response.json();

      if (response.ok && result.status === "uploaded") {
        statusEl.textContent = `Uploaded ✓ ${file.name}`;
        statusEl.style.color = "";
        onUploaded(result.url, file);
      } else if (response.status === 401) {
        statusEl.textContent = "";
        fileInput.value = "";
        adminHandleSessionRejected();
      } else {
        statusEl.textContent = result.message || "Upload failed — try again.";
        statusEl.style.color = "#ff8a8a";
      }
    } catch (err) {
      statusEl.textContent = `Couldn't reach ${endpoint} — is the backend deployed?`;
      statusEl.style.color = "#ff8a8a";
    }
  });
}

async function loadClients() {
  if (!clientsListContainer) return;

  clientsListNote.textContent = "Loading…";
  clientsListNote.style.color = "";

  try {
    const response = await fetch("api/list_clients.php", { headers: adminAuthHeader() });

    if (response.status === 401) {
      clientsListNote.textContent = "";
      adminHandleSessionRejected();
      return;
    }

    const result = await response.json();

    if (!response.ok || result.status !== "ok") {
      clientsListNote.textContent = result.message || "Couldn't load clients.";
      clientsListNote.style.color = "#ff8a8a";
      clientsListContainer.innerHTML = "";
      return;
    }

    clientsCache = result.clients;
    clientsListNote.textContent = clientsCache.length ? `${clientsCache.length} member${clientsCache.length === 1 ? "" : "s"}` : "";
    renderClientsList();
  } catch (err) {
    clientsListNote.textContent = "Couldn't reach api/list_clients.php — is the backend deployed?";
    clientsListNote.style.color = "#ff8a8a";
  }
}

// Purely client-side, against the last loaded clientsCache — no need to
// hit the server again just to filter what's already in hand.
function getFilteredClients() {
  const query = (clientsSearchInput?.value || "").trim().toLowerCase();
  if (!query) return clientsCache;
  return clientsCache.filter(
    (client) =>
      (client.account || "").toLowerCase().includes(query) ||
      (client.clientEmail || "").toLowerCase().includes(query) ||
      (client.title || "").toLowerCase().includes(query) ||
      (client.service || "").toLowerCase().includes(query)
  );
}

function renderClientsList() {
  if (!clientsCache.length) {
    clientsListContainer.innerHTML = `<p class="empty-note">No clients yet — head to <a href="admin-new-client.html">New Client Setup</a> to create one.</p>`;
    return;
  }

  const filtered = getFilteredClients();

  if (!filtered.length) {
    clientsListContainer.innerHTML = `<p class="empty-note">No clients match that search.</p>`;
    return;
  }

  clientsListContainer.innerHTML = filtered
    .map((client) => {
      const account = adminEscapeHtml(client.account);
      const portalCode = String(client.portalCode || "").replace(/\D/g, "");
      const portalCodeIssued = Boolean(portalCode || client.portalCodeIssuedAt);
      const formattedPortalCode = portalCode.replace(/(\d{4})(?=\d)/g, "$1 ");
      const portalCodeDate = client.portalCodeIssuedAt
        ? new Date(client.portalCodeIssuedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
        : "";
      return `
      <div class="client-row">
        <div class="client-row__info">
          <div class="client-row__account mono">${account}</div>
          <div class="client-row__service">${adminEscapeHtml(client.title || client.service)} — ${adminEscapeHtml(client.price)}</div>
          <div class="client-row__code mono">Setup code: ${adminEscapeHtml(client.code)}</div>
          ${
            client.status === "active" && client.clientEmail
              ? `<div class="client-row__email mono">${adminEscapeHtml(client.clientEmail)}</div>`
              : ""
          }
          ${
            client.status === "refunded"
              ? `<div class="client-row__email mono" style="color:#e07a6b">Refunded ${adminEscapeHtml(client.refundAmount || "")}${client.refundedAt ? ` on ${adminEscapeHtml(new Date(client.refundedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }))}` : ""}${client.refundReason ? ` — ${adminEscapeHtml(client.refundReason)}` : ""}</div>`
              : ""
          }
          <div class="client-row__portal-code mono" data-portal-code-row="${account}">
            ${
              portalCode
                ? `12-digit login code: <strong>${adminEscapeHtml(formattedPortalCode)}</strong>${portalCodeDate ? ` · issued ${adminEscapeHtml(portalCodeDate)}` : ""} `
                : portalCodeIssued
                  ? `12-digit login code: protected legacy code — generate a replacement to view it `
                  : `12-digit login code: not issued yet `
            }<button type="button" class="btn btn--ghost btn--sm" data-generate-code="${account}">${portalCodeIssued ? "Reissue" : "Generate"} Code</button>
          </div>
        </div>
        <span class="status-pill status-pill--${client.status === "active" ? "active" : client.status === "refunded" ? "refunded" : "pending"}">${client.status === "active" ? "Active" : client.status === "refunded" ? "Refunded" : "Pending Payment"}</span>
        <div class="client-row__actions">
          <button type="button" class="btn btn--ghost btn--sm" data-edit-account="${account}">Edit</button>
          ${
            client.status !== "refunded"
              ? `<button type="button" class="btn btn--ghost btn--sm" data-refund-account="${account}">Refund</button>`
              : ""
          }
          <button type="button" class="btn btn--danger btn--sm" data-delete-account="${account}">Delete</button>
        </div>
      </div>
    `;
    })
    .join("");

  clientsListContainer.querySelectorAll("[data-edit-account]").forEach((button) => {
    button.addEventListener("click", () => openEditPanel(button.getAttribute("data-edit-account")));
  });
  clientsListContainer.querySelectorAll("[data-delete-account]").forEach((button) => {
    button.addEventListener("click", () => deleteClient(button.getAttribute("data-delete-account")));
  });
  clientsListContainer.querySelectorAll("[data-refund-account]").forEach((button) => {
    button.addEventListener("click", () => refundClient(button.getAttribute("data-refund-account")));
  });
  clientsListContainer.querySelectorAll("[data-generate-code]").forEach((button) => {
    button.addEventListener("click", () => generatePortalCode(button.getAttribute("data-generate-code")));
  });
}

// Shows the newly generated 12-digit code in the list. Current records store
// an encrypted copy as well as the login hash, allowing an authenticated
// administrator to view the code again from this page.
async function generatePortalCode(account) {
  const row = clientsListContainer.querySelector(`[data-portal-code-row="${CSS.escape(account)}"]`);
  if (!row) return;
  if (!window.confirm(`Generate a new 12-digit login code for ${account}? Any existing code stops working immediately.`)) return;

  const originalHtml = row.innerHTML;
  row.innerHTML = "Generating a secure code…";

  try {
    const response = await fetch("/api/manage-member-access", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...adminAuthHeader() },
      body: JSON.stringify({ action: "regenerate_code", account }),
    });

    if (response.status === 401) return adminHandleSessionRejected();

    const result = await response.json();

    if (response.ok && result.status === "ok") {
      const formatted = String(result.code).replace(/(\d{4})(?=\d)/g, "$1 ");
      row.innerHTML = `<strong style="color:var(--gold)">12-digit login code: ${adminEscapeHtml(formatted)}</strong> <button type="button" class="btn btn--ghost btn--sm" data-copy-code>Copy</button> <button type="button" class="btn btn--ghost btn--sm" data-generate-code="${adminEscapeHtml(account)}">Reissue Code</button>`;
      row.querySelector("[data-copy-code]")?.addEventListener("click", async (event) => {
        try {
          await navigator.clipboard.writeText(result.code);
          event.currentTarget.textContent = "Copied!";
        } catch {
          // Clipboard API unavailable — the code is already visible to select/copy by hand.
        }
      });
      row.querySelector("[data-generate-code]")?.addEventListener("click", () => generatePortalCode(account));
      const cached = clientsCache.find((c) => c.account === account);
      if (cached) {
        cached.portalCode = String(result.code).replace(/\D/g, "");
        cached.portalCodeIssuedAt = new Date().toISOString();
        cached.status = "active";
      }
      const statusPill = row.closest(".client-row")?.querySelector(".status-pill");
      if (statusPill) {
        statusPill.textContent = "Active";
        statusPill.classList.add("status-pill--active");
        statusPill.classList.remove("status-pill--pending");
      }
    } else {
      row.innerHTML = originalHtml;
      row.querySelector("[data-generate-code]")?.addEventListener("click", () => generatePortalCode(account));
      clientsListNote.textContent = result.message || "Couldn't generate a code — try again.";
      clientsListNote.style.color = "#ff8a8a";
    }
  } catch (err) {
    row.innerHTML = originalHtml;
    row.querySelector("[data-generate-code]")?.addEventListener("click", () => generatePortalCode(account));
    clientsListNote.textContent = "Couldn't reach /api/manage-member-access — is the backend deployed?";
    clientsListNote.style.color = "#ff8a8a";
  }
}

if (clientsSearchInput) {
  clientsSearchInput.addEventListener("input", () => {
    if (clientsCache.length) renderClientsList();
  });
}

// Refunds through Stripe and switches the client's access off. Permanent —
// confirm (twice: the browser confirm, then an optional reason) before
// calling the endpoint. Matches terms.html: this is an admin decision, not
// something a client triggers themselves.
async function refundClient(account) {
  if (!window.confirm(`Refund ${account} through Stripe? This immediately switches off their access to this service. This can't be undone from here.`)) {
    return;
  }
  const reason = window.prompt("Reason for the refund (optional, for your own records):", "") || "";
  const amountInput = window.prompt("Refund amount in £ — leave blank for a full refund:", "");
  if (amountInput === null) return; // cancelled
  const amount = amountInput.trim() ? amountInput.trim() : undefined;

  clientsListNote.textContent = "Processing refund with Stripe…";
  clientsListNote.style.color = "";

  try {
    const response = await fetch("/api/refund-client", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...adminAuthHeader() },
      body: JSON.stringify({ account, reason, amount }),
    });

    if (response.status === 401) {
      clientsListNote.textContent = "";
      adminHandleSessionRejected();
      return;
    }

    const result = await response.json();

    if (response.ok && result.status === "ok") {
      clientsListNote.textContent = `Refunded ${result.refundAmount || ""} for ${account}.`;
      await loadClients();
    } else {
      clientsListNote.textContent = result.message || "Couldn't process that refund — try again.";
      clientsListNote.style.color = "#ff8a8a";
    }
  } catch (err) {
    clientsListNote.textContent = "Couldn't reach /api/refund-client — is the backend deployed?";
    clientsListNote.style.color = "#ff8a8a";
  }
}

// Permanent and irreversible — confirm before ever calling the endpoint.
async function deleteClient(account) {
  if (!window.confirm(`Permanently delete ${account}? This can't be undone.`)) {
    return;
  }

  clientsListNote.textContent = "Deleting…";
  clientsListNote.style.color = "";

  try {
    const response = await fetch("api/delete_client.php", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...adminAuthHeader() },
      body: JSON.stringify({ account }),
    });

    if (response.status === 401) {
      clientsListNote.textContent = "";
      adminHandleSessionRejected();
      return;
    }

    const result = await response.json();

    if (response.ok && result.status === "deleted") {
      clientsListNote.textContent = "";
      if (editingAccount === account) {
        editClientPanel.hidden = true;
        editingAccount = null;
      }
      await loadClients();
    } else {
      clientsListNote.textContent = result.message || "Couldn't delete — try again.";
      clientsListNote.style.color = "#ff8a8a";
    }
  } catch (err) {
    clientsListNote.textContent = "Couldn't reach api/delete_client.php — is the backend deployed?";
    clientsListNote.style.color = "#ff8a8a";
  }
}

function openEditPanel(account) {
  const client = clientsCache.find((c) => c.account === account);
  if (!client || !editClientForm) return;

  editingAccount = account;
  editUploadedPreviewImageUrl = null;
  editUploadedPreviewFileUrl = null;
  editUploadedDeliverableFileUrl = null;

  editClientAccountLabel.textContent = account;
  editClientForm.editTitle.value = client.title || "";

  // Pre-check every catalog service this account's `service` string already
  // mentions; whatever's left over (a plan name, "Other" detail, anything
  // that isn't one of the standard checkboxes) goes into the free-text field.
  const accessText = String(client.service || "").toLowerCase();
  let remaining = client.service || "";
  document.querySelectorAll('input[name="editServiceOption"]').forEach((el) => {
    const matched = accessText.includes(el.value.toLowerCase());
    el.checked = matched;
    if (matched) remaining = remaining.replace(new RegExp(el.value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "");
  });
  editClientForm.editServiceOther.value = remaining.replace(/,\s*,/g, ",").replace(/^[,\s]+|[,\s]+$/g, "").trim();
  syncEditServiceField();

  editClientForm.editPrice.value = client.price || "";
  editClientForm.editPreview.value = client.preview || "";
  editClientForm.editPaymentUrl.value = stripClientReference(client.paymentUrl || "");
  editClientForm.editLiveUrl.value = client.liveUrl || "";
  editClientForm.editClientEmail.value = client.clientEmail || "";
  editClientForm.editStatus.value = client.status || "pending_payment";

  document.getElementById("editPreviewImageCurrent").textContent = client.previewImageUrl ? `Current: ${client.previewImageUrl}` : "None set.";
  document.getElementById("editPreviewFileCurrent").textContent = client.previewFileUrl ? `Current: ${client.previewFileUrl}` : "None set.";
  document.getElementById("editDeliverableFileCurrent").textContent = client.deliverableFileUrl ? `Current: ${client.deliverableFileUrl}` : "None set.";
  document.getElementById("editPreviewImageStatus").textContent = "";
  document.getElementById("editPreviewFileStatus").textContent = "";
  document.getElementById("editDeliverableFileStatus").textContent = "";
  editPreviewImageFile.value = "";
  editPreviewFile.value = "";
  editDeliverableFile.value = "";

  if (editEmailClientBtn) editEmailClientBtn.hidden = !client.clientEmail;
  if (editRegenerateCodeBtn) editRegenerateCodeBtn.hidden = !client.clientEmail;
  editClientNote.textContent = "";
  editClientPanel.hidden = false;
  editClientPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

wireFileUpload(editPreviewImageFile, document.getElementById("editPreviewImageStatus"), "api/upload_preview_image.php", (url) => {
  editUploadedPreviewImageUrl = url;
});
wireFileUpload(editPreviewFile, document.getElementById("editPreviewFileStatus"), "api/upload_preview_file.php", (url) => {
  editUploadedPreviewFileUrl = url;
});
wireFileUpload(editDeliverableFile, document.getElementById("editDeliverableFileStatus"), "api/upload_preview_file.php", (url) => {
  editUploadedDeliverableFileUrl = url;
});

if (cancelEditBtn) {
  cancelEditBtn.addEventListener("click", () => {
    editClientPanel.hidden = true;
    editingAccount = null;
  });
}

if (editClientForm) {
  editClientForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!editingAccount) return;

    const client = clientsCache.find((c) => c.account === editingAccount);
    if (!client) return;

    const basePaymentUrl = editClientForm.editPaymentUrl.value.trim();
    if (!editClientForm.editService.value.trim() || !editClientForm.editPrice.value.trim() || !basePaymentUrl) {
      editClientNote.textContent = "Check at least one service (or fill in \"Other\"), and fill in Price and Payment link.";
      editClientNote.style.color = "#ff8a8a";
      return;
    }

    saveEditBtn.disabled = true;
    editClientNote.textContent = "Saving…";
    editClientNote.style.color = "";

    const payload = {
      account: editingAccount,
      code: client.code,
      title: editClientForm.editTitle.value.trim(),
      service: editClientForm.editService.value.trim(),
      price: editClientForm.editPrice.value.trim(),
      preview: editClientForm.editPreview.value.trim(),
      previewImageUrl: editUploadedPreviewImageUrl ?? client.previewImageUrl ?? "",
      previewFileUrl: editUploadedPreviewFileUrl ?? client.previewFileUrl ?? "",
      deliverableFileUrl: editUploadedDeliverableFileUrl ?? client.deliverableFileUrl ?? "",
      paymentUrl: withClientReference(basePaymentUrl, editingAccount),
      liveUrl: editClientForm.editLiveUrl.value.trim(),
      clientEmail: editClientForm.editClientEmail.value.trim(),
      status: editClientForm.editStatus.value,
    };

    try {
      const response = await fetch("api/update_client.php", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...adminAuthHeader() },
        body: JSON.stringify(payload),
      });

      if (response.status === 401) {
        editClientNote.textContent = "";
        adminHandleSessionRejected();
        return;
      }

      const result = await response.json();

      if (response.ok && result.status === "updated") {
        editClientNote.textContent = "Saved.";
        editClientNote.style.color = "";
        editClientPanel.hidden = true;
        editingAccount = null;
        await loadClients();
      } else {
        editClientNote.textContent = result.message || "Couldn't save — try again.";
        editClientNote.style.color = "#ff8a8a";
      }
    } catch (err) {
      editClientNote.textContent = "Couldn't reach api/update_client.php — is the backend deployed?";
      editClientNote.style.color = "#ff8a8a";
    } finally {
      saveEditBtn.disabled = false;
    }
  });
}

// Shared by "Email Account & Code to Client" — posts to
// api/send_client_email.php, which looks the client up server-side and
// emails them their account number + setup code + the redeem link.
async function sendClientEmail(account, button, noteEl) {
  button.disabled = true;
  noteEl.textContent = "Sending…";
  noteEl.style.color = "";

  try {
    const response = await fetch("api/send_client_email.php", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...adminAuthHeader() },
      body: JSON.stringify({ account }),
    });

    if (response.status === 401) {
      noteEl.textContent = "";
      adminHandleSessionRejected();
      return;
    }

    const result = await response.json();

    if (response.ok && result.status === "ok") {
      noteEl.textContent = "Email sent.";
      noteEl.style.color = "";
    } else {
      noteEl.textContent = result.message || "Couldn't send — try again.";
      noteEl.style.color = "#ff8a8a";
    }
  } catch (err) {
    noteEl.textContent = "Couldn't reach api/send_client_email.php — is the backend deployed?";
    noteEl.style.color = "#ff8a8a";
  } finally {
    button.disabled = false;
  }
}

if (editEmailClientBtn) {
  editEmailClientBtn.addEventListener("click", () => {
    if (!editingAccount) return;
    sendClientEmail(editingAccount, editEmailClientBtn, editClientNote);
  });
}

// Reissues the client's 12-digit Members Portal login code (separate from
// the setup account/code pair above — this is what member-access.mts
// checks when they sign into members.html). Only shown once here, exactly
// like a real payment does — copy it down or use "Email Account & Code" /
// send it yourself, it can't be retrieved again after this.
if (editRegenerateCodeBtn) {
  editRegenerateCodeBtn.addEventListener("click", async () => {
    if (!editingAccount) return;
    if (!window.confirm("Generate a new 12-digit portal code for this client? Their old code will stop working immediately.")) return;

    editRegenerateCodeBtn.disabled = true;
    editClientNote.textContent = "Generating a secure code…";
    editClientNote.style.color = "";

    try {
      const response = await fetch("/api/manage-member-access", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...adminAuthHeader() },
        body: JSON.stringify({ action: "regenerate_code", account: editingAccount }),
      });

      if (response.status === 401) {
        editClientNote.textContent = "";
        adminHandleSessionRejected();
        return;
      }

      const result = await response.json();

      if (response.ok && result.status === "ok") {
        const formatted = String(result.code).replace(/(\d{4})(?=\d)/g, "$1 ");
        editClientNote.textContent = `New portal code (copy it now — it won't be shown again): ${formatted}`;
        editClientNote.style.color = "";
        await loadClients();
      } else {
        editClientNote.textContent = result.message || "Couldn't generate a code — try again.";
        editClientNote.style.color = "#ff8a8a";
      }
    } catch (err) {
      editClientNote.textContent = "Couldn't reach /api/manage-member-access — is the backend deployed?";
      editClientNote.style.color = "#ff8a8a";
    } finally {
      editRegenerateCodeBtn.disabled = false;
    }
  });
}

if (session) loadClients();
