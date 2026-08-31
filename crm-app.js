// Real CRM app logic for crm.html — talks to /api/crm-data
// (netlify/functions/crm-data.mts). Pipeline, Leads Database, Contacts,
// Tasks & Follow-ups, Reporting, Import History all live here, switched
// by the sidebar nav.

function crmMemberEmail() {
  const raw = localStorage.getItem("qpMemberSession") || sessionStorage.getItem("qpMemberSession");
  if (!raw) return null;
  try {
    return JSON.parse(raw).email || null;
  } catch {
    return null;
  }
}

const email = crmMemberEmail();
const statusEl = document.getElementById("crmStatus");
let workspace = { deals: [], leads: [], contacts: [], tasks: [], imports: [] };
let report = null;

function setStatus(message, isError) {
  if (!statusEl) return;
  statusEl.textContent = message || "";
  statusEl.style.color = isError ? "#e07a6b" : "var(--muted)";
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

async function call(action, payload) {
  const response = await fetch("/api/crm-data", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, action, payload }),
  });
  const data = await response.json();
  if (!response.ok || data.status !== "ok") throw new Error(data.message || "Something went wrong.");
  workspace = data.workspace;
  report = data.report;
  renderAll();
}

async function loadWorkspace() {
  if (!email) {
    setStatus("Couldn't find your signed-in email — please return to the Members Portal and sign in again.", true);
    return;
  }
  setStatus("Loading your CRM…");
  try {
    const response = await fetch(`/api/crm-data?email=${encodeURIComponent(email)}`);
    const data = await response.json();
    if (!response.ok || data.status !== "ok") throw new Error(data.message || "Could not load your CRM.");
    workspace = data.workspace;
    report = data.report;
    setStatus("");
    renderAll();
  } catch (error) {
    setStatus(error.message || "Could not load your CRM.", true);
  }
}

// ---------- Pipeline ----------

const STAGE_LABEL = { new: "New Lead", contacted: "Contacted", proposal: "Proposal Sent", won: "Won" };
const STAGES = ["new", "contacted", "proposal", "won"];

function money(n) {
  return (n || 0).toLocaleString(undefined, { style: "currency", currency: "GBP", maximumFractionDigits: 0 });
}

function renderPipeline() {
  const board = document.getElementById("crmBoard");
  if (!board) return;
  board.innerHTML = STAGES.map((stage) => {
    const deals = workspace.deals.filter((d) => d.stage === stage);
    const total = deals.reduce((sum, d) => sum + (d.value || 0), 0);
    const cards = deals
      .map(
        (deal) => `
      <div class="crm-deal" data-deal-id="${esc(deal.id)}">
        <div class="crm-deal__top"><strong>${esc(deal.title)}</strong></div>
        <p class="crm-deal__value">${deal.value ? money(deal.value) : "No value set"}</p>
        <div class="crm-deal__bottom">
          <select data-deal-move="${esc(deal.id)}">
            ${STAGES.map((s) => `<option value="${s}" ${s === stage ? "selected" : ""}>${STAGE_LABEL[s]}</option>`).join("")}
          </select>
          <button type="button" data-deal-delete="${esc(deal.id)}" class="crm-link-btn">Delete</button>
        </div>
      </div>`
      )
      .join("");
    return `
      <section class="crm-column" data-stage="${stage}">
        <div class="crm-column__head"><h2>${STAGE_LABEL[stage]}</h2><span>${deals.length}</span></div>
        <p class="crm-column__total">${money(total)} ${stage === "won" ? "won" : "potential"}</p>
        <p class="crm-column__empty">No deals here yet.</p>
        ${cards}
      </section>`;
  }).join("");

  board.querySelectorAll("[data-deal-move]").forEach((select) => {
    select.addEventListener("change", () => call("moveDeal", { id: select.dataset.dealMove, stage: select.value }).catch((e) => setStatus(e.message, true)));
  });
  board.querySelectorAll("[data-deal-delete]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (confirm("Delete this deal?")) call("deleteDeal", { id: btn.dataset.dealDelete }).catch((e) => setStatus(e.message, true));
    });
  });
}

