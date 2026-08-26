// Internal tool: generates a random account number + activation code for a
// new client, builds their payment link (with ?client_reference_id=...
// appended so the Stripe webhook can identify them), and either saves the
// client straight to the live database (api/create_client.php) or gives
// you a snippet to paste into accounts-data.js as a fallback.

const BUSINESS_NAME = "Qp Digital";
const REDEEM_URL = "https://yourdomain.com/activate.html"; // update to your real domain once deployed

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

let currentData = null;

// Set once their respective file input finishes uploading (see
// wireFileUpload below). render() reads these instead of typed URLs — the
// client just attaches files, nothing to paste.
let uploadedPreviewImageUrl = null;
let uploadedPreviewFileUrl = null;

// Shared upload flow for both file inputs: requires the admin password,
// POSTs the file to `endpoint`, and calls `onUploaded(url, file)` once it's
// saved server-side. `statusEl` shows progress/errors inline.
function wireFileUpload(fileInput, statusEl, endpoint, onUploaded) {
  if (!fileInput) return;

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;

    const adminPassword = adminForm.adminPassword.value;
    if (!adminPassword) {
      statusEl.textContent = "Enter the admin password below first, then choose the file again.";
      statusEl.style.color = "#ff8a8a";
      fileInput.value = "";
      return;
    }

    onUploaded(null); // clear any previous upload while this one's in flight
    statusEl.textContent = "Uploading…";
    statusEl.style.color = "";

    const formData = new FormData();
    formData.append("file", file);
    formData.append("adminPassword", adminPassword);

    try {
      const response = await fetch(endpoint, { method: "POST", body: formData });
      const result = await response.json();

      if (response.ok && result.status === "uploaded") {
        statusEl.textContent = `Uploaded ✓ ${file.name}`;
        statusEl.style.color = "";
        onUploaded(result.url, file);
      } else {
        statusEl.textContent = result.message || "Upload failed — check the admin password and try again.";
        statusEl.style.color = "#ff8a8a";
      }
    } catch (err) {
      statusEl.textContent = `Couldn't reach ${endpoint} — is the PHP backend deployed?`;
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

function render() {
  const title = adminForm.adminTitle.value.trim();
  const service = adminForm.adminService.value.trim();
  const price = adminForm.adminPrice.value.trim();
  const preview = adminForm.adminPreview.value.trim();
  const basePaymentUrl = adminForm.adminPaymentUrl.value.trim();
  const liveUrl = adminForm.adminLiveUrl.value.trim();

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
    paymentUrl,
    liveUrl,
  };

  snippetOutput.innerHTML = buildSnippetHtml(currentData);
  messageOutput.value = buildMessageText(currentData);
  saveNote.textContent = "";

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

    const adminPassword = adminForm.adminPassword.value;
    if (!adminPassword) {
      saveNote.textContent = "Enter the admin password above first.";
      saveNote.style.color = "#ff8a8a";
      return;
    }

    saveBtn.disabled = true;
    saveNote.textContent = "Saving…";
    saveNote.style.color = "";

    try {
      const response = await fetch("api/create_client.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...currentData, adminPassword }),
      });
      const result = await response.json();

      if (response.ok && result.status === "created") {
        saveNote.textContent = `Saved — ${result.account} is live and ready to redeem.`;
        saveNote.style.color = "";
      } else {
        saveNote.textContent = result.message || "Couldn't save — check the admin password and try again.";
        saveNote.style.color = "#ff8a8a";
      }
    } catch (err) {
      saveNote.textContent = "Couldn't reach api/create_client.php — is the PHP backend deployed? Use the snippet below instead for now.";
      saveNote.style.color = "#ff8a8a";
    } finally {
      saveBtn.disabled = false;
    }
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
