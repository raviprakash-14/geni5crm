
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Clock,
  Mail,
  Phone,
  Plus,
  Trash2,
  UserRound,
} from "lucide-react";

const API_URL = `${(process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "")}/api`;

type Lead = {
  id: number;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  notes: string | null;
  created_at: string;
};

type Activity = {
  id: number;
  lead_id: number;
  activity_type: "Call" | "Meeting" | "Email" | "Note";
  subject: string;
  description: string | null;
  occurred_at: string;
  created_at: string;
};

type FollowUp = {
  id: number;
  lead_id: number;
  title: string;
  due_at: string;
  notes: string | null;
  status: "Pending" | "Completed";
};

type Message = {
  id: number;
  lead_id: number;
  sender_id: number;
  body: string;
  created_at: string;
};

export default function LeadDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const leadId = Number(params.id);

  const [lead, setLead] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [currentRole, setCurrentRole] = useState("");

  const [activityType, setActivityType] =
    useState<Activity["activity_type"]>("Call");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [occurredAt, setOccurredAt] = useState("");
  const [saving, setSaving] = useState(false);

  function getAuthHeaders(json = false): HeadersInit {
    const token = localStorage.getItem("access_token");

    return {
      ...(json ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  function handleUnauthorized() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("crm_user");
    router.replace("/login");
  }

  async function loadLeadData() {
    setError("");

    const token = localStorage.getItem("access_token");

    if (!token) {
      handleUnauthorized();
      setLoading(false);
      return;
    }

    try {
      // Read the signed-in user safely after the component mounts in the browser.
      const meResponse = await fetch(`${API_URL}/auth/me`, {
  headers: { Authorization: `Bearer ${token}` },
});

if (meResponse.status === 401) {
  handleUnauthorized();
  return;
}

if (!meResponse.ok) {
  throw new Error("Could not verify your account.");
}

const me = await meResponse.json();
setCurrentRole(me.role ?? "");
setCurrentUserId(Number(me.id));

      
      const headers = getAuthHeaders();
      const isStaff = me.role === "admin" || me.role === "salesperson";

     
      const leadPromise: Promise<Response> = fetch(
        `${API_URL}/leads/${leadId}`,
        { headers }
      );

      const activitiesPromise: Promise<Response | null> =
        isStaff
          ? fetch(`${API_URL}/activities?lead_id=${leadId}`, { headers })
          : Promise.resolve(null);

      const followUpsPromise: Promise<Response | null> =
        isStaff
          ? fetch(`${API_URL}/follow-ups?lead_id=${leadId}`, { headers })
          : Promise.resolve(null);

      const messagesPromise: Promise<Response> = fetch(
        `${API_URL}/leads/${leadId}/messages`,
        { headers }
      );

      const [leadResponse, activitiesResponse, followUpsResponse, messagesResponse] =
        await Promise.all([
          leadPromise,
          activitiesPromise,
          followUpsPromise,
          messagesPromise,
        ]);


      
      if (
        leadResponse.status === 401 ||
        activitiesResponse?.status === 401 ||
        followUpsResponse?.status === 401 ||
        messagesResponse.status === 401
      ) {
        handleUnauthorized();
        return;
      }

      if (!leadResponse.ok) {
        throw new Error(
          leadResponse.status === 404
            ? "Lead not found."
            : "Could not load lead details."
        );
      }

      if (
        (activitiesResponse && !activitiesResponse.ok) ||
        (followUpsResponse && !followUpsResponse.ok)
      ) {
        throw new Error("Could not load activities or follow-ups.");
      }

      if (!messagesResponse.ok) {
        throw new Error("Could not load the conversation.");
      }

      const leadData = await leadResponse.json();
      const activitiesData = activitiesResponse
        ? await activitiesResponse.json()
        : [];
      const followUpsData = followUpsResponse
        ? await followUpsResponse.json()
        : [];
      const messagesData = await messagesResponse.json();

      setLead(leadData);
      setActivities(activitiesData);
      setFollowUps(followUpsData);
      setMessages(messagesData);

    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!Number.isInteger(leadId) || leadId <= 0) {
      setError("Invalid lead ID.");
      setLoading(false);
      return;
    }

    void loadLeadData();
    // Load data when the selected lead changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  async function addActivity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!localStorage.getItem("access_token")) {
      handleUnauthorized();
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(`${API_URL}/activities`, {
        method: "POST",
        headers: getAuthHeaders(true),
        body: JSON.stringify({
          lead_id: leadId,
          activity_type: activityType,
          subject: subject.trim(),
          description: description.trim() || null,
          occurred_at: occurredAt
            ? new Date(occurredAt).toISOString()
            : null,
        }),
      });

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Could not save activity."
        );
      }

      setSubject("");
      setDescription("");
      setOccurredAt("");
      await loadLeadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save activity."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteActivity(activityId: number) {
    if (!window.confirm("Delete this activity record?")) return;

    setError("");

    if (!localStorage.getItem("access_token")) {
      handleUnauthorized();
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/activities/${activityId}`,
        {
          method: "DELETE",
          headers: getAuthHeaders(),
        }
      );

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        throw new Error("Could not delete activity.");
      }

      await loadLeadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not delete activity."
      );
    }
  }

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = messageText.trim();
    if (!body || sendingMessage) return;

    if (!localStorage.getItem("access_token")) {
      handleUnauthorized();
      return;
    }

    setError("");
    setSendingMessage(true);

    try {
      const response = await fetch(`${API_URL}/leads/${leadId}/messages`, {
        method: "POST",
        headers: getAuthHeaders(true),
        body: JSON.stringify({ body }),
      });

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          typeof data.detail === "string" ? data.detail : "Could not send message."
        );
      }

      const savedMessage: Message = await response.json();
      setMessages((current) => [...current, savedMessage]);
      setMessageText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send message.");
    } finally {
      setSendingMessage(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f6f7fb] p-6 sm:p-10">
        <div className="mx-auto max-w-7xl animate-pulse space-y-5">
          <div className="h-4 w-36 rounded bg-slate-200" />
          <div className="rounded-3xl border border-slate-200 bg-white p-8">
            <div className="h-8 w-64 rounded bg-slate-200" />
            <div className="mt-4 h-4 w-44 rounded bg-slate-100" />
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="h-16 rounded-xl bg-slate-100" />
              <div className="h-16 rounded-xl bg-slate-100" />
              <div className="h-16 rounded-xl bg-slate-100" />
              <div className="h-16 rounded-xl bg-slate-100" />
            </div>
          </div>
          <p className="text-sm text-slate-500">Loading lead details…</p>
        </div>
      </main>
    );
  }

  if (!lead) {
    return (
      <main className="min-h-screen bg-[#f6f7fb] px-4 py-12 sm:px-8">
        <div className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
            <UserRound size={24} />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Unable to open this lead</h1>
          <p role="alert" className="mt-2 text-sm leading-6 text-slate-600">
            {error || "Lead could not be found."}
          </p>
          <Link href="/leads" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700">
            <ArrowLeft size={16} />
            Back to leads
          </Link>
        </div>
      </main>
    );
  }

  const pendingFollowUps = followUps.filter(
    (item) => item.status === "Pending"
  );

  return (
    <main className="min-h-screen bg-[#f6f7fb] px-4 py-8 text-slate-900 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 rounded-lg text-sm font-medium text-slate-500 transition hover:text-indigo-700"
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </Link>

        {error && (
          <div
            role="alert"
            className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        <section className="mb-6 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm shadow-slate-200/50 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-indigo-50 p-4 text-indigo-700">
                <UserRound size={28} />
              </div>
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">Lead profile</p>
                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{lead.name}</h1>
                <p className="mt-1 text-slate-500">
                  {lead.company || "No company added"}
                </p>
                <span className="mt-3 inline-flex items-center rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                  {lead.status}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {lead.email && (
                <a
                  href={`mailto:${lead.email}`}
                  className="inline-flex items-center gap-2 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                >
                  <Mail size={16} />
                  Email
                </a>
              )}
              {lead.phone && (
                <a
                  href={`tel:${lead.phone}`}
                  className="inline-flex items-center gap-2 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                >
                  <Phone size={16} />
                  Call
                </a>
              )}
            </div>
          </div>

          <div className="mt-7 grid grid-cols-1 gap-4 border-t border-slate-100 pt-6 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Email address</p>
              <p className="mt-2 break-words font-semibold text-slate-800">
                {lead.email || "Not provided"}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Phone number</p>
              <p className="mt-2 font-semibold text-slate-800">
                {lead.phone || "Not provided"}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Lead created</p>
              <p className="mt-2 font-semibold text-slate-800">
                {new Date(lead.created_at).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Lead ID</p>
              <p className="mt-2 font-semibold text-slate-800">#{lead.id}</p>
            </div>
          </div>

          {lead.notes && (
            <div className="mt-6 rounded-2xl bg-slate-50 p-5">
              <p className="text-sm font-semibold">Lead notes</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                {lead.notes}
              </p>
            </div>
          )}
        </section>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
          {(currentRole === "admin" || currentRole === "salesperson") && (
            <section className="h-fit rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm shadow-slate-200/50">
            <h2 className="mb-5 flex items-center gap-3 text-lg font-bold tracking-tight">
              <Plus size={19} />
              Record interaction
            </h2>

            <form onSubmit={addActivity} className="space-y-4">
              <div>
                <label
                  htmlFor="activity-type"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Interaction type
                </label>
                <select
                  id="activity-type"
                  value={activityType}
                  onChange={(e) =>
                    setActivityType(
                      e.target.value as Activity["activity_type"]
                    )
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm shadow-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
                >
                  <option value="Call">Phone call</option>
                  <option value="Meeting">Meeting</option>
                  <option value="Email">Email</option>
                  <option value="Note">Note</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="activity-subject"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Subject
                </label>
                <input
                  id="activity-subject"
                  required
                  maxLength={200}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Discussed product demo"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm shadow-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
                />
              </div>

              <div>
                <label
                  htmlFor="activity-time"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Date and time (optional)
                </label>
                <input
                  id="activity-time"
                  type="datetime-local"
                  value={occurredAt}
                  onChange={(e) => setOccurredAt(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm shadow-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
                />
              </div>

              <div>
                <label
                  htmlFor="activity-description"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Summary or notes
                </label>
                <textarea
                  id="activity-description"
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What did you discuss? What are the next steps?"
                  className="w-full resize-y rounded-xl border border-slate-200 px-3.5 py-3 text-sm shadow-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus size={18} />
                {saving ? "Saving..." : "Save interaction"}
              </button>
            </form>
          </section>
          )}

          <div className="space-y-6">
            <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm shadow-slate-200/50 sm:p-7">
              <div className="mb-5 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Client conversation</h2>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                  {messages.length} messages
                </span>
              </div>

              <div className="mb-5 max-h-96 space-y-3 overflow-y-auto rounded-2xl bg-slate-50/80 p-4">
                {messages.length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-500">
                    No messages yet. Start the conversation below.
                  </p>
                ) : (
                  messages.map((message) => {
                    const isCurrentUser = message.sender_id === currentUserId;
                    return (
                      <article
                        key={message.id}
                        className={`max-w-[90%] rounded-2xl border p-4 ${
                          isCurrentUser
                            ? "ml-auto border-indigo-200 bg-indigo-50"
                            : "mr-auto border-slate-200 bg-white"
                        }`}
                      >
                        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-slate-700">
                            {isCurrentUser ? "You" : "Other participant"}
                          </span>
                          <time className="text-xs text-slate-500">
                            {new Date(message.created_at).toLocaleString()}
                          </time>
                        </div>
                        <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">
                          {message.body}
                        </p>
                      </article>
                    );
                  })
                )}
              </div>

              <form onSubmit={sendMessage} className="space-y-3">
                <label htmlFor="client-message" className="block text-sm font-medium">
                  Message
                </label>
                <textarea
                  id="client-message"
                  required
                  minLength={1}
                  maxLength={5000}
                  rows={3}
                  value={messageText}
                  onChange={(event) => setMessageText(event.target.value)}
                  placeholder="Write a message..."
                  className="w-full resize-y rounded-xl border border-slate-200 px-3.5 py-3 text-sm shadow-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
                />
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-slate-500">
                    {messageText.length}/5000 characters
                  </span>
                  <button
                    type="submit"
                    disabled={sendingMessage || !messageText.trim()}
                    className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {sendingMessage ? "Sending..." : "Send message"}
                  </button>
                </div>
              </form>
            </section>

            <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm shadow-slate-200/50 sm:p-7">
              <h2 className="mb-5 flex items-center gap-3 text-lg font-bold tracking-tight">
                <Clock size={20} />
                Activity timeline
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                  {activities.length}
                </span>
              </h2>

              {activities.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-300 py-8 text-center text-sm text-slate-500">
                  No interactions recorded yet. Add the first one using the form.
                </p>
              ) : (
                <div className="space-y-0">
                  {activities.map((activity) => (
                    <article
                      key={activity.id}
                      className="relative relative border-l-2 border-indigo-100 pb-7 pl-6 last:border-l-transparent last:pb-0"
                    >
                      <span className="absolute -left-[7px] top-1 h-3 w-3 rounded-full border-2 border-indigo-600 bg-white" />

                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                            {activity.activity_type}
                          </span>
                          <h3 className="mt-1 font-semibold">
                            {activity.subject}
                          </h3>
                          <p className="mt-1 text-xs text-slate-500">
                            {new Date(activity.occurred_at).toLocaleString()}
                          </p>
                        </div>

                        {(currentRole === "admin" || currentRole === "salesperson") && (
  <button
    type="button"
    onClick={() => void deleteActivity(activity.id)}
    aria-label="Delete activity"
    title="Delete activity"
    className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
  >
    <Trash2 size={16} />
  </button>
)}
                      </div>

                      {activity.description && (
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                          {activity.description}
                        </p>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm shadow-slate-200/50 sm:p-7">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                <CalendarClock size={20} />
                Follow-ups
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                  {pendingFollowUps.length} pending
                </span>
              </h2>

              {followUps.length === 0 ? (
                <p className="py-5 text-sm text-slate-500">
                  No follow-ups for this lead yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {followUps.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300"
                    >
                      <CheckCircle2
                        size={19}
                        className={
                          item.status === "Completed"
                            ? "mt-0.5 text-green-600"
                            : "mt-0.5 text-slate-300"
                        }
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          className={`font-medium ${
                            item.status === "Completed"
                              ? "text-slate-400 line-through"
                              : ""
                          }`}
                        >
                          {item.title}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          Due {new Date(item.due_at).toLocaleString()}
                        </p>
                        {item.notes && (
                          <p className="mt-1 text-sm text-slate-500">
                            {item.notes}
                          </p>
                        )}
                        <span className="mt-2 inline-block text-xs text-slate-500">
                          {item.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {(currentRole === "admin" || currentRole === "salesperson") && (
  <Link
    href="/follow-ups"
    className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-indigo-600 transition hover:text-indigo-800"
  >
    Manage follow-ups
  </Link>
)}
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