document.getElementById("crmAddDealBtn")?.addEventListener("click", async () => {
  const title = prompt("Deal title (e.g. business name / what they need):");
  if (!title) return;
  const valueStr = prompt("Estimated value in £ (optional):", "");
  try {
    await call("addDeal", { title, value: valueStr });
  } catch (e) {
    setStatus(e.message, true);
  }
});

// ---------- Leads Database ----------

const LEAD_STATUS_LABEL = { new: "New", contacted: "Contacted", unqualified: "Unqualified", promoted: "Promoted" };

function renderLeads() {
  const list = document.getElementById("crmLeadsList");
  if (!list) return;
  if (workspace.leads.length === 0) {
    list.innerHTML = `<p class="crm-column__empty">No leads yet.</p>`;
    return;
  }
  list.innerHTML = workspace.leads
    .map((lead) => {
      const actions =
        lead.status === "promoted"
          ? `<span class="crm-badge crm-badge--done">Promoted</span>`
          : `
        <button type="button" class="crm-link-btn" data-lead-status="${esc(lead.id)}" data-status="contacted">Mark contacted</button>
        <button type="button" class="crm-link-btn" data-lead-status="${esc(lead.id)}" data-status="unqualified">Unqualify</button>
        <button type="button" class="btn btn--primary" data-lead-promote="${esc(lead.id)}" style="padding:.4rem .8rem">Promote</button>`;
      return `
      <div class="member-service-row">
        <div>
          <strong>${esc(lead.firstName)} ${esc(lead.lastName || "")}</strong>
          <span class="crm-badge">${LEAD_STATUS_LABEL[lead.status]}</span>
          <br><span>${esc([lead.source, lead.email, lead.phone].filter(Boolean).join(" · ") || "No contact details")}</span>
        </div>
        <div class="crm-row-actions">
          ${actions}
          <button type="button" class="crm-link-btn crm-link-btn--danger" data-lead-delete="${esc(lead.id)}">Delete</button>
        </div>
      </div>`;
    })
    .join("");

  list.querySelectorAll("[data-lead-status]").forEach((btn) => {
    btn.addEventListener("click", () => call("setLeadStatus", { id: btn.dataset.leadStatus, status: btn.dataset.status }).catch((e) => setStatus(e.message, true)));
  });
  list.querySelectorAll("[data-lead-promote]").forEach((btn) => {
    btn.addEventListener("click", () => call("promoteLead", { id: btn.dataset.leadPromote }).catch((e) => setStatus(e.message, true)));
  });
  list.querySelectorAll("[data-lead-delete]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (confirm("Delete this lead?")) call("deleteLead", { id: btn.dataset.leadDelete }).catch((e) => setStatus(e.message, true));
    });
  });
}

document.getElementById("crmLeadForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target;
  const payload = Object.fromEntries(new FormData(form).entries());
  try {
    await call("addLead", payload);
    form.reset();
  } catch (e) {
    setStatus(e.message, true);
  }
});

// ---------- Contacts ----------

function renderContacts() {
  const list = document.getElementById("crmContactsList");
  if (!list) return;
  if (workspace.contacts.length === 0) {
    list.innerHTML = `<p class="crm-column__empty">No contacts yet — promote a lead to create one.</p>`;
    return;
  }
  list.innerHTML = workspace.contacts
    .map(
      (c) => `
    <div class="member-service-row">
      <div><strong>${esc(c.firstName)} ${esc(c.lastName || "")}</strong><br><span>${esc([c.email, c.phone].filter(Boolean).join(" · ") || "No contact details")}</span></div>
      <div class="crm-row-actions"><button type="button" class="crm-link-btn crm-link-btn--danger" data-contact-delete="${esc(c.id)}">Delete</button></div>
    </div>`
    )
    .join("");
  list.querySelectorAll("[data-contact-delete]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (confirm("Delete this contact?")) call("deleteContact", { id: btn.dataset.contactDelete }).catch((e) => setStatus(e.message, true));
    });
  });
}

// ---------- Tasks & Follow-ups ----------

