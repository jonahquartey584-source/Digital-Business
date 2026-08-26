// Looks up the account number + activation code the visitor enters.
//
// Primary path: POST to api/redeem.php, a PHP/MySQL backend (see the
// api/ folder and the README's "Going live with real payment automation"
// section) that also reflects whether Stripe has already confirmed
// payment for that account.
//
// Fallback: if api/redeem.php can't be reached (e.g. you're previewing
// this on plain static hosting with no PHP, or haven't deployed the
// backend yet), fall back to the static CLIENT_ACCOUNTS list in
// accounts-data.js so the page still works for a demo/manual workflow —
// just without live payment status.

function normalizeCode(value) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

async function lookupAccount(account, code) {
  try {
    const response = await fetch("api/redeem.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account, code }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    // Backend not reachable — fall back to the static demo list.
    const accounts = typeof CLIENT_ACCOUNTS !== "undefined" ? CLIENT_ACCOUNTS : [];
    const match = accounts.find(
      (entry) => normalizeCode(entry.account) === account && normalizeCode(entry.code) === code
    );
    if (!match) return { status: "no_match" };
    return {
      status: "match_found",
      account: match.account,
      title: match.title || null,
      service: match.service,
      price: match.price,
      preview: match.preview,
      previewImageUrl: match.previewImageUrl || null,
      previewLinkUrl: match.previewLinkUrl || null,
      paymentUrl: match.paymentUrl,
      liveUrl: match.liveUrl || null,
      activeStatus: "pending_payment",
    };
  }
}

function terminalWindow(lines) {
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

// A clickable visual preview of the service (e.g. a website screenshot),
// shown in place of the raw JSON. The frame links to previewLinkUrl when
// the client set one (a staging link, draft site, Figma/Drive link, etc.)
// — otherwise it just opens the attached image itself. Returns null when
// no image was set on the client's account — the caller decides what
// (if anything) to show instead.
function previewFrame(result) {
  if (!result.previewImageUrl) return null;

  const linkUrl = result.previewLinkUrl || result.previewImageUrl;

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

const activateForm = document.getElementById("activateForm");
const activateResult = document.getElementById("activateResult");

if (activateForm && activateResult) {
  activateForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const account = normalizeCode(document.getElementById("accountNumber").value);
    const code = normalizeCode(document.getElementById("activationCode").value);

    activateResult.className = "activate-result";
    activateResult.innerHTML = `<p class="form-note">Checking your account…</p>`;
    activateResult.hidden = false;

    const result = await lookupAccount(account, code);
    const displayTitle = result.title || result.service;

    if (result.status === "match_found" && result.activeStatus === "active") {
      activateResult.className = "activate-result activate-result--success";
      activateResult.innerHTML =
        (previewFrame(result) || "") +
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
    } else if (result.status === "match_found") {
      activateResult.className = "activate-result activate-result--success";
      const preview = previewFrame(result);
      activateResult.innerHTML =
        // Only show the "Preview of …" heading when there's an actual
        // image to show under it — with no image, the order summary
        // below already covers the service, so there's nothing to add.
        (preview ? `<p class="order-summary__label mono" style="margin-bottom:14px;">Preview of ${displayTitle}</p>${preview}` : "") +
        `
        <div class="order-summary">
          <h3 class="order-summary__service">${result.service}</h3>
          <p class="order-summary__preview">${result.preview || "Details of what's included will be confirmed with you directly."}</p>
          <div class="order-summary__price-row">
            <span class="order-summary__price-label mono">Total</span>
            <span class="order-summary__price mono">${result.price}</span>
          </div>
          <a class="btn btn--primary btn--lg" href="${result.paymentUrl}" target="_blank" rel="noopener noreferrer">Pay ${result.price} &amp; Activate →</a>
          <p class="order-summary__note">Once your payment is confirmed, this service is activated automatically.</p>
        </div>
      `;
    } else {
      activateResult.className = "activate-result activate-result--error";
      activateResult.innerHTML =
        terminalWindow([["status", "no_match", false]]) +
        `
        <div class="activate-result__message">
          <p>We couldn't find that account. Double-check the account number and code we sent you, or <a href="index.html#enquire">get in touch</a> if you think this is a mistake.</p>
        </div>
      `;
    }

    activateResult.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
}
