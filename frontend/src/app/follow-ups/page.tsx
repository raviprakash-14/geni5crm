
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarPlus,
  CalendarClock,
  CheckCircle2,
  Circle,
  Clock,
  Plus,
  Trash2,
} from "lucide-react";


const API_URL = `${(process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "")}/api`;

type Lead = {
  id: number;
  name: string;
  company?: string | null;
};

type FollowUp = {
  id: number;
  lead_id: number;
  title: string;
  due_at: string;
  notes: string | null;
  status: "Pending" | "Completed";
};

export default function FollowUpsPage() {
  const router = useRouter();
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [title, setTitle] = useState("");
  const [leadId, setLeadId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [notes, setNotes] = useState("");
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function getToken(): string | null {
    return localStorage.getItem("access_token");
  }

  
function openGoogleCalendar(item: FollowUp, lead?: Lead) {
  const start = new Date(item.due_at);

  if (Number.isNaN(start.getTime())) {
    setError("Invalid follow-up date. Please check the due date and time.");
    return;
  }

  // Default calendar event duration: 30 minutes.
  const end = new Date(start.getTime() + 30 * 60 * 1000);

  // Google Calendar accepts UTC timestamps in this format.
  const formatGoogleDate = (date: Date) =>
    date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

  const leadName = lead
    ? `${lead.name}${lead.company ? ` (${lead.company})` : ""}`
    : `Lead #${item.lead_id}`;

  const details = [
    `Related lead: ${leadName}`,
    item.notes ? `Notes: ${item.notes}` : "",
    "Created from Geni5 CRM.",
  ]
    .filter(Boolean)
    .join("\n");

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${item.title} - ${leadName}`,
    dates: `${formatGoogleDate(start)}/${formatGoogleDate(end)}`,
    details,
  });

  window.open(
    `https://calendar.google.com/calendar/render?${params.toString()}`,
    "_blank",
    "noopener,noreferrer"
  );
}


  function redirectIfUnauthorized(response: Response): boolean {
    if (response.status === 401) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("crm_user");
      router.push("/login");
      return true;
    }
    return false;
  }

  async function loadData() {
    setError("");
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }

    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [followUpsResponse, leadsResponse] = await Promise.all([
        fetch(`${API_URL}/follow-ups`, { headers }),
        fetch(`${API_URL}/leads`, { headers }),
      ]);

      if (
        redirectIfUnauthorized(followUpsResponse) ||
        redirectIfUnauthorized(leadsResponse)
      ) {
        return;
      }

      if (!followUpsResponse.ok || !leadsResponse.ok) {
        throw new Error("Could not load follow-ups or leads.");
      }

      const followUpsData: FollowUp[] = await followUpsResponse.json();
      const leadsData: Lead[] = await leadsResponse.json();

      setFollowUps(followUpsData);
      setLeads(leadsData);

      if (leadsData.length > 0 && !leadId) {
        setLeadId(String(leadsData[0].id));
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    // Load the initial data when the page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createFollowUp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!leadId) {
      setError("Create a lead before adding a follow-up.");
      return;
    }

    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }
    setSaving(true);

    try {
      const response = await fetch(`${API_URL}/follow-ups`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken() ?? ""}` },
        body: JSON.stringify({
          lead_id: Number(leadId),
          title: title.trim(),
          due_at: new Date(dueAt).toISOString(),
          notes: notes.trim() || null,
        }),
      });

      if (redirectIfUnauthorized(response)) return;
      if (!response.ok) {
        const data = await response.json();
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Could not create follow-up. Check your inputs."
        );
      }

      setTitle("");
      setNotes("");
      setDueAt("");
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not create follow-up."
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(item: FollowUp) {
    setError("");
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/follow-ups/${item.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            status: item.status === "Pending" ? "Completed" : "Pending",
          }),
        }
      );

      if (redirectIfUnauthorized(response)) return;
      if (!response.ok) {
        throw new Error("Could not update follow-up status.");
      }

      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not update follow-up."
      );
    }
  }

  async function deleteFollowUp(id: number) {
    if (!window.confirm("Delete this follow-up?")) return;

    setError("");
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/follow-ups/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (redirectIfUnauthorized(response)) return;

      if (!response.ok) {
        throw new Error("Could not delete follow-up.");
      }

      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not delete follow-up."
      );
    }
  }

  const visibleFollowUps = followUps.filter((item) => {
    if (filter === "All") return true;
    return item.status === filter;
  });

  const pendingCount = followUps.filter(
    (item) => item.status === "Pending"
  ).length;

  const completedCount = followUps.filter(
    (item) => item.status === "Completed"
  ).length;

  return (
    <main className="min-h-screen bg-[#f6f8fc] px-4 py-6 text-slate-900 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/"
          className="mb-7 inline-flex items-center gap-2 rounded-lg text-sm font-medium text-slate-500 transition hover:text-indigo-700"
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </Link>

        <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-indigo-600">
              <CalendarClock size={22} />
              <span className="text-xs font-bold uppercase tracking-[0.18em]">Geni5 CRM</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Follow-ups
            </h1>
            <p className="mt-2 text-slate-500">
              Schedule client calls, track reminders, and manage next steps.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white px-5 py-4 shadow-sm">
            <p className="text-sm text-slate-500">Pending follow-ups</p>
            <p className="text-2xl font-bold">{pendingCount}</p>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm"
          >
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
          <section className="h-fit rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm shadow-slate-200/40">
            <h2 className="mb-5 flex items-center gap-2 text-lg font-bold tracking-tight">
              <Plus size={19} />
              Schedule follow-up
            </h2>

            <form onSubmit={createFollowUp} className="space-y-4">
              <div>
                <label
                  htmlFor="followup-title"
                  className="mb-1.5 block text-sm font-semibold text-slate-700"
                >
                  Follow-up title
                </label>
                <input
                  id="followup-title"
                  required
                  maxLength={200}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Call about proposal"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                />
              </div>

              <div>
                <label
                  htmlFor="followup-lead"
                  className="mb-1.5 block text-sm font-semibold text-slate-700"
                >
                  Related lead
                </label>
                <select
                  id="followup-lead"
                  required
                  value={leadId}
                  onChange={(e) => setLeadId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                >
                  <option value="" disabled>
                    Select a lead
                  </option>
                  {leads.map((lead) => (
                    <option key={lead.id} value={lead.id}>
                      {lead.name}
                      {lead.company ? ` — ${lead.company}` : ""}
                    </option>
                  ))}
                </select>
                {leads.length === 0 && !loading && (
                  <p className="mt-1 text-xs text-amber-700">
                    Add a lead in the CRM before scheduling a follow-up.
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="followup-due"
                  className="mb-1.5 block text-sm font-semibold text-slate-700"
                >
                  Due date and time
                </label>
                <input
                  id="followup-due"
                  type="datetime-local"
                  required
                  value={dueAt}
                  onChange={(e) => setDueAt(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label
                  htmlFor="followup-notes"
                  className="mb-1.5 block text-sm font-semibold text-slate-700"
                >
                  Notes (optional)
                </label>
                <textarea
                  id="followup-notes"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="What should you discuss?"
                  className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                />
              </div>

              <button
                type="submit"
                disabled={saving || loading || leads.length === 0}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus size={18} />
                {saving ? "Saving..." : "Create follow-up"}
              </button>
            </form>
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm shadow-slate-200/40">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Your reminders</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {followUps.length} total · {pendingCount} pending ·{" "}
                  {completedCount} completed
                </p>
              </div>

              <select
                aria-label="Filter follow-ups"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
              >
                <option value="All">All follow-ups</option>
                <option value="Pending">Pending</option>
                <option value="Completed">Completed</option>
              </select>
            </div>

            {loading ? (
              <p className="py-10 text-center text-slate-500">
                Loading follow-ups...
              </p>
            ) : visibleFollowUps.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 py-12 text-center">
                <CalendarClock
                  size={32}
                  className="mx-auto mb-3 text-slate-400"
                />
                <p className="font-medium">No follow-ups found</p>
                <p className="mt-1 text-sm text-slate-500">
                  Create a reminder using the form.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {visibleFollowUps.map((item) => {
                  const lead = leads.find((l) => l.id === item.lead_id);
                  const overdue =
                    item.status === "Pending" &&
                    new Date(item.due_at).getTime() < Date.now();

                  return (
                    <article
                      key={item.id}
                      className="rounded-2xl border border-slate-200/80 bg-white p-4 transition duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md hover:shadow-slate-200/50"
                    >
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          onClick={() => void updateStatus(item)}
                          title={
                            item.status === "Pending"
                              ? "Mark completed"
                              : "Mark pending"
                          }
                          aria-label={
                            item.status === "Pending"
                              ? "Mark completed"
                              : "Mark pending"
                          }
                          className="mt-0.5 text-slate-400 hover:text-green-600"
                        >
                          {item.status === "Completed" ? (
                            <CheckCircle2
                              size={22}
                              className="text-green-600"
                            />
                          ) : (
                            <Circle size={22} />
                          )}
                        </button>

                        <div className="min-w-0 flex-1">
                          <h3
                            className={`font-semibold ${
                              item.status === "Completed"
                                ? "text-slate-400 line-through"
                                : ""
                            }`}
                          >
                            {item.title}
                          </h3>

                          <p className="mt-1 text-sm text-slate-500">
                            {lead
                              ? `${lead.name}${
                                  lead.company ? ` · ${lead.company}` : ""
                                }`
                              : `Lead #${item.lead_id}`}
                          </p>

                          <p className="mt-2 flex items-center gap-2 text-sm">
                            <Clock size={15} />
                            <span
                              className={
                                overdue
                                  ? "font-semibold text-red-600"
                                  : "text-slate-600"
                              }
                            >
                              {overdue ? "Overdue · " : ""}
                              {new Date(item.due_at).toLocaleString("en-IN", {
  timeZone: "Asia/Kolkata",
})}
                            </span>
                          </p>

                          {item.notes && (
                            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
                              {item.notes}
                            </p>
                          )}

                          <span
                            className={`mt-3 inline-block rounded-full px-2.5 py-1 text-xs font-medium ${
                              item.status === "Completed"
                                ? "bg-green-50 text-green-700"
                                : "bg-amber-50 text-amber-700"
                            }`}
                          >
                            {item.status}
                          </span>
                        </div>
                        
<button
  type="button"
  onClick={() => openGoogleCalendar(item, lead)}
  title="Add to Google Calendar"
  aria-label={`Add ${item.title} to Google Calendar`}
  className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100"
>
  <CalendarPlus size={16} />
  <span className="hidden sm:inline">Add to Calendar</span>
</button>

                        <button
                          type="button"
                          onClick={() => void deleteFollowUp(item.id)}
                          title="Delete follow-up"
                          aria-label="Delete follow-up"
                          className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
