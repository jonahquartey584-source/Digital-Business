// Real AI Reception setup + management for ai-automation.html. Talks to
// /api/voice-manage (netlify/functions/voice-manage.mts). Auth note: same
// trust model as crm-app.js/crm-data.mts — the client's own verified
// email from qpMemberSession scopes their workspace.

function voiceMemberEmail() {
  const raw = localStorage.getItem("qpMemberSession") || sessionStorage.getItem("qpMemberSession");
  if (!raw) return null;
  try {
    return JSON.parse(raw).email || null;
  } catch {
    return null;
  }
}

const email = voiceMemberEmail();
const statusEl = document.getElementById("voiceStatus");

function setStatus(message, isError) {
  if (!statusEl) return;
  statusEl.textContent = message || "";
  statusEl.style.color = isError ? "#e07a6b" : "var(--muted)";
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

async function callVoice(action, payload) {
  const response = await fetch("/api/voice-manage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, action, payload }),
  });
  const data = await response.json();
  if (!response.ok || data.status !== "ok") throw new Error(data.message || "Something went wrong.");
  return data;
}

function renderNumberChoices(numbers) {
  const container = document.getElementById("voiceNumberChoices");
  if (!numbers.length) {
    container.innerHTML = `<p class="crm-column__empty">No numbers found — try again in a moment.</p>`;
    return;
  }
  container.innerHTML = `
    <div class="member-service-panel">
      <h2>Choose your number</h2>
      <div class="member-service-list">
        ${numbers
          .map(
            (n) => `
          <div class="member-service-row">
            <div><strong>${esc(n.phoneNumber)}</strong><br><span>${esc([n.locality, n.region].filter(Boolean).join(", ") || "UK")}</span></div>
            <button type="button" class="btn btn--primary" data-choose-number="${esc(n.phoneNumber)}" style="padding:.5rem 1rem">Choose this number</button>
          </div>`
          )
          .join("")}
      </div>
    </div>`;

  container.querySelectorAll("[data-choose-number]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      btn.textContent = "Setting up…";
      const form = document.getElementById("voiceSetupForm");
      const formData = Object.fromEntries(new FormData(form).entries());
      try {
        const data = await callVoice("provision", { ...formData, phoneNumber: btn.dataset.chooseNumber });
        setStatus("AI Reception is live on your new number.");
        showLive(data.settings);
      } catch (error) {
        setStatus(error.message, true);
        btn.disabled = false;
        btn.textContent = "Choose this number";
      }
    });
  });
}

document.getElementById("voiceSetupForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!email) {
    setStatus("Couldn't find your signed-in email — please return to the Members Portal and sign in again.", true);
    return;
  }
  const button = document.getElementById("voiceSearchBtn");
  button.disabled = true;
  setStatus("Finding available UK numbers…");
  try {
    const data = await callVoice("searchNumbers", {});
    setStatus(data.numbers.length ? "Pick a number below to finish setup." : "No numbers found.");
    renderNumberChoices(data.numbers);
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    button.disabled = false;
  }
});

document.getElementById("voiceUpdateForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = Object.fromEntries(new FormData(event.target).entries());
  try {
    const data = await callVoice("updateSettings", formData);
    setStatus("Saved.");
    showLive(data.settings);
  } catch (error) {
    setStatus(error.message, true);
  }
});

const STATUS_LABEL = {
  ringing: "Ringing",
  human_answered: "Answered by you",
  ai_answered: "Answered by AI",
  completed: "Completed",
};

function renderCallLog(calls) {
  const list = document.getElementById("voiceCallLog");
  if (!calls.length) {
    list.innerHTML = `<p class="crm-column__empty">No calls yet.</p>`;
    return;
  }
  list.innerHTML = calls
    .map(
      (call) => `
    <div class="member-service-row">
      <div>
        <strong>${esc(call.fromNumber || "Unknown number")}</strong>
        <span class="crm-badge">${STATUS_LABEL[call.status] || call.status}</span>
        <br><span>${new Date(call.startedAt).toLocaleString()}${call.durationSeconds ? ` · ${call.durationSeconds}s` : ""}</span>
        ${call.summary ? `<p style="margin:.4rem 0 0;color:var(--text)">${esc(call.summary)}</p>` : ""}
      </div>
    </div>`
    )
    .join("");
}

function showLive(settings) {
  document.getElementById("voiceSetup").hidden = true;
  document.getElementById("voiceLive").hidden = false;

  document.getElementById("voiceNumberDisplay").textContent = settings.phoneNumber || "—";
  document.getElementById("voiceEnabledDisplay").textContent = settings.enabled ? "Live" : "Paused";
  document.getElementById("voiceCallCountDisplay").textContent = String(settings.calls.length);

  const form = document.getElementById("voiceUpdateForm");
  form.businessName.value = settings.businessName || "";
  form.forwardingNumber.value = settings.forwardingNumber || "";
  form.businessContext.value = settings.businessContext || "";
  form.greeting.value = settings.greeting || "";

  renderCallLog(settings.calls);
}

function showSetup() {
  document.getElementById("voiceSetup").hidden = false;
  document.getElementById("voiceLive").hidden = true;
}

async function loadVoiceSettings() {
  if (!email) {
    setStatus("Couldn't find your signed-in email — please return to the Members Portal and sign in again.", true);
    showSetup();
    return;
  }
  try {
    const response = await fetch(`/api/voice-manage?email=${encodeURIComponent(email)}`);
    const data = await response.json();
    if (!response.ok || data.status !== "ok") throw new Error(data.message || "Could not load AI Reception settings.");
    if (data.settings.phoneNumber) {
      showLive(data.settings);
    } else {
      showSetup();
    }
  } catch (error) {
    setStatus(error.message || "Could not load AI Reception settings.", true);
    showSetup();
  }
}

loadVoiceSettings();
