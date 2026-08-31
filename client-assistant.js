(() => {
  if (document.body.dataset.clientAssistantReady) return;
  document.body.dataset.clientAssistantReady = "true";
  const serviceName = document.querySelector("[data-member-service]")?.querySelector("h1")?.textContent?.trim() || document.title.split("—")[0].trim();
  const launcher = document.createElement("button");
  launcher.className = "client-ai-launcher"; launcher.type = "button"; launcher.setAttribute("aria-label", "Open Qp Digital client assistant"); launcher.textContent = "✦";
  const panel = document.createElement("section");
  panel.className = "client-ai-panel"; panel.hidden = true;
  panel.innerHTML = `<div class="client-ai-head"><div><strong>Qp Client Assistant</strong><span>${serviceName} support · Online</span></div><button class="client-ai-close" type="button" aria-label="Close assistant">×</button></div><div class="client-ai-messages" aria-live="polite"><div class="client-ai-message client-ai-message--assistant">Hi — I’m your Qp Digital client assistant. I can help you understand this workspace, plan your next step, or prepare a request for the Qp Digital team.</div></div><form class="client-ai-form"><input name="message" aria-label="Message the Qp Client Assistant" placeholder="Ask about your service…" autocomplete="off" required><button type="submit" aria-label="Send message">↑</button></form>`;
  document.body.append(launcher, panel);
  const messagesEl = panel.querySelector(".client-ai-messages"); const history = [];
  const add = (role, content) => { const item = document.createElement("div"); item.className = `client-ai-message client-ai-message--${role}`; item.textContent = content; messagesEl.appendChild(item); messagesEl.scrollTop = messagesEl.scrollHeight; };
  launcher.addEventListener("click", () => { panel.hidden = false; panel.querySelector("input").focus(); });
  panel.querySelector(".client-ai-close").addEventListener("click", () => { panel.hidden = true; });
  panel.querySelector("form").addEventListener("submit", async (event) => {
    event.preventDefault(); const input = event.currentTarget.message; const text = input.value.trim(); if (!text) return; input.value = ""; add("user", text); history.push({ role: "user", content: `The client is inside their ${serviceName} workspace. ${text}` }); input.disabled = true;
    try { const response = await fetch("/api/ai-help", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: history.slice(-8) }) }); const data = await response.json(); if (!response.ok || !data.reply) throw new Error(); add("assistant", data.reply); history.push({ role: "assistant", content: data.reply }); }
    catch { add("assistant", "I’m temporarily unavailable. You can still use the ‘Make a Request’ option and the Qp Digital team will help you."); }
    finally { input.disabled = false; input.focus(); }
  });
})();
