// Internal tool: generates a random account number + activation code for a
// new client, and builds (1) the accounts-data.js snippet to paste in, and
// (2) a ready-to-send message with their details. Nothing here is saved or
// transmitted anywhere — it only runs in your browser.

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

function escapeJsString(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function buildSnippetHtml({ account, code, service, price, preview, paymentUrl }) {
  const line = (key, value, comma = true) =>
    `<p class="code-line code-line--indent"><span class="code-key">"${key}"</span><span class="code-punct">: </span><span class="code-string">"${escapeJsString(value)}"</span><span class="code-punct">${comma ? "," : ""}</span></p>`;

  return [
    `<p class="code-line">{</p>`,
    line("account", account),
    line("code", code),
    line("service", service),
    line("price", price),
    line("preview", preview),
    line("paymentUrl", paymentUrl, false),
    `<p class="code-line">},<span class="cursor" aria-hidden="true"></span></p>`,
  ].join("");
}

function buildSnippetText({ account, code, service, price, preview, paymentUrl }) {
  return [
    "{",
    `  account: "${escapeJsString(account)}",`,
    `  code: "${escapeJsString(code)}",`,
    `  service: "${escapeJsString(service)}",`,
    `  price: "${escapeJsString(price)}",`,
    `  preview: "${escapeJsString(preview)}",`,
    `  paymentUrl: "${escapeJsString(paymentUrl)}",`,
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
    "Once you pay, we'll get your service activated.",
  ].join("\n");
}

const adminForm = document.getElementById("adminForm");
const adminOutput = document.getElementById("adminOutput");
const snippetOutput = document.getElementById("snippetOutput");
const messageOutput = document.getElementById("messageOutput");
const regenerateBtn = document.getElementById("regenerateBtn");

let lastSnippetText = "";

function render() {
  const service = adminForm.adminService.value.trim();
  const price = adminForm.adminPrice.value.trim();
  const preview = adminForm.adminPreview.value.trim();
  const paymentUrl = adminForm.adminPaymentUrl.value.trim();

  if (!service || !price || !paymentUrl) return;

  const account = generateAccountNumber();
  const code = generateActivationCode();
  const data = { account, code, service, price, preview, paymentUrl };

  snippetOutput.innerHTML = buildSnippetHtml(data);
  lastSnippetText = buildSnippetText(data);
  messageOutput.value = buildMessageText(data);

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

document.querySelectorAll("[data-copy-target]").forEach((button) => {
  button.addEventListener("click", async () => {
    const targetId = button.getAttribute("data-copy-target");
    const text = targetId === "snippetText" ? lastSnippetText : messageOutput.value;
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
