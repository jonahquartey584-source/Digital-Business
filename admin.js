// Internal tool: generates a random account number + activation code for a
// new client, builds their payment link (with ?client_reference_id=...
// appended so the Stripe webhook can identify them), and either saves the
// client straight to the live database (api/create_client.php) or gives
// you a snippet to paste into accounts-data.js as a fallback.
//
// Gated behind a login (email + password + a personal security-question
// answer, checked by api/admin_login.php) rather than a single shared
// password entered per action — see wireLogin() below.

const BUSINESS_NAME = "Qp Digital";
const REDEEM_URL = "https://qp-digital.netlify.app/activate.html"; // update if you move to a different domain

// Shown as the label on the login form. Only the *answer* is a secret
// (checked server-side, in api/config.php / the ADMIN_SECURITY_ANSWER
// environment variable) — the question text itself just lives here.
// Change it to something only you'd know the answer to.
const SECURITY_QUESTION = "What is your wife's nickname?";

// Avoid ambiguous characters (0/O, 1/I/L) so codes are easy to read back
// over phone/email without mixing them up.
const CODE_CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function randomFromCharset(charset, length) {
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  return Array.from(values, (v) => charset[v % charset.length]).join("");
}

function generateAccountNumber() {
  const year = new Date().getFullYear();
  return `QP-${year}-${randomFromCharset("0123456789", 4)}`;
}

function generateActivationCode() {
  return `${randomFromCharset(CODE_CHARSET, 4)}-${randomFromCharset(CODE_CHARSET, 4)}`;
}

