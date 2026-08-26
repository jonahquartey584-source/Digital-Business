// Looks up the account number + activation code the visitor enters
// against CLIENT_ACCOUNTS (see accounts-data.js) and, on a match, shows
// a "Proceed to Payment" button linking to that client's payment URL.

function normalizeCode(value) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

const activateForm = document.getElementById("activateForm");
const activateResult = document.getElementById("activateResult");

if (activateForm && activateResult) {
  activateForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const accountInput = normalizeCode(document.getElementById("accountNumber").value);
    const codeInput = normalizeCode(document.getElementById("activationCode").value);

    const match = (typeof CLIENT_ACCOUNTS !== "undefined" ? CLIENT_ACCOUNTS : []).find(
      (entry) => normalizeCode(entry.account) === accountInput && normalizeCode(entry.code) === codeInput
    );

    if (match) {
      activateResult.className = "activate-result activate-result--success";
      activateResult.innerHTML = `
        <div class="terminal-window">
          <div class="terminal-window__bar">
            <span class="terminal-window__dot"></span>
            <span class="terminal-window__dot"></span>
            <span class="terminal-window__dot"></span>
            <span class="terminal-window__filename mono">response.json</span>
          </div>
          <div class="terminal-body mono">
            <p class="code-line">{</p>
            <p class="code-line code-line--indent"><span class="code-key">"status"</span><span class="code-punct">: </span><span class="code-string">"match_found"</span><span class="code-punct">,</span></p>
            <p class="code-line code-line--indent"><span class="code-key">"account"</span><span class="code-punct">: </span><span class="code-string">"${match.account}"</span><span class="code-punct">,</span></p>
            <p class="code-line code-line--indent"><span class="code-key">"service"</span><span class="code-punct">: </span><span class="code-string">"${match.service}"</span></p>
            <p class="code-line">}<span class="cursor" aria-hidden="true"></span></p>
          </div>
        </div>
        <div class="activate-result__message">
          <p>Account verified. Continue to payment to activate this service.</p>
          <a class="btn btn--primary btn--lg" href="${match.paymentUrl}" target="_blank" rel="noopener noreferrer">Proceed to Payment →</a>
        </div>
      `;
    } else {
      activateResult.className = "activate-result activate-result--error";
      activateResult.innerHTML = `
        <div class="terminal-window">
          <div class="terminal-window__bar">
            <span class="terminal-window__dot"></span>
            <span class="terminal-window__dot"></span>
            <span class="terminal-window__dot"></span>
            <span class="terminal-window__filename mono">response.json</span>
          </div>
          <div class="terminal-body mono">
            <p class="code-line">{</p>
            <p class="code-line code-line--indent"><span class="code-key">"status"</span><span class="code-punct">: </span><span class="code-string">"no_match"</span></p>
            <p class="code-line">}<span class="cursor" aria-hidden="true"></span></p>
          </div>
        </div>
        <div class="activate-result__message">
          <p>We couldn't find that account. Double-check the account number and code we sent you, or <a href="index.html#enquire">get in touch</a> if you think this is a mistake.</p>
        </div>
      `;
    }

    activateResult.hidden = false;
    activateResult.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
}
