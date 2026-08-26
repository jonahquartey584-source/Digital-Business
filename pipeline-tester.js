// Internal tool: click through the exact same client-activation pipeline
// as admin.html + activate.html, entirely in this browser. Test clients
// live only in this page's own localStorage key — a "Simulate Payment"
// button stands in for a real Stripe webhook. This file never calls
// api/create_client.php, api/redeem.php, or either upload endpoint, so
// nothing done here can touch a real client or the real database.
//
// Deliberately self-contained rather than reusing admin.js/activate.js
// directly: those wire up real network calls to the real endpoints, which
// is exactly what this page exists to avoid.

const PT_STORAGE_KEY = "qp_pipeline_tester_clients";
const PT_CODE_CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function ptLoadClients() {
  try {
    return JSON.parse(localStorage.getItem(PT_STORAGE_KEY) || "[]");
  } catch (err) {
    return [];
  }
}

function ptSaveClients(clients) {
  localStorage.setItem(PT_STORAGE_KEY, JSON.stringify(clients));
}

function ptRandomFromCharset(charset, length) {
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  return Array.from(values, (v) => charset[v % charset.length]).join("");
}

function ptGenerateAccountNumber() {
  return `QP-${new Date().getFullYear()}-${ptRandomFromCharset("0123456789", 4)}`;
}

function ptGenerateCode() {
  return `${ptRandomFromCharset(PT_CODE_CHARSET, 4)}-${ptRandomFromCharset(PT_CODE_CHARSET, 4)}`;
}

function ptNormalize(value) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

// ---- Tabs ----
const ptTabs = document.querySelectorAll(".tab");
ptTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    ptTabs.forEach((t) => t.classList.remove("is-active"));
    document.querySelectorAll(".view").forEach((view) => {
      view.hidden = true;
    });
    tab.classList.add("is-active");
    document.getElementById("view-" + tab.dataset.tab).hidden = false;
  });
});

// ---- New Client Setup ----
const ptSetupForm = document.getElementById("ptSetupForm");
const ptOutput = document.getElementById("ptOutput");
const ptOutputBody = document.getElementById("ptOutputBody");
const ptClientListEl = document.getElementById("ptClientList");
const ptSetupError = document.getElementById("ptSetupError");
const ptPreviewImageFile = document.getElementById("ptPreviewImageFile");
const ptPreviewImageThumb = document.getElementById("ptPreviewImageThumb");
const ptPreviewImageStatus = document.getElementById("ptPreviewImageStatus");
const ptPreviewFile = document.getElementById("ptPreviewFile");
const ptPreviewFileStatus = document.getElementById("ptPreviewFileStatus");

// No real backend involved here, so there's nothing to upload to — files
// are just read straight into data URIs and stored in localStorage along
// with everything else. The real site instead uploads them via
// api/upload_preview_image.php / api/upload_preview_file.php and stores a
// URL (see admin.js).
let ptAttachedImageDataUrl = null;
let ptAttachedFileDataUrl = null;