function populateTaskLinkOptions() {
  const select = document.querySelector('#crmTaskForm select[name="link"]');
  if (!select) return;
  const options = [
    ...workspace.leads.filter((l) => l.status !== "promoted").map((l) => ({ type: "lead", id: l.id, label: `${l.firstName} ${l.lastName || ""}`.trim() })),
    ...workspace.contacts.map((c) => ({ type: "contact", id: c.id, label: `${c.firstName} ${c.lastName || ""}`.trim() })),
    ...workspace.deals.map((d) => ({ type: "deal", id: d.id, label: d.title })),
  ];
  select.innerHTML = `<option value="">Not linked</option>` + options.map((o) => `<option value="${o.type}:${esc(o.id)}">${esc(o.label)} (${o.type})</option>`).join("");
}

function renderTaskRow(task) {
  const overdue = task.status === "open" && task.dueDate && new Date(task.dueDate) < new Date(new Date().toDateString());
  return `
    <div class="member-service-row">
      <div>
        <strong>${esc(task.title)}</strong>
        ${overdue ? '<span class="crm-badge crm-badge--overdue">Overdue</span>' : ""}
        <br><span>${task.dueDate ? `Due ${esc(task.dueDate)}` : "No due date"}${task.link ? ` · ${esc(task.link.label)}` : ""}</span>
      </div>
      <div class="crm-row-actions">
        ${task.status === "open"
          ? `<button type="button" class="btn btn--primary" style="padding:.4rem .8rem" data-task-status="${esc(task.id)}" data-status="done">Mark done</button>`
          : `<button type="button" class="crm-link-btn" data-task-status="${esc(task.id)}" data-status="open">Reopen</button>`}
        <button type="button" class="crm-link-btn crm-link-btn--danger" data-task-delete="${esc(task.id)}">Delete</button>
      </div>
    </div>`;
}

function renderTasks() {
  const openList = document.getElementById("crmTasksOpen");
  const doneList = document.getElementById("crmTasksDone");
  if (!openList || !doneList) return;
  const open = workspace.tasks.filter((t) => t.status === "open");
  const done = workspace.tasks.filter((t) => t.status === "done");
  openList.innerHTML = open.length ? open.map(renderTaskRow).join("") : `<p class="crm-column__empty">Nothing outstanding.</p>`;
  doneList.innerHTML = done.length ? done.map(renderTaskRow).join("") : `<p class="crm-column__empty">Nothing completed yet.</p>`;
  document.querySelectorAll("[data-task-status]").forEach((btn) => {
    btn.addEventListener("click", () => call("setTaskStatus", { id: btn.dataset.taskStatus, status: btn.dataset.status }).catch((e) => setStatus(e.message, true)));
  });
  document.querySelectorAll("[data-task-delete]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (confirm("Delete this task?")) call("deleteTask", { id: btn.dataset.taskDelete }).catch((e) => setStatus(e.message, true));
    });
  });
  populateTaskLinkOptions();
}

document.getElementById("crmTaskForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target;
  const data = Object.fromEntries(new FormData(form).entries());
  const [linkType, linkId] = (data.link || "").split(":");
  try {
    await call("addTask", { title: data.title, dueDate: data.dueDate, linkType, linkId });
    form.reset();
  } catch (e) {
    setStatus(e.message, true);
  }
});

// ---------- Reporting ----------

function bar(label, count, total) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return `
    <div class="crm-bar">
      <div class="crm-bar__label"><span>${esc(label)}</span><span>${count}</span></div>
      <div class="crm-bar__track"><span style="width:${pct}%"></span></div>
    </div>`;
}

function renderReporting() {
  const stats = document.getElementById("crmReportStats");
  const pipelineEl = document.getElementById("crmReportPipeline");
  const leadsEl = document.getElementById("crmReportLeads");
  if (!stats || !report) return;

  stats.innerHTML = `
    <article class="crm-stat"><span>Open pipeline</span><strong>${money(report.openPipelineValue)}</strong></article>
    <article class="crm-stat"><span>Won value</span><strong>${money(report.wonValue)}</strong></article>
    <article class="crm-stat"><span>Open tasks</span><strong>${report.openTaskCount}</strong></article>
    <article class="crm-stat"><span>Overdue tasks</span><strong>${report.overdueTaskCount}</strong></article>`;

  const dealTotal = report.dealsByStage.reduce((s, d) => s + d.count, 0);
  pipelineEl.innerHTML = report.dealsByStage.map((d) => bar(STAGE_LABEL[d.stage], d.count, dealTotal)).join("");

  const leadTotal = report.leadsByStatus.reduce((s, l) => s + l.count, 0);
  leadsEl.innerHTML = report.leadsByStatus.map((l) => bar(LEAD_STATUS_LABEL[l.status], l.count, leadTotal)).join("");
}

