import { createClient } from "@/lib/supabase/server";
import { createTask, deleteTask, setTaskStatus } from "@/lib/crm/actions";
import { SubmitButton } from "@/components/submit-button";
import type { CrmContact, CrmLead, CrmTask } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

function isOverdue(task: CrmTask): boolean {
  if (task.status === "done" || !task.due_date) return false;
  return new Date(task.due_date) < new Date(new Date().toDateString());
}

export default async function TasksPage() {
  const supabase = await createClient();
  const [{ data: tasks }, { data: contacts }, { data: leads }] = await Promise.all([
    supabase.from("crm_tasks").select("*").order("due_date", { ascending: true, nullsFirst: false }),
    supabase.from("crm_contacts").select("*").order("first_name"),
    supabase.from("crm_leads").select("*").neq("status", "promoted").order("first_name"),
  ]);

  const taskList = (tasks as CrmTask[]) ?? [];
  const contactList = (contacts as CrmContact[]) ?? [];
  const leadList = (leads as CrmLead[]) ?? [];
  const nameFor = (id: string | null, list: { id: string; first_name: string; last_name: string | null }[]) => {
    const row = list.find((r) => r.id === id);
    return row ? `${row.first_name} ${row.last_name ?? ""}`.trim() : null;
  };

  const openTasks = taskList.filter((t) => t.status === "open");
  const doneTasks = taskList.filter((t) => t.status === "done");

  return (
    <div>
      <details className="card mb-6 p-4">
        <summary className="cursor-pointer text-sm font-medium text-cream">
          + New task
        </summary>
        <form action={createTask} className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="title">Task</label>
            <input className="input" id="title" name="title" placeholder="e.g. Call back about the quote" required />
          </div>
          <div>
            <label className="label" htmlFor="due_date">Due date</label>
            <input className="input" id="due_date" name="due_date" type="date" />
          </div>
          <div>
            <label className="label" htmlFor="contact_id">Link to a contact</label>
            <select className="input" id="contact_id" name="contact_id" defaultValue="">
              <option value="">None</option>
              {contactList.map((c) => (
                <option key={c.id} value={c.id}>{c.first_name} {c.last_name ?? ""}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="lead_id">Or a lead</label>
            <select className="input" id="lead_id" name="lead_id" defaultValue="">
              <option value="">None</option>
              {leadList.map((l) => (
                <option key={l.id} value={l.id}>{l.first_name} {l.last_name ?? ""}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <SubmitButton pendingText="Adding…" className="btn-primary">
              Add task
            </SubmitButton>
          </div>
        </form>
      </details>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-cream-dim">
        Open ({openTasks.length})
      </h2>
      {openTasks.length === 0 ? (
        <p className="mb-8 text-sm text-cream-dim">Nothing outstanding — nice.</p>
      ) : (
        <div className="card mb-8 divide-y divide-ink-border">
          {openTasks.map((task) => (
            <div key={task.id} className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <p className="font-medium text-cream">{task.title}</p>
                <p className={`text-sm ${isOverdue(task) ? "text-red-400" : "text-cream-dim"}`}>
                  {task.due_date ? `Due ${task.due_date}${isOverdue(task) ? " — overdue" : ""}` : "No due date"}
                  {(nameFor(task.contact_id, contactList) || nameFor(task.lead_id, leadList)) &&
                    ` · ${nameFor(task.contact_id, contactList) ?? nameFor(task.lead_id, leadList)}`}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <form action={setTaskStatus.bind(null, task.id, "done")}>
                  <button type="submit" className="btn-primary text-xs">Mark done</button>
                </form>
                <form action={deleteTask.bind(null, task.id)}>
                  <button type="submit" className="btn-ghost text-red-400 hover:text-red-300">Delete</button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-cream-dim">
        Done ({doneTasks.length})
      </h2>
      {doneTasks.length === 0 ? (
        <p className="text-sm text-cream-dim">Nothing completed yet.</p>
      ) : (
        <div className="card divide-y divide-ink-border opacity-70">
          {doneTasks.map((task) => (
            <div key={task.id} className="flex items-center justify-between gap-4 p-4">
              <p className="font-medium text-cream line-through">{task.title}</p>
              <div className="flex shrink-0 items-center gap-2">
                <form action={setTaskStatus.bind(null, task.id, "open")}>
                  <button type="submit" className="btn-ghost text-xs">Reopen</button>
                </form>
                <form action={deleteTask.bind(null, task.id)}>
                  <button type="submit" className="btn-ghost text-red-400 hover:text-red-300">Delete</button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
