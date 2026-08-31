// The real CRM backend for crm.html — one JSON "workspace" per client
// email, stored in Netlify Blobs. Handles Pipeline, Leads Database,
// Contacts, Tasks & Follow-ups, Reporting (computed, not stored), and
// CSV import in one function since they all read/write the same
// workspace record.
//
// Auth note: like member-access.mts/member-purchases.mts, this trusts the
// email the client sends rather than a verified server session — this
// site has no shared session token to check against. crm.html only ever
// sends the email from a member's own qpMemberSession after they've
// already passed the CRM purchase gate, matching this site's existing
// trust model throughout (not a new weakness introduced here).

import type { Config, Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { randomUUID } from "node:crypto";
import { json } from "./_shared.mts";

type DealStage = "new" | "contacted" | "proposal" | "won";
type LeadStatus = "new" | "contacted" | "unqualified" | "promoted";
type TaskStatus = "open" | "done";

interface CrmDeal {
  id: string;
  title: string;
  value: number | null;
  stage: DealStage;
  createdAt: string;
}
interface CrmLead {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  status: LeadStatus;
  promotedContactId: string | null;
  createdAt: string;
}
interface CrmContact {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  createdAt: string;
}
interface CrmTaskLink {
  type: "lead" | "contact" | "deal";
  id: string;
  label: string;
}
interface CrmTask {
  id: string;
  title: string;
  dueDate: string | null;
  status: TaskStatus;
  link: CrmTaskLink | null;
  createdAt: string;
}
interface CrmImportRecord {
  id: string;
  filename: string;
  rowCount: number;
  successCount: number;
  errorCount: number;
  createdAt: string;
}
interface CrmWorkspace {
  email: string;
  deals: CrmDeal[];
  leads: CrmLead[];
  contacts: CrmContact[];
  tasks: CrmTask[];
  imports: CrmImportRecord[];
}

const STAGES: DealStage[] = ["new", "contacted", "proposal", "won"];

function emptyWorkspace(email: string): CrmWorkspace {
  return { email, deals: [], leads: [], contacts: [], tasks: [], imports: [] };
}

function store() {
  return getStore({ name: "crm-workspaces", consistency: "strong" });
}

function normalizeEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

async function loadWorkspace(email: string): Promise<CrmWorkspace> {
  const existing = (await store().get(email, { type: "json" })) as CrmWorkspace | null;
  return existing ?? emptyWorkspace(email);
}

async function saveWorkspace(ws: CrmWorkspace): Promise<void> {
  await store().setJSON(ws.email, ws);
}

function reportFor(ws: CrmWorkspace) {
  const openStages: DealStage[] = ["new", "contacted", "proposal"];
  const openPipelineValue = ws.deals
    .filter((d) => openStages.includes(d.stage))
    .reduce((sum, d) => sum + (d.value ?? 0), 0);
  const wonValue = ws.deals.filter((d) => d.stage === "won").reduce((sum, d) => sum + (d.value ?? 0), 0);
  const dealsByStage = STAGES.map((stage) => ({
    stage,
    count: ws.deals.filter((d) => d.stage === stage).length,
  }));

  const leadStatuses: LeadStatus[] = ["new", "contacted", "unqualified", "promoted"];
  const leadsByStatus = leadStatuses.map((status) => ({
    status,
    count: ws.leads.filter((l) => l.status === status).length,
  }));
  const leadConversionRate =
    ws.leads.length > 0
      ? Math.round((ws.leads.filter((l) => l.status === "promoted").length / ws.leads.length) * 100)
      : null;

  const today = new Date(new Date().toDateString());
  const openTasks = ws.tasks.filter((t) => t.status === "open");
  const overdueTasks = openTasks.filter((t) => t.dueDate && new Date(t.dueDate) < today);

  return {
    openPipelineValue,
    wonValue,
    dealsByStage,
    leadsByStatus,
    leadConversionRate,
    openTaskCount: openTasks.length,
    overdueTaskCount: overdueTasks.length,
  };
}

function str(value: unknown): string | null {
  const s = String(value ?? "").trim();
  return s.length ? s : null;
}

export default async (req: Request, _context: Context) => {
  if (req.method === "GET") {
    const email = normalizeEmail(new URL(req.url).searchParams.get("email"));
    if (!email) return json(400, { status: "error", message: "email is required" });
    const ws = await loadWorkspace(email);
    return json(200, { status: "ok", workspace: ws, report: reportFor(ws) });
  }

  if (req.method !== "POST") {
    return json(405, { status: "error", message: "Method not allowed" });
  }

  const input = await req.json().catch(() => ({}) as Record<string, unknown>);
  const email = normalizeEmail(input.email);
  const action = String(input.action ?? "");
  const payload = (input.payload ?? {}) as Record<string, unknown>;
  if (!email) return json(400, { status: "error", message: "email is required" });

  const ws = await loadWorkspace(email);
  const now = new Date().toISOString();

  switch (action) {
    case "addDeal": {
      const title = str(payload.title);
      if (!title) return json(400, { status: "error", message: "Deal title is required." });
      const valueRaw = payload.value;
      const value = valueRaw !== undefined && valueRaw !== null && String(valueRaw).trim() !== "" ? Number(valueRaw) : null;
      ws.deals.push({ id: randomUUID(), title, value, stage: "new", createdAt: now });
      break;
    }
    case "moveDeal": {
      const id = str(payload.id);
      const stage = payload.stage as DealStage;
      if (!id || !STAGES.includes(stage)) return json(400, { status: "error", message: "Invalid deal move." });
      const deal = ws.deals.find((d) => d.id === id);
      if (deal) deal.stage = stage;
      break;
    }
    case "deleteDeal": {
      ws.deals = ws.deals.filter((d) => d.id !== str(payload.id));
      break;
    }

    case "addLead": {
      const firstName = str(payload.firstName);
      if (!firstName) return json(400, { status: "error", message: "First name is required." });
      ws.leads.push({
        id: randomUUID(),
        firstName,
        lastName: str(payload.lastName),
        email: str(payload.email),
        phone: str(payload.phone),
        source: str(payload.source) ?? "Manual entry",
        status: "new",
        promotedContactId: null,
        createdAt: now,
      });
      break;
    }
    case "setLeadStatus": {
      const lead = ws.leads.find((l) => l.id === str(payload.id));
      const status = payload.status as LeadStatus;
      if (lead && ["new", "contacted", "unqualified"].includes(status)) lead.status = status;
      break;
    }
    case "promoteLead": {
      const lead = ws.leads.find((l) => l.id === str(payload.id));
      if (!lead) return json(404, { status: "error", message: "Lead not found." });
      const contact: CrmContact = {
        id: randomUUID(),
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email,
        phone: lead.phone,
        notes: null,
        createdAt: now,
      };
      ws.contacts.push(contact);
      lead.status = "promoted";
      lead.promotedContactId = contact.id;
      break;
    }
    case "deleteLead": {
      ws.leads = ws.leads.filter((l) => l.id !== str(payload.id));
      break;
    }

    case "deleteContact": {
      ws.contacts = ws.contacts.filter((c) => c.id !== str(payload.id));
      break;
    }

    case "addTask": {
      const title = str(payload.title);
      if (!title) return json(400, { status: "error", message: "Task title is required." });
      let link: CrmTaskLink | null = null;
      const linkId = str(payload.linkId);
      const linkType = payload.linkType as CrmTaskLink["type"] | undefined;
      if (linkId && linkType) {
        const source =
          linkType === "lead" ? ws.leads.find((l) => l.id === linkId) :
          linkType === "contact" ? ws.contacts.find((c) => c.id === linkId) :
          ws.deals.find((d) => d.id === linkId);
        if (source) {
          const label =
            "title" in source ? source.title : `${source.firstName} ${source.lastName ?? ""}`.trim();
          link = { type: linkType, id: linkId, label };
        }
      }
      ws.tasks.push({ id: randomUUID(), title, dueDate: str(payload.dueDate), status: "open", link, createdAt: now });
      break;
    }
    case "setTaskStatus": {
      const task = ws.tasks.find((t) => t.id === str(payload.id));
      const status = payload.status as TaskStatus;
      if (task && ["open", "done"].includes(status)) task.status = status;
      break;
    }
    case "deleteTask": {
      ws.tasks = ws.tasks.filter((t) => t.id !== str(payload.id));
      break;
    }

    case "importCsv": {
      const filename = str(payload.filename) ?? "import.csv";
      const rows = Array.isArray(payload.rows) ? (payload.rows as Array<Record<string, unknown>>) : [];
      const errorCount = Number(payload.errorCount ?? 0) || 0;
      let successCount = 0;
      for (const row of rows) {
        const firstName = str(row.firstName);
        if (!firstName) continue;
        ws.leads.push({
          id: randomUUID(),
          firstName,
          lastName: str(row.lastName),
          email: str(row.email),
          phone: str(row.phone),
          source: "CSV import",
          status: "new",
          promotedContactId: null,
          createdAt: now,
        });
        successCount++;
      }
      ws.imports.unshift({
        id: randomUUID(),
        filename,
        rowCount: rows.length + errorCount,
        successCount,
        errorCount: errorCount + (rows.length - successCount),
        createdAt: now,
      });
      break;
    }

    default:
      return json(400, { status: "error", message: `Unknown action: ${action}` });
  }

  await saveWorkspace(ws);
  return json(200, { status: "ok", workspace: ws, report: reportFor(ws) });
};

export const config: Config = { path: "/api/crm-data" };
