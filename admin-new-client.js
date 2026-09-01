// New Client Setup tool: generates a random account number + activation
// code for a new client, builds their payment link (with
// ?client_reference_id=... appended so the Stripe webhook can identify
// them), and either saves the client straight to the live database
// (api/create_client.php) or gives you a snippet to paste into
// accounts-data.js as a fallback.
//
// Session handling lives in admin-common.js (loaded before this file) —
// requireAdminSession() below bounces back to admin.html if there's no
// valid admin session.

const session = requireAdminSession();
if (session) {
  const loggedInEmail = document.getElementById("loggedInEmail");
  if (loggedInEmail) loggedInEmail.textContent = session.email;
}

const BUSINESS_NAME = "Qp Digital";
const REDEEM_URL = "https://qp-digital.co.uk/activate.html";

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
const websiteZipFile = document.getElementById("adminWebsiteZipFile");
const websiteZipStatus = document.getElementById("websiteZipStatus");
const emailClientBtn = document.getElementById("emailClientBtn");
const emailClientNote = document.getElementById("emailClientNote");

// Keeps the hidden #adminService input (what actually gets saved as the
// client's `service` field) in sync with the checkbox group + "Other"
// text — a comma-joined list, e.g. "CRM, AI & Automation". Each service
// page's own gate (member-service.js's data-service-aliases check) does a
// case-insensitive substring match against this whole string, so a client
// with multiple boxes checked gets every one of those pages unlocked by
// the same account number + code — no per-service accounts needed.
const adminServiceHidden = document.getElementById("adminService");
const adminServiceOther = document.getElementById("adminServiceOther");
function syncAdminServiceField() {
  const checked = Array.from(
    document.querySelectorAll('input[name="adminServiceOption"]:checked')
  ).map((el) => el.value);
  const other = adminServiceOther.value.trim();
  adminServiceHidden.value = [...checked, other].filter(Boolean).join(", ");
}
document.querySelectorAll('input[name="adminServiceOption"]').forEach((el) => {
  el.addEventListener("change", syncAdminServiceField);
});
adminServiceOther.addEventListener("input", syncAdminServiceField);

let currentData = null;

// Set once their respective file input finishes uploading (see
// wireFileUpload below). render() reads these instead of typed URLs — the
// client just attaches files, nothing to paste.
let uploadedPreviewImageUrl = null;
let uploadedPreviewFileUrl = null;
let uploadedDeliverableFileUrl = null;
let uploadedWebsiteZipUrl = null;

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

// The actual deployable site — a .zip, not shown to the client at all
// until deployClientWebsite (server-side, on payment) turns it into a real
// Netlify site and sets liveUrl. Same upload endpoint again; it's generic
// on file type.
wireFileUpload(websiteZipFile, websiteZipStatus, "api/upload_preview_file.php", (url) => {
  uploadedWebsiteZipUrl = url;
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
  // rather than silently doing nothing. Payment link is optional — the
  // redeem page pays the Price above directly via embedded Stripe
  // Checkout, no Payment Link required.
  if (!service || !price) {
    saveNote.textContent = "Check at least one service (or fill in \"Other\"), and fill in Price.";
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
  if (websiteZipFile && websiteZipFile.files[0] && !uploadedWebsiteZipUrl) {
    saveNote.textContent = "Still uploading the website .zip — wait for \"Uploaded ✓\" first.";
    saveNote.style.color = "#ff8a8a";
    return;
  }
  saveNote.style.color = "";

  const account = generateAccountNumber();
  const code = generateActivationCode();
  const paymentUrl = basePaymentUrl ? withClientReference(basePaymentUrl, account) : "";

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
    websiteZipUrl: uploadedWebsiteZipUrl,
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
        headers: { "Content-Type": "application/json", ...adminAuthHeader() },
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
        adminHandleSessionRejected();
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

// Shared by the "Email Account & Code to Client" button — posts to
// api/send_client_email.php, which looks the client up server-side and
// sends them the same content as the "Message To Send The Client" box
// above, by email instead of copy-paste.
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