// ---------- Import History ----------

function parseCsv(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  const input = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else field += char;
      continue;
    }
    if (char === '"') inQuotes = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else field += char;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim().length));
}

function csvRowsToLeads(rows) {
  if (!rows.length) return { ok: [], errorCount: 0 };
  const normalize = (s) => s.trim().toLowerCase().replace(/[\s_-]/g, "");
  const header = rows[0].map(normalize);
  const findCol = (...names) => names.map((n) => header.indexOf(n)).find((i) => i !== -1) ?? -1;
  const firstNameIdx = findCol("firstname", "first", "name");
  const lastNameIdx = findCol("lastname", "last", "surname");
  const emailIdx = findCol("email", "emailaddress");
  const phoneIdx = findCol("phone", "phonenumber", "mobile", "tel");
  const ok = [];
  let errorCount = 0;
  for (const row of rows.slice(1)) {
    const firstName = firstNameIdx !== -1 ? (row[firstNameIdx] || "").trim() : "";
    if (!firstName) { errorCount++; continue; }
    ok.push({
      firstName,
      lastName: lastNameIdx !== -1 ? (row[lastNameIdx] || "").trim() || null : null,
      email: emailIdx !== -1 ? (row[emailIdx] || "").trim() || null : null,
      phone: phoneIdx !== -1 ? (row[phoneIdx] || "").trim() || null : null,
    });
  }
  return { ok, errorCount };
}

function renderImportHistory() {
  const list = document.getElementById("crmImportHistory");
  if (!list) return;
  if (workspace.imports.length === 0) {
    list.innerHTML = `<p class="crm-column__empty">No imports yet.</p>`;
    return;
  }
  list.innerHTML = workspace.imports
    .map(
      (imp) => `
    <div class="member-service-row">
      <div><strong>${esc(imp.filename)}</strong><br><span>${new Date(imp.createdAt).toLocaleString()} · ${imp.successCount} imported${imp.errorCount ? `, ${imp.errorCount} skipped` : ""}</span></div>
    </div>`
    )
    .join("");
}

document.getElementById("crmImportForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target;
  const file = form.file.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const { ok, errorCount } = csvRowsToLeads(parseCsv(text));
    await call("importCsv", { filename: file.name, rows: ok, errorCount });
    form.reset();
  } catch (e) {
    setStatus(e.message, true);
  }
});

// ---------- Nav switching ----------

const VIEW_TITLE = {
  pipeline: "Pipeline",
  leads: "Leads Database",
  contacts: "Contacts",
  tasks: "Tasks & Follow-ups",
  reporting: "Reporting",
  import: "Import History",
};
const VIEW_LEAD = {
  pipeline: "Track every opportunity from enquiry to customer.",
  leads: "Unqualified leads, kept separate until they're worth promoting.",
  contacts: "Everyone you've engaged with, with a full history.",
  tasks: "Nothing depends on remembering.",
  reporting: "Pipeline value, win rate, and lead conversion at a glance.",
  import: "Bring in existing contacts from a CSV file.",
};

function showView(view) {
  document.querySelectorAll("[data-crm-view]").forEach((el) => el.classList.toggle("is-active", el.dataset.crmView === view));
  document.querySelectorAll("[data-crm-panel]").forEach((el) => { el.hidden = el.dataset.crmPanel !== view; });
  const title = document.querySelector("[data-crm-view-title]");
  const lead = document.querySelector("[data-crm-view-lead]");
  if (title) title.textContent = VIEW_TITLE[view] || view;
  if (lead) lead.textContent = VIEW_LEAD[view] || "";
  const tools = document.querySelector('.service-app-tools[data-crm-view]');
  if (tools) tools.hidden = tools.dataset.crmView !== view;
}

document.querySelectorAll("button[data-crm-view]").forEach((btn) => {
  btn.addEventListener("click", () => showView(btn.dataset.crmView));
});

function renderAll() {
  renderPipeline();
  renderLeads();
  renderContacts();
  renderTasks();
  renderReporting();
  renderImportHistory();
}

loadWorkspace();