function ptWireFileAttach(fileInput, statusEl, maxBytes, onRead, onClear) {
  if (!fileInput) return;
  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    onClear();
    if (!file) return;

    // localStorage only has a few MB of room, and a data URI runs ~33%
    // bigger than the file — keep it small so one big attachment doesn't
    // blow the quota.
    if (file.size > 2 * 1024 * 1024) {
      statusEl.textContent = `That file is too large for the tester (2MB max here — the real site allows more).`;
      statusEl.style.color = "#ff8a8a";
      fileInput.value = "";
      return;
    }

    statusEl.textContent = "Reading…";
    statusEl.style.color = "";

    const reader = new FileReader();
    reader.onload = () => {
      statusEl.textContent = `Attached ✓ ${file.name}`;
      statusEl.style.color = "";
      onRead(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

ptWireFileAttach(
  ptPreviewImageFile,
  ptPreviewImageStatus,
  2 * 1024 * 1024,
  (dataUrl) => {
    ptAttachedImageDataUrl = dataUrl;
    ptPreviewImageThumb.src = dataUrl;
    ptPreviewImageThumb.hidden = false;
  },
  () => {
    ptAttachedImageDataUrl = null;
    ptPreviewImageThumb.hidden = true;
  }
);

ptWireFileAttach(
  ptPreviewFile,
  ptPreviewFileStatus,
  2 * 1024 * 1024,
  (dataUrl) => {
    ptAttachedFileDataUrl = dataUrl;
  },
  () => {
    ptAttachedFileDataUrl = null;
  }
);

function ptCodeLine(key, value, comma) {
  return `<p class="code-line code-line--indent"><span class="code-key">"${key}"</span><span class="code-punct">: </span><span class="code-string">"${value || ""}"</span><span class="code-punct">${comma ? "," : ""}</span></p>`;
}

function ptRenderClientList() {
  if (!ptClientListEl) return;
  const clients = ptLoadClients();
  if (!clients.length) {
    ptClientListEl.innerHTML = `<p class="empty-note">No test clients yet — generate one above.</p>`;
    return;
  }
  ptClientListEl.innerHTML = clients
    .slice()
    .reverse()
    .map(
      (c) => `
      <div class="client-row">
        <div class="client-row__info">
          <div class="client-row__account mono">${c.account}</div>
          <div class="client-row__service">${c.service} — ${c.price}</div>
          <div class="client-row__code mono">Code: ${c.code}</div>
        </div>
        <span class="status-pill status-pill--${c.status === "active" ? "active" : "pending"}">${c.status === "active" ? "Active" : "Pending Payment"}</span>
        <div class="client-row__actions">
          ${c.status !== "active" ? `<button type="button" class="btn btn--ghost btn--sm" data-simulate="${c.account}">Simulate Payment</button>` : ""}
          <button type="button" class="btn btn--danger btn--sm" data-delete="${c.account}">Delete</button>
        </div>
      </div>
    `
    )
    .join("");
}

if (ptSetupForm) {
  ptSetupForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const title = document.getElementById("ptTitle").value.trim();
    const service = document.getElementById("ptService").value.trim();
    const price = document.getElementById("ptPrice").value.trim();
    const preview = document.getElementById("ptPreview").value.trim();
    const basePaymentUrl = document.getElementById("ptPaymentUrl").value.trim();
    const liveUrl = document.getElementById("ptLiveUrl").value.trim();

    if (!service || !price || !basePaymentUrl) {
      ptSetupError.textContent = "Fill in Service, Price and Payment link first.";
      ptSetupError.style.color = "#ff8a8a";
      return;
    }
    if (ptPreviewImageFile.files[0] && !ptAttachedImageDataUrl) {
      ptSetupError.textContent = "Still reading the attached preview image — try again in a moment.";
      ptSetupError.style.color = "#ff8a8a";
      return;
    }
    if (ptPreviewFile.files[0] && !ptAttachedFileDataUrl) {
      ptSetupError.textContent = "Still reading the attached preview file — try again in a moment.";
      ptSetupError.style.color = "#ff8a8a";
      return;
    }
    ptSetupError.textContent = "";

    const account = ptGenerateAccountNumber();
    const code = ptGenerateCode();
    const separator = basePaymentUrl.includes("?") ? "&" : "?";
    const paymentUrl = `${basePaymentUrl}${separator}client_reference_id=${encodeURIComponent(account)}`;

    const clients = ptLoadClients();
    clients.push({
      account,
      code,
      title,
      service,
      price,
      preview,
      previewImageUrl: ptAttachedImageDataUrl,
      previewFileUrl: ptAttachedFileDataUrl,
      paymentUrl,
      liveUrl,
      status: "pending_payment",
    });
    ptSaveClients(clients);

    ptOutputBody.innerHTML = [
      `<p class="code-line">{</p>`,
      ptCodeLine("account", account, true),
      ptCodeLine("code", code, true),
      ptCodeLine("service", service, true),
      ptCodeLine("price", price, false),
      `<p class="code-line">}<span class="cursor" aria-hidden="true"></span></p>`,
    ].join("");
    ptOutput.hidden = false;

    // Reset the attachments so the next test client starts clean instead
    // of silently reusing this one's files.
    ptAttachedImageDataUrl = null;
    ptPreviewImageFile.value = "";
    ptPreviewImageThumb.hidden = true;
    ptPreviewImageStatus.textContent = "";
    ptAttachedFileDataUrl = null;
    ptPreviewFile.value = "";
    ptPreviewFileStatus.textContent = "";

    ptRenderClientList();
    ptOutput.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
}

if (ptClientListEl) {
  ptClientListEl.addEventListener("click", (event) => {
    const simulateAccount = event.target.getAttribute("data-simulate");
    const deleteAccount = event.target.getAttribute("data-delete");
    if (simulateAccount) {
      const clients = ptLoadClients();
      const client = clients.find((c) => c.account === simulateAccount);
      if (client) client.status = "active";
      ptSaveClients(clients);
      ptRenderClientList();
    }
    if (deleteAccount) {
      ptSaveClients(ptLoadClients().filter((c) => c.account !== deleteAccount));
      ptRenderClientList();
    }
  });
  ptRenderClientList();
}

// ---- Redeem ----
// Same terminalWindow()/previewFrame() rendering as activate.js, kept as a
// local copy (this page is meant to be fully self-contained and never
// calls the real api/redeem.php).
function ptTerminalWindow(lines) {
  const body = lines
    .map(([key, value, comma], i) => {
      const indent = i === 0 ? "" : "code-line--indent";
      return `<p class="code-line ${indent}"><span class="code-key">"${key}"</span><span class="code-punct">: </span><span class="code-string">"${value}"</span><span class="code-punct">${comma ? "," : ""}</span></p>`;
    })
    .join("");
  return `
    <div class="terminal-window">
      <div class="terminal-window__bar">
        <span class="terminal-window__dot"></span>
        <span class="terminal-window__dot"></span>
        <span class="terminal-window__dot"></span>
        <span class="terminal-window__filename mono">response.json</span>
      </div>
      <div class="terminal-body mono">
        <p class="code-line">{</p>
        ${body}
        <p class="code-line">}<span class="cursor" aria-hidden="true"></span></p>
      </div>
    </div>
  `;
}

function ptPreviewFrame(result) {
  if (!result.previewImageUrl) return null;

  const linkUrl = result.previewFileUrl || result.previewImageUrl;

  let urlLabel = result.service || "Preview";
  if (result.liveUrl) {
    try {
      urlLabel = new URL(result.liveUrl).hostname;
    } catch (err) {
      urlLabel = result.liveUrl;
    }
  }

  return `
    <a class="preview-frame-link" href="${linkUrl}" target="_blank" rel="noopener noreferrer">
      <div class="preview-frame">
        <div class="preview-frame__bar">
          <span class="preview-frame__dot"></span>
          <span class="preview-frame__dot"></span>
          <span class="preview-frame__dot"></span>
          <span class="preview-frame__url mono">${urlLabel}</span>
        </div>
        <img class="preview-frame__image" src="${result.previewImageUrl}" alt="Preview of ${result.title || result.service}" loading="lazy" />
        <div class="preview-frame__cta mono">View Full Preview →</div>
      </div>
    </a>
  `;
}

const ptRedeemForm = document.getElementById("ptRedeemForm");
const ptRedeemResult = document.getElementById("ptRedeemResult");
const ptRedeemError = document.getElementById("ptRedeemError");

if (ptRedeemForm && ptRedeemResult) {
  ptRedeemForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const account = ptNormalize(document.getElementById("ptAccountNumber").value);
    const code = ptNormalize(document.getElementById("ptActivationCode").value);

    if (!account || !code) {
      ptRedeemError.textContent = "Enter both an account number and a code first.";
      ptRedeemError.style.color = "#ff8a8a";
      return;
    }
    ptRedeemError.textContent = "";

    const result = ptLoadClients().find(
      (c) => ptNormalize(c.account) === account && ptNormalize(c.code) === code
    );
    const displayTitle = result ? result.title || result.service : null;

    ptRedeemResult.hidden = false;

    if (!result) {
      ptRedeemResult.className = "activate-result activate-result--error";
      ptRedeemResult.innerHTML =
        ptTerminalWindow([["status", "no_match", false]]) +
        `
        <div class="activate-result__message">
          <p>No test client matches that account + code. Double-check what you generated in Step 1, or go generate one there.</p>
        </div>
      `;
      ptRedeemResult.scrollIntoView({ behavior: "smooth", block: "nearest" });
      return;
    }

    if (result.status === "active") {
      ptRedeemResult.className = "activate-result activate-result--success";
      ptRedeemResult.innerHTML =
        (ptPreviewFrame(result) || "") +
        `
        <div class="order-summary">
          <p class="order-summary__label mono">Service Active</p>
          <h3 class="order-summary__service">${result.service}</h3>
          <p class="order-summary__preview">Payment confirmed — this service is live.</p>
          ${
            result.liveUrl
              ? `<a class="btn btn--primary btn--lg" href="${result.liveUrl}" target="_blank" rel="noopener noreferrer">Visit Your Live Site →</a>`
              : `<p class="order-summary__note">We'll be in touch if there's anything else needed to finish setting this up.</p>`
          }
        </div>
      `;
      ptRedeemResult.scrollIntoView({ behavior: "smooth", block: "nearest" });
      return;
    }

    const preview = ptPreviewFrame(result);
    ptRedeemResult.className = "activate-result activate-result--success";
    ptRedeemResult.innerHTML =
      (preview ? `<p class="order-summary__label mono" style="margin-bottom:14px;">Preview of ${displayTitle}</p>${preview}` : "") +
      `
      <div class="order-summary">
        <h3 class="order-summary__service">${result.service}</h3>
        <p class="order-summary__preview">${result.preview || "Details of what's included will be confirmed with you directly."}</p>
        <div class="order-summary__price-row">
          <span class="order-summary__price-label mono">Total</span>
          <span class="order-summary__price mono">${result.price}</span>
        </div>
        <button type="button" class="btn btn--primary btn--lg" id="ptSimulateFromRedeem" data-account="${result.account}">Simulate Payment &amp; Re-Check →</button>
        <p class="order-summary__note">In production this button is a real Stripe payment link, and activation happens via the webhook. Here it just flips this test client to active so you can see what the client sees next.</p>
      </div>
    `;

    const simulateBtn = document.getElementById("ptSimulateFromRedeem");
    if (simulateBtn) {
      simulateBtn.addEventListener("click", () => {
        const clients = ptLoadClients();
        const client = clients.find((c) => c.account === result.account);
        if (client) client.status = "active";
        ptSaveClients(clients);
        ptRenderClientList();
        ptRedeemForm.dispatchEvent(new Event("submit"));
      });
    }

    ptRedeemResult.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
}