function withClientReference(baseUrl, account) {
  const separator = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${separator}client_reference_id=${encodeURIComponent(account)}`;
}

function escapeJsString(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function buildSnippetHtml(data) {
  const line = (key, value, comma = true) =>
    `<p class="code-line code-line--indent"><span class="code-key">"${key}"</span><span class="code-punct">: </span><span class="code-string">"${escapeJsString(value || "")}"</span><span class="code-punct">${comma ? "," : ""}</span></p>`;
  const nullableLine = (key, value, comma = true) =>
    value
      ? line(key, value, comma)
      : `<p class="code-line code-line--indent"><span class="code-key">"${key}"</span><span class="code-punct">: </span><span class="code-key">null</span><span class="code-punct">${comma ? "," : ""}</span></p>`;

  return [
    `<p class="code-line">{</p>`,
    nullableLine("title", data.title),
    line("account", data.account),
    line("code", data.code),
    line("service", data.service),
    line("price", data.price),
    line("preview", data.preview),
    nullableLine("previewImageUrl", data.previewImageUrl),
    nullableLine("previewFileUrl", data.previewFileUrl),
    nullableLine("deliverableFileUrl", data.deliverableFileUrl),
    line("paymentUrl", data.paymentUrl),
    nullableLine("liveUrl", data.liveUrl, false),
    `<p class="code-line">},<span class="cursor" aria-hidden="true"></span></p>`,
  ].join("");
}

function buildSnippetText(data) {
  return [
    "{",
    `  title: ${data.title ? `"${escapeJsString(data.title)}"` : "null"},`,
    `  account: "${escapeJsString(data.account)}",`,
    `  code: "${escapeJsString(data.code)}",`,
    `  service: "${escapeJsString(data.service)}",`,
    `  price: "${escapeJsString(data.price)}",`,
    `  preview: "${escapeJsString(data.preview || "")}",`,
    `  previewImageUrl: ${data.previewImageUrl ? `"${escapeJsString(data.previewImageUrl)}"` : "null"},`,
    `  previewFileUrl: ${data.previewFileUrl ? `"${escapeJsString(data.previewFileUrl)}"` : "null"},`,
    `  deliverableFileUrl: ${data.deliverableFileUrl ? `"${escapeJsString(data.deliverableFileUrl)}"` : "null"},`,
    `  paymentUrl: "${escapeJsString(data.paymentUrl)}",`,
    `  liveUrl: ${data.liveUrl ? `"${escapeJsString(data.liveUrl)}"` : "null"},`,
    "},",
  ].join("\n");
}

function buildMessageText({ account, code, service, price }) {
  return [
    `Hi! Your ${service} with ${BUSINESS_NAME} is ready.`,
    "",
    `Go to ${REDEEM_URL} and enter:`,
    `Account Number: ${account}`,
    `Activation Code: ${code}`,
    "",
    `Price: ${price}`,
    "",
    "Once you pay, it activates automatically.",
  ].join("\n");
}

// --- Login / session ------------------------------------------------------
//
// Plain login: sessionStorage, so it doesn't outlive the browser tab (the
// token also expires server-side after 12 hours regardless). "Remember me"
// checked: localStorage instead, paired with a 30-day token from
// api/admin_login.php, so it survives closing the browser entirely.

const SESSION_STORAGE_KEY = "qpAdminSession";

const loginSection = document.getElementById("loginSection");
const adminToolSection = document.getElementById("adminToolSection");
const loginForm = document.getElementById("loginForm");
const loginBtn = document.getElementById("loginBtn");
const loginNote = document.getElementById("loginNote");
const loginSecurityQuestionLabel = document.getElementById("loginSecurityQuestionLabel");
const loggedInEmail = document.getElementById("loggedInEmail");
const logoutBtn = document.getElementById("logoutBtn");

if (loginSecurityQuestionLabel) {
  loginSecurityQuestionLabel.textContent = SECURITY_QUESTION;
}

function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY) || sessionStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

function saveSession(token, email, remember) {
  const value = JSON.stringify({ token, email });
  try {
    // Only one copy at a time — otherwise logging out of a "remembered"
    // session but leaving a stale sessionStorage copy (or vice versa) could
    // resurrect it on the next page load.
    if (remember) {
      localStorage.setItem(SESSION_STORAGE_KEY, value);
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } else {
      sessionStorage.setItem(SESSION_STORAGE_KEY, value);
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  } catch (err) {
    // Storage blocked (e.g. private browsing) — the session just won't
    // persist across a reload; the tool still works for the current page.
  }
}

function clearSession() {
  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch (err) {
    // Storage blocked — nothing to clear.
  }
}

// Decodes the token's own `exp` claim so the UI can proactively show the
// login screen again — this is just for a smooth UI, not what actually
// enforces expiry (the backend re-verifies the signature and exp on every
// request regardless).
function isTokenExpired(token) {
  try {
    const [payload] = token.split(".");
    const { exp } = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof exp !== "number" || exp * 1000 <= Date.now();
  } catch (err) {
    return true;
  }
}

function showLoginScreen(message) {
  if (loginSection) loginSection.hidden = false;
  if (adminToolSection) adminToolSection.hidden = true;
  if (loginNote) {
    loginNote.textContent = message || "";
    loginNote.style.color = message ? "#ff8a8a" : "";
  }
  if (loginForm) loginForm.reset();
}

function showAdminTool(email) {
  if (loginSection) loginSection.hidden = true;
  if (adminToolSection) adminToolSection.hidden = false;
  if (loggedInEmail) loggedInEmail.textContent = email;
  // Deferred: this can run during the top-of-file restoreSession() call,
  // before the "Existing clients" section further down has declared its
  // own consts (loadClients itself is hoisted, but the elements it reads
  // aren't initialized yet at that point) — a macrotask guarantees the
  // rest of the script has finished running first.
  setTimeout(loadClients, 0);
}

// Called by every authenticated fetch below when the server says the
// session is invalid/expired, so the UI falls back to the login screen
// instead of silently failing.
function handleSessionRejected() {
  clearSession();
  showLoginScreen("Your session expired — log in again.");
}

function currentAuthHeader() {
  const session = getSession();
  return session ? { Authorization: `Bearer ${session.token}` } : {};
}

(function restoreSession() {
  const session = getSession();
  if (session && !isTokenExpired(session.token)) {
    showAdminTool(session.email);
  } else {
    clearSession();
    showLoginScreen();
  }
})();

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = loginForm.loginEmail.value.trim();
    const password = loginForm.loginPassword.value;
    const securityAnswer = loginForm.loginSecurityAnswer.value;
    const remember = loginForm.loginRemember.checked;

    loginBtn.disabled = true;
    loginNote.textContent = "Logging in…";
    loginNote.style.color = "";

    try {
      const response = await fetch("api/admin_login.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, securityAnswer, remember }),
      });
      const result = await response.json();

      if (response.ok && result.status === "ok") {
        saveSession(result.token, email, remember);
        showAdminTool(email);
      } else {
        loginNote.textContent = result.message || "Wrong email, password, or answer.";
        loginNote.style.color = "#ff8a8a";
      }
    } catch (err) {
      loginNote.textContent = "Couldn't reach api/admin_login.php — is the backend deployed?";
      loginNote.style.color = "#ff8a8a";
    } finally {
      loginBtn.disabled = false;
    }
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    clearSession();
    showLoginScreen();
  });
}

// --- New client setup tool -------------------------------------------------

const adminForm = document.getElementById("adminForm");
const adminOutput = document.getElementById("adminOutput");
const snippetOutput = document.getElementById("snippetOutput");
const messageOutput = document.getElementById("messageOutput");
const regenerateBtn = document.getElementById("regenerateBtn");
const saveBtn = document.getElementById("saveBtn");
const saveNote = document.getElementById("saveNote");
const previewImageFile = document.getElementById("adminPreviewImageFile");
const previewImageStatus = document.getElementById("previewImageStatus");
const previewImageThumb = document.getElementById("previewImageThumb");
const previewFile = document.getElementById("adminPreviewFile");
const previewFileStatus = document.getElementById("previewFileStatus");
const deliverableFile = document.getElementById("adminDeliverableFile");
const deliverableFileStatus = document.getElementById("deliverableFileStatus");
const emailClientBtn = document.getElementById("emailClientBtn");
const emailClientNote = document.getElementById("emailClientNote");

let currentData = null;

// Set once their respective file input finishes uploading (see
// wireFileUpload below). render() reads these instead of typed URLs — the
// client just attaches files, nothing to paste.
let uploadedPreviewImageUrl = null;
let uploadedPreviewFileUrl = null;
let uploadedDeliverableFileUrl = null;

// Shared upload flow for both file inputs: sends the logged-in session
// token, POSTs the file to `endpoint`, and calls `onUploaded(url, file)`
// once it's saved server-side. `statusEl` shows progress/errors inline.
function wireFileUpload(fileInput, statusEl, endpoint, onUploaded) {
  if (!fileInput) return;

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;

    onUploaded(null); // clear any previous upload while this one's in flight
    statusEl.textContent = "Uploading…";
    statusEl.style.color = "";

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: currentAuthHeader(),
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
        handleSessionRejected();
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

wireFileUpload(previewImageFile, previewImageStatus, "api/upload_preview_image.php", (url) => {
  uploadedPreviewImageUrl = url;
  previewImageThumb.hidden = !url;
  if (url) previewImageThumb.src = url;
});

wireFileUpload(previewFile, previewFileStatus, "api/upload_preview_file.php", (url) => {
  uploadedPreviewFileUrl = url;
});

// Same upload endpoint as the preview file above (it already accepts any
// file type and just returns { status, url }) — this is a second, separate
// file, kept in its own field (deliverableFileUrl) so it can be withheld
// from the client until they've actually paid. See api/redeem.php /
// redeem.mts, which only ever return it once status is "active".
wireFileUpload(deliverableFile, deliverableFileStatus, "api/upload_preview_file.php", (url) => {
  uploadedDeliverableFileUrl = url;
});

function render() {
  const title = adminForm.adminTitle.value.trim();
  const service = adminForm.adminService.value.trim();
  const price = adminForm.adminPrice.value.trim();
  const preview = adminForm.adminPreview.value.trim();
  const basePaymentUrl = adminForm.adminPaymentUrl.value.trim();
  const liveUrl = adminForm.adminLiveUrl.value.trim();
  const clientEmail = adminForm.adminClientEmail.value.trim();

  // Belt-and-braces: the inputs are also marked `required`, but don't rely
  // on that alone (e.g. a re-triggered submit via regenerateBtn skips
  // native browser validation entirely) — always give visible feedback
  // rather than silently doing nothing.
  if (!service || !price || !basePaymentUrl) {
    saveNote.textContent = "Fill in Service, Price and Payment link first.";
    saveNote.style.color = "#ff8a8a";
    return;
  }
  if (previewImageFile && previewImageFile.files[0] && !uploadedPreviewImageUrl) {
    saveNote.textContent = "Still uploading the preview image — wait for \"Uploaded ✓\" first.";
    saveNote.style.color = "#ff8a8a";
    return;
  }
  if (previewFile && previewFile.files[0] && !uploadedPreviewFileUrl) {
    saveNote.textContent = "Still uploading the preview file — wait for \"Uploaded ✓\" first.";
    saveNote.style.color = "#ff8a8a";
    return;
  }
  if (deliverableFile && deliverableFile.files[0] && !uploadedDeliverableFileUrl) {
    saveNote.textContent = "Still uploading the deliverable file — wait for \"Uploaded ✓\" first.";
    saveNote.style.color = "#ff8a8a";
    return;
  }
  saveNote.style.color = "";

  const account = generateAccountNumber();
  const code = generateActivationCode();
  const paymentUrl = withClientReference(basePaymentUrl, account);

  currentData = {
    account,
    code,
    title,
    service,
    price,
    preview,
    previewImageUrl: uploadedPreviewImageUrl,
    previewFileUrl: uploadedPreviewFileUrl,
    deliverableFileUrl: uploadedDeliverableFileUrl,
    paymentUrl,
    liveUrl,
    clientEmail,
  };

  snippetOutput.innerHTML = buildSnippetHtml(currentData);
  messageOutput.value = buildMessageText(currentData);
  saveNote.textContent = "";
  if (emailClientBtn) emailClientBtn.hidden = true;
  if (emailClientNote) emailClientNote.textContent = "";

  adminOutput.hidden = false;
  adminOutput.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

if (adminForm) {
  adminForm.addEventListener("submit", (event) => {
    event.preventDefault();
    render();
  });
}

if (regenerateBtn) {
  regenerateBtn.addEventListener("click", render);
}

if (saveBtn) {
  saveBtn.addEventListener("click", async () => {
    if (!currentData) return;

    saveBtn.disabled = true;
    saveNote.textContent = "Saving…";
    saveNote.style.color = "";

    try {
      const response = await fetch("api/create_client.php", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...currentAuthHeader() },
        body: JSON.stringify(currentData),
      });
      const result = await response.json();

      if (response.ok && result.status === "created") {
        saveNote.textContent = `Saved — ${result.account} is live and ready to redeem.`;
        saveNote.style.color = "";
        if (emailClientBtn) emailClientBtn.hidden = !currentData.clientEmail;
        if (emailClientNote) emailClientNote.textContent = "";
      } else if (response.status === 401) {
        saveNote.textContent = "";
        handleSessionRejected();
      } else {
        saveNote.textContent = result.message || "Couldn't save — try again.";
        saveNote.style.color = "#ff8a8a";
      }
    } catch (err) {
      saveNote.textContent = "Couldn't reach api/create_client.php — is the backend deployed? Use the snippet below instead for now.";
      saveNote.style.color = "#ff8a8a";
    } finally {
      saveBtn.disabled = false;
    }
  });
}

// Shared by both "Email Account & Code to Client" buttons (the one here,
// right after saving a new client, and the one in the Existing Clients
// edit panel) — posts to api/send_client_email.php, which looks the
// client up server-side and sends them the same content as the "Message
// To Send The Client" box above, by email instead of copy-paste.
async function sendClientEmail(account, button, noteEl) {
  button.disabled = true;
  noteEl.textContent = "Sending…";
  noteEl.style.color = "";

  try {
    const response = await fetch("api/send_client_email.php", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...currentAuthHeader() },
      body: JSON.stringify({ account }),
    });

    if (response.status === 401) {
      noteEl.textContent = "";
      handleSessionRejected();
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

if (emailClientBtn) {
  emailClientBtn.addEventListener("click", () => {
    if (!currentData) return;
    sendClientEmail(currentData.account, emailClientBtn, emailClientNote);
  });
}

document.querySelectorAll("[data-copy-target]").forEach((button) => {
  button.addEventListener("click", async () => {
    if (!currentData) return;
    const targetId = button.getAttribute("data-copy-target");
    const text = targetId === "snippetText" ? buildSnippetText(currentData) : messageOutput.value;
    try {
      await navigator.clipboard.writeText(text);
      const original = button.textContent;
      button.textContent = "Copied!";
      setTimeout(() => {
        button.textContent = original;
      }, 1500);
    } catch (err) {
      // Clipboard API can fail (permissions, insecure context) — fall back
      // to selecting the text so the user can copy manually.
      if (targetId === "messageText") {
        messageOutput.select();
      }
    }
  });
});

// --- Existing clients: list + edit -----------------------------------------

const clientsListContainer = document.getElementById("clientsListContainer");
const clientsListNote = document.getElementById("clientsListNote");
const refreshClientsBtn = document.getElementById("refreshClientsBtn");
const clientsSearchInput = document.getElementById("clientsSearchInput");
const editClientPanel = document.getElementById("editClientPanel");
const editClientAccountLabel = document.getElementById("editClientAccount");
const editClientForm = document.getElementById("editClientForm");
const editClientNote = document.getElementById("editClientNote");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const saveEditBtn = document.getElementById("saveEditBtn");
const editEmailClientBtn = document.getElementById("editEmailClientBtn");
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

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]
  ));
}

// admin.js appends ?client_reference_id=... when a client is created (see
// withClientReference above); the edit form shows the plain base link
// instead, and this same helper reapplies the parameter on save — so
// editing never accidentally duplicates or drops it.
function stripClientReference(paymentUrl) {
  try {
    const url = new URL(paymentUrl, window.location.href);
    url.searchParams.delete("client_reference_id");
    return url.toString();
  } catch (err) {
    return paymentUrl;
  }
}

async function loadClients() {
  if (!clientsListContainer) return;

  clientsListNote.textContent = "Loading…";
  clientsListNote.style.color = "";

  try {
    const response = await fetch("api/list_clients.php", { headers: currentAuthHeader() });

    if (response.status === 401) {
      clientsListNote.textContent = "";
      handleSessionRejected();
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
    clientsListNote.textContent = "";
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
      (client.clientEmail || "").toLowerCase().includes(query)
  );
}

function renderClientsList() {
  if (!clientsCache.length) {
    clientsListContainer.innerHTML = `<p class="empty-note">No clients yet — generate one above.</p>`;
    return;
  }

  const filtered = getFilteredClients();

  if (!filtered.length) {
    clientsListContainer.innerHTML = `<p class="empty-note">No clients match that search.</p>`;
    return;
  }

  clientsListContainer.innerHTML = filtered
    .map(
      (client) => `
      <div class="client-row">
        <div class="client-row__info">
          <div class="client-row__account mono">${escapeHtml(client.account)}</div>
          <div class="client-row__service">${escapeHtml(client.title || client.service)} — ${escapeHtml(client.price)}</div>
          <div class="client-row__code mono">Code: ${escapeHtml(client.code)}</div>
        </div>
        <span class="status-pill status-pill--${client.status === "active" ? "active" : "pending"}">${client.status === "active" ? "Active" : "Pending Payment"}</span>
        <div class="client-row__actions">
          <button type="button" class="btn btn--ghost btn--sm" data-edit-account="${escapeHtml(client.account)}">Edit</button>
          <button type="button" class="btn btn--danger btn--sm" data-delete-account="${escapeHtml(client.account)}">Delete</button>
        </div>
      </div>
    `
    )
    .join("");

  clientsListContainer.querySelectorAll("[data-edit-account]").forEach((button) => {
    button.addEventListener("click", () => openEditPanel(button.getAttribute("data-edit-account")));
  });
  clientsListContainer.querySelectorAll("[data-delete-account]").forEach((button) => {
    button.addEventListener("click", () => deleteClient(button.getAttribute("data-delete-account")));
  });
}

if (clientsSearchInput) {
  clientsSearchInput.addEventListener("input", () => {
    if (clientsCache.length) renderClientsList();
  });
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
      headers: { "Content-Type": "application/json", ...currentAuthHeader() },
      body: JSON.stringify({ account }),
    });

    if (response.status === 401) {
      clientsListNote.textContent = "";
      handleSessionRejected();
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
  editClientForm.editService.value = client.service || "";
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
      editClientNote.textContent = "Fill in Service, Price and Payment link first.";
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
        headers: { "Content-Type": "application/json", ...currentAuthHeader() },
        body: JSON.stringify(payload),
      });

      if (response.status === 401) {
        editClientNote.textContent = "";
        handleSessionRejected();
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

if (refreshClientsBtn) {
  refreshClientsBtn.addEventListener("click", loadClients);
}

if (editEmailClientBtn) {
  editEmailClientBtn.addEventListener("click", () => {
    if (!editingAccount) return;
    sendClientEmail(editingAccount, editEmailClientBtn, editClientNote);
  });
}
